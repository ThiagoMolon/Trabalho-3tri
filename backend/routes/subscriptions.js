const express = require('express')

const frequencies = new Set(['semanal', 'mensal', 'bimestral'])
const statuses = new Set(['ativa', 'pausada', 'cancelada'])

function validationError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function readId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) throw validationError('Identificador inválido.')
  return id
}

function readDate(value, field, required = false) {
  if (!value && !required) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validationError(`Informe uma data válida para ${field}.`)
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw validationError(`Informe uma data válida para ${field}.`)
  }
  return value
}

function buildPlanValues(body = {}) {
  const { name, description, price, frequency, product_ids = [], active = true } = body
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 150) {
    throw validationError('Informe um nome de plano com até 150 caracteres.')
  }
  if (!Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 99999999.99) {
    throw validationError('Informe um preço válido para o plano.')
  }
  if (!frequencies.has(frequency)) throw validationError('Selecione uma frequência válida.')
  if (typeof active !== 'boolean') throw validationError('O campo ativo deve ser verdadeiro ou falso.')
  if (!Array.isArray(product_ids) || product_ids.some((id) => !Number.isInteger(Number(id)) || Number(id) < 1)) {
    throw validationError('Selecione produtos válidos para o plano.')
  }

  return {
    values: [name.trim(), description || null, Number(price), frequency, active],
    productIds: [...new Set(product_ids.map(Number))],
  }
}

function buildSubscriptionValues(body = {}) {
  const { customer_name, customer_email, plan_id, status, started_at, next_renewal } = body
  if (typeof customer_name !== 'string' || !customer_name.trim() || customer_name.trim().length > 200) {
    throw validationError('Informe o nome do cliente com até 200 caracteres.')
  }
  if (typeof customer_email !== 'string' || customer_email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
    throw validationError('Informe um e-mail válido para o cliente.')
  }
  const planId = Number(plan_id)
  if (!Number.isInteger(planId) || planId < 1) throw validationError('Selecione um plano válido.')
  if (!statuses.has(status)) throw validationError('Selecione um status válido.')

  const startedAt = readDate(started_at, 'início', true)
  const nextRenewal = readDate(next_renewal, 'próxima renovação')
  if (nextRenewal && nextRenewal < startedAt) {
    throw validationError('A próxima renovação não pode ser anterior ao início da assinatura.')
  }

  return [customer_name.trim(), customer_email.trim().toLowerCase(), planId, status, startedAt, nextRenewal]
}

function sendError(res, error, fallbackMessage) {
  if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
  if (error.code === '23503') {
    return res.status(409).json({ message: 'Este registro está vinculado a uma assinatura ou produto.' })
  }
  console.error(fallbackMessage, error.message)
  return res.status(500).json({ message: fallbackMessage })
}

function createPlansRouter(pool) {
  const router = express.Router()

  router.get('/', async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT plan.id, plan.name, plan.description, plan.price, plan.frequency, plan.active,
          COALESCE(array_agg(link.product_id) FILTER (WHERE link.product_id IS NOT NULL), ARRAY[]::INT[]) AS product_ids,
          COALESCE(json_agg(json_build_object('id', product.id, 'name', product.name))
            FILTER (WHERE product.id IS NOT NULL), '[]'::JSON) AS products
        FROM subscription_plans AS plan
        LEFT JOIN subscription_plan_products AS link ON link.plan_id = plan.id
        LEFT JOIN products AS product ON product.id = link.product_id
        GROUP BY plan.id
        ORDER BY plan.name ASC, plan.id ASC
      `)
      return res.json(result.rows)
    } catch (error) {
      return sendError(res, error, 'Não foi possível carregar os planos.')
    }
  })

  router.post('/', async (req, res) => {
    const client = await pool.connect()
    try {
      const { values, productIds } = buildPlanValues(req.body)
      if (productIds.length) {
        const found = await client.query('SELECT id FROM products WHERE id = ANY($1::INT[])', [productIds])
        if (found.rowCount !== productIds.length) throw validationError('Um ou mais produtos selecionados não existem.')
      }

      await client.query('BEGIN')
      const inserted = await client.query(
        `INSERT INTO subscription_plans (name, description, price, frequency, active)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        values,
      )
      await client.query(
        'INSERT INTO subscription_plan_products (plan_id, product_id) SELECT $1, unnest($2::INT[])',
        [inserted.rows[0].id, productIds],
      )
      await client.query('COMMIT')
      return res.status(201).json({ id: inserted.rows[0].id })
    } catch (error) {
      await client.query('ROLLBACK')
      return sendError(res, error, 'Não foi possível criar o plano.')
    } finally {
      client.release()
    }
  })

  router.put('/:id', async (req, res) => {
    const client = await pool.connect()
    try {
      const id = readId(req.params.id)
      const { values, productIds } = buildPlanValues(req.body)
      if (productIds.length) {
        const found = await client.query('SELECT id FROM products WHERE id = ANY($1::INT[])', [productIds])
        if (found.rowCount !== productIds.length) throw validationError('Um ou mais produtos selecionados não existem.')
      }

      await client.query('BEGIN')
      const updated = await client.query(
        `UPDATE subscription_plans SET name = $1, description = $2, price = $3, frequency = $4, active = $5
         WHERE id = $6 RETURNING id`,
        [...values, id],
      )
      if (updated.rowCount === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Plano não encontrado.' })
      }
      await client.query('DELETE FROM subscription_plan_products WHERE plan_id = $1', [id])
      await client.query(
        'INSERT INTO subscription_plan_products (plan_id, product_id) SELECT $1, unnest($2::INT[])',
        [id, productIds],
      )
      await client.query('COMMIT')
      return res.json({ id })
    } catch (error) {
      await client.query('ROLLBACK')
      return sendError(res, error, 'Não foi possível atualizar o plano.')
    } finally {
      client.release()
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      const id = readId(req.params.id)
      const result = await pool.query('DELETE FROM subscription_plans WHERE id = $1 RETURNING id', [id])
      if (result.rowCount === 0) return res.status(404).json({ message: 'Plano não encontrado.' })
      return res.status(204).end()
    } catch (error) {
      if (error.code === '23503') {
        return res.status(409).json({ message: 'Não é possível excluir um plano vinculado a assinaturas de clientes.' })
      }
      return sendError(res, error, 'Não foi possível excluir o plano.')
    }
  })

  return router
}

function createSubscriptionsRouter(pool) {
  const router = express.Router()

  router.get('/', async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT subscription.*, plan.name AS plan_name, plan.frequency AS plan_frequency
        FROM customer_subscriptions AS subscription
        JOIN subscription_plans AS plan ON plan.id = subscription.plan_id
        ORDER BY subscription.created_at DESC, subscription.id DESC
      `)
      return res.json(result.rows)
    } catch (error) {
      return sendError(res, error, 'Não foi possível carregar as assinaturas.')
    }
  })

  router.post('/', async (req, res) => {
    try {
      const values = buildSubscriptionValues(req.body)
      const result = await pool.query(
        `INSERT INTO customer_subscriptions
          (customer_name, customer_email, plan_id, status, started_at, next_renewal)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, customer_name, customer_email, plan_id, status, started_at, next_renewal`,
        values,
      )
      return res.status(201).json(result.rows[0])
    } catch (error) {
      if (error.code === '23503') return res.status(400).json({ message: 'O plano selecionado não existe.' })
      return sendError(res, error, 'Não foi possível criar a assinatura.')
    }
  })

  router.put('/:id', async (req, res) => {
    try {
      const id = readId(req.params.id)
      const result = await pool.query(
        `UPDATE customer_subscriptions SET
          customer_name = $1, customer_email = $2, plan_id = $3,
          status = $4, started_at = $5, next_renewal = $6
         WHERE id = $7
         RETURNING id, customer_name, customer_email, plan_id, status, started_at, next_renewal`,
        [...buildSubscriptionValues(req.body), id],
      )
      if (result.rowCount === 0) return res.status(404).json({ message: 'Assinatura não encontrada.' })
      return res.json(result.rows[0])
    } catch (error) {
      if (error.code === '23503') return res.status(400).json({ message: 'O plano selecionado não existe.' })
      return sendError(res, error, 'Não foi possível atualizar a assinatura.')
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      const id = readId(req.params.id)
      const result = await pool.query('DELETE FROM customer_subscriptions WHERE id = $1 RETURNING id', [id])
      if (result.rowCount === 0) return res.status(404).json({ message: 'Assinatura não encontrada.' })
      return res.status(204).end()
    } catch (error) {
      return sendError(res, error, 'Não foi possível excluir a assinatura.')
    }
  })

  return router
}

module.exports = function createSubscriptionRouters(pool) {
  return {
    plans: createPlansRouter(pool),
    subscriptions: createSubscriptionsRouter(pool),
  }
}