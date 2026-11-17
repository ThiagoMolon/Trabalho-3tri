const express = require('express')
const { getShippingOptions } = require('../services/commerce')
const {
  createSubscriptionPlan,
  frequencySettings,
  getFrontendUrl,
  updatePreapproval,
} = require('../services/mercadopago')

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

function createCustomerSubscriptionsRouter(pool, options = {}) {
  const router = express.Router()
  const paymentOptions = {
    environment: options.environment || process.env,
    fetchImpl: options.fetchImpl || globalThis.fetch,
  }
  const frequencies = new Set(['semanal', 'quinzenal', 'mensal', 'bimestral'])
  const statuses = new Map([
    ['active', 'ativa'],
    ['paused', 'pausada'],
    ['canceled', 'cancelada'],
    ['ativa', 'ativa'],
    ['pausada', 'pausada'],
    ['cancelada', 'cancelada'],
  ])

  router.get('/me', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT subscription.id, subscription.plan_id, subscription.address_id,
          subscription.grind, subscription.frequency, subscription.status,
          subscription.started_at, subscription.next_renewal, subscription.canceled_at,
          subscription.billing_amount, subscription.shipping_cost, subscription.shipping_method,
          subscription.mercadopago_checkout_url,
          plan.name AS plan_name, plan.price AS plan_price, plan.description AS plan_description
         FROM customer_subscriptions AS subscription
         JOIN subscription_plans AS plan ON plan.id = subscription.plan_id
         WHERE subscription.user_id = $1
         ORDER BY CASE subscription.status WHEN 'ativa' THEN 0 WHEN 'pausada' THEN 1 ELSE 2 END,
          subscription.created_at DESC, subscription.id DESC`,
        [req.user.id],
      )
      return res.json(result.rows)
    } catch (error) {
      console.error('Could not list customer subscriptions:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar suas assinaturas.' })
    }
  })

  router.post('/me/demo-checkout', async (req, res) => {
    try {
      const planId = readId(req.body?.plan_id)
      const addressId = readId(req.body?.address_id)
      const orderId = req.body?.order_id ? readId(req.body.order_id) : null
      const frequency = req.body?.frequency
      if (!frequencies.has(frequency)) throw validationError('Selecione uma frequência válida.')
      const grind = typeof req.body?.grind === 'string' ? req.body.grind.trim() : ''
      if (!grind || grind.length > 50) throw validationError('Selecione uma moagem válida.')
      const shippingMethod = req.body?.shipping_method
      if (!['pac', 'sedex'].includes(shippingMethod)) throw validationError('Selecione uma opção de frete válida.')
      const recipient = typeof req.body?.shipping_recipient === 'string' ? req.body.shipping_recipient.trim() : ''
      const phone = typeof req.body?.shipping_phone === 'string' ? req.body.shipping_phone.trim() : ''
      if (!recipient || recipient.length > 150 || !phone || phone.length > 20) {
        throw validationError('Informe um destinatário e telefone válidos para a entrega recorrente.')
      }

      const [planResult, addressResult] = await Promise.all([
        pool.query('SELECT id, name, price FROM subscription_plans WHERE id = $1 AND active = TRUE', [planId]),
        pool.query('SELECT id, cep FROM addresses WHERE id = $1 AND user_id = $2', [addressId, req.user.id]),
      ])
      if (planResult.rowCount === 0) throw validationError('O plano selecionado não está mais disponível.')
      if (addressResult.rowCount === 0) throw validationError('Salve um endereço na sua conta para a entrega recorrente.')
      if (orderId) {
        const orderResult = await pool.query(
          "SELECT id FROM orders WHERE id = $1 AND user_id = $2 AND status = 'pending'",
          [orderId, req.user.id],
        )
        if (orderResult.rowCount === 0) throw validationError('O pedido de produtos associado não está disponível.')
      }

      const shippingQuote = await getShippingOptions(pool, addressResult.rows[0].cep, [{
        item_type: 'subscription',
        plan_id: planId,
        quantity: 1,
        grind,
        frequency,
      }])
      const shipping = shippingQuote.options.find((option) => option.id === shippingMethod)
      const plan = planResult.rows[0]
      const billingAmount = Math.round((Number(plan.price) + shipping.cost + Number.EPSILON) * 100) / 100

      const created = await pool.query(
        `INSERT INTO customer_subscriptions
          (customer_name, customer_email, user_id, plan_id, address_id, grind, frequency,
           status, started_at, shipping_cost, billing_amount, shipping_method,
           shipping_recipient, shipping_phone, checkout_order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendente', CURRENT_DATE, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [req.user.name, req.user.email, req.user.id, planId, addressId, grind, frequency,
          shipping.cost, billingAmount, shippingMethod, recipient, phone, orderId],
      )
      return res.status(201).json({ id: created.rows[0].id, simulated: true })
    } catch (error) {
      return sendError(res, error, 'Não foi possível criar a assinatura demonstrativa.')
    }
  })

  router.post('/me/:id/demo-confirm', async (req, res) => {
    try {
      const id = readId(req.params.id)
      const result = await pool.query(
        `UPDATE customer_subscriptions
         SET status = 'ativa',
             next_renewal = COALESCE(next_renewal, CURRENT_DATE)
         WHERE id = $1 AND user_id = $2 AND status = 'pendente'
         RETURNING id, status`,
        [id, req.user.id],
      )
      if (result.rowCount === 0) {
        return res.status(409).json({ message: 'Esta assinatura já foi confirmada ou não está disponível.' })
      }
      return res.json({ ...result.rows[0], simulated: true })
    } catch (error) {
      return sendError(res, error, 'Não foi possível confirmar a assinatura demonstrativa.')
    }
  })

  router.get('/me/:id', async (req, res) => {
    try {
      const id = readId(req.params.id)
      const result = await pool.query(
        `SELECT subscription.id, subscription.plan_id, subscription.address_id,
          subscription.grind, subscription.frequency, subscription.status,
          subscription.started_at, subscription.next_renewal, subscription.canceled_at,
          subscription.billing_amount, subscription.shipping_cost, subscription.shipping_method,
          subscription.mercadopago_checkout_url,
          plan.name AS plan_name, plan.price AS plan_price, plan.description AS plan_description
         FROM customer_subscriptions AS subscription
         JOIN subscription_plans AS plan ON plan.id = subscription.plan_id
         WHERE subscription.id = $1 AND subscription.user_id = $2`,
        [id, req.user.id],
      )
      if (result.rowCount === 0) return res.status(404).json({ message: 'Assinatura não encontrada.' })
      return res.json(result.rows[0])
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
      console.error('Could not load customer subscription:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar sua assinatura.' })
    }
  })

  router.post('/me/mercadopago-checkout', async (req, res) => {
    let subscriptionId
    try {
      const planId = readId(req.body?.plan_id)
      const addressId = readId(req.body?.address_id)
      const orderId = req.body?.order_id ? readId(req.body.order_id) : null
      const frequency = req.body?.frequency
      if (!frequencies.has(frequency)) throw validationError('Selecione uma frequência válida.')
      const grind = typeof req.body?.grind === 'string' ? req.body.grind.trim() : ''
      if (!grind || grind.length > 50) throw validationError('Selecione uma moagem válida.')
      const shippingMethod = req.body?.shipping_method
      if (!['pac', 'sedex'].includes(shippingMethod)) throw validationError('Selecione uma opção de frete válida.')
      const recipient = typeof req.body?.shipping_recipient === 'string' ? req.body.shipping_recipient.trim() : ''
      const phone = typeof req.body?.shipping_phone === 'string' ? req.body.shipping_phone.trim() : ''
      if (!recipient || recipient.length > 150 || !phone || phone.length > 20) {
        throw validationError('Informe um destinatário e telefone válidos para a entrega recorrente.')
      }

      const [planResult, addressResult] = await Promise.all([
        pool.query('SELECT id, name, price FROM subscription_plans WHERE id = $1 AND active = TRUE', [planId]),
        pool.query('SELECT id, cep FROM addresses WHERE id = $1 AND user_id = $2', [addressId, req.user.id]),
      ])
      if (planResult.rowCount === 0) throw validationError('O plano selecionado não está mais disponível.')
      if (addressResult.rowCount === 0) throw validationError('Salve um endereço na sua conta para a entrega recorrente.')
      if (orderId) {
        const orderResult = await pool.query(
          "SELECT id FROM orders WHERE id = $1 AND user_id = $2 AND status = 'pending'",
          [orderId, req.user.id],
        )
        if (orderResult.rowCount === 0) throw validationError('O pedido de produtos associado não está disponível.')
      }
      const existing = await pool.query(
        `SELECT id, mercadopago_checkout_url
         FROM customer_subscriptions
         WHERE user_id = $1 AND plan_id = $2 AND address_id = $3
           AND grind = $4 AND frequency = $5
           AND checkout_order_id IS NOT DISTINCT FROM $6
           AND status = 'pendente' AND mercadopago_plan_id IS NOT NULL
           AND mercadopago_checkout_url IS NOT NULL
         ORDER BY id DESC LIMIT 1`,
        [req.user.id, planId, addressId, grind, frequency, orderId],
      )
      if (existing.rowCount) {
        return res.json({
          id: existing.rows[0].id,
          init_point: existing.rows[0].mercadopago_checkout_url,
        })
      }

      const shippingQuote = await getShippingOptions(pool, addressResult.rows[0].cep, [{
        item_type: 'subscription',
        plan_id: planId,
        quantity: 1,
        grind,
        frequency,
      }])
      const shipping = shippingQuote.options.find((option) => option.id === shippingMethod)
      const plan = planResult.rows[0]
      const billingAmount = Math.round((Number(plan.price) + shipping.cost + Number.EPSILON) * 100) / 100
      if (billingAmount <= 0) throw validationError('O total recorrente precisa ser maior que zero.')
      const created = await pool.query(
        `INSERT INTO customer_subscriptions
          (customer_name, customer_email, user_id, plan_id, address_id, grind, frequency,
           status, started_at, shipping_cost, billing_amount, shipping_method,
           shipping_recipient, shipping_phone, checkout_order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendente', CURRENT_DATE, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [req.user.name, req.user.email, req.user.id, planId, addressId, grind, frequency,
          shipping.cost, billingAmount, shippingMethod, recipient, phone, orderId],
      )
      subscriptionId = created.rows[0].id

      const frontendUrl = getFrontendUrl(paymentOptions.environment)
      const backUrl = orderId
        ? new URL(`/pagamento?order_id=${orderId}&subscription_id=${subscriptionId}`, frontendUrl).toString()
        : new URL(`/confirmacao/assinatura/${subscriptionId}`, frontendUrl).toString()
      const checkout = await createSubscriptionPlan({
        name: `${plan.name} · ${frequency}`,
        frequency,
        amount: billingAmount,
        backUrl,
      }, paymentOptions)
      await pool.query(
        `UPDATE customer_subscriptions SET mercadopago_plan_id = $1, mercadopago_checkout_url = $2
         WHERE id = $3 AND user_id = $4`,
        [checkout.id, checkout.initPoint, subscriptionId, req.user.id],
      )
      return res.status(201).json({ id: subscriptionId, init_point: checkout.initPoint })
    } catch (error) {
      if (subscriptionId) {
        try {
          await pool.query(
            "UPDATE customer_subscriptions SET status = 'cancelada', canceled_at = NOW() WHERE id = $1 AND status = 'pendente'",
            [subscriptionId],
          )
        } catch (cleanupError) {
          console.error('Could not cancel incomplete Mercado Pago subscription:', cleanupError.message)
        }
      }
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
      console.error('Could not create Mercado Pago subscription:', error.message)
      return res.status(500).json({ message: 'Não foi possível iniciar a assinatura pelo Mercado Pago.' })
    }
  })

  router.patch('/:id', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Identificador inválido.' })
    let currentSubscription
    try {
      const current = await pool.query(
        `        SELECT id, status, frequency, billing_amount, mercadopago_preapproval_id
         FROM customer_subscriptions WHERE id = $1 AND user_id = $2`,
        [id, req.user.id],
      )
      if (current.rowCount === 0) return res.status(404).json({ message: 'Assinatura não encontrada.' })
      currentSubscription = current.rows[0]
    } catch (error) {
      console.error('Could not load customer subscription for update:', error.message)
      return res.status(500).json({ message: 'Não foi possível atualizar sua assinatura.' })
    }

    const updates = []
    const values = []
    if (Object.hasOwn(req.body || {}, 'grind')) {
      if (typeof req.body.grind !== 'string' || !req.body.grind.trim() || req.body.grind.trim().length > 50) {
        return res.status(400).json({ message: 'Selecione uma moagem válida.' })
      }
      values.push(req.body.grind.trim())
      updates.push(`grind = $${values.length}`)
    }
    if (Object.hasOwn(req.body || {}, 'frequency')) {
      if (!frequencies.has(req.body.frequency)) return res.status(400).json({ message: 'Selecione uma frequência válida.' })
      values.push(req.body.frequency)
      updates.push(`frequency = $${values.length}`)
      updates.push(`next_renewal = CASE $${values.length}
        WHEN 'semanal' THEN CURRENT_DATE + 7
        WHEN 'quinzenal' THEN CURRENT_DATE + 14
        WHEN 'bimestral' THEN CURRENT_DATE + 60
        ELSE CURRENT_DATE + 30
      END`)
    }
    if (Object.hasOwn(req.body || {}, 'status')) {
      const status = statuses.get(req.body.status)
      if (!status) return res.status(400).json({ message: 'Selecione um status válido.' })
      values.push(status)
      updates.push(`status = $${values.length}`)
      values.push(status === 'cancelada')
      updates.push(`canceled_at = CASE WHEN $${values.length} THEN COALESCE(canceled_at, NOW()) ELSE NULL END`)
    }
    if (!updates.length) return res.status(400).json({ message: 'Informe ao menos uma alteração.' })

    const changesStatus = Object.hasOwn(req.body || {}, 'status')
    const changesFrequency = Object.hasOwn(req.body || {}, 'frequency')
    if ((changesStatus || changesFrequency) && currentSubscription.status === 'pendente'
      && !currentSubscription.mercadopago_preapproval_id) {
      return res.status(409).json({ message: 'Aguarde a autorização do Mercado Pago antes de alterar a assinatura.' })
    }
    if (currentSubscription.mercadopago_preapproval_id && (changesStatus || changesFrequency)) {
      const providerUpdate = {}
      if (changesFrequency) {
        providerUpdate.auto_recurring = {
          ...frequencySettings(req.body.frequency),
          transaction_amount: Number(currentSubscription.billing_amount),
          currency_id: 'BRL',
        }
      }
      if (changesStatus) {
        providerUpdate.status = {
          ativa: 'authorized',
          pausada: 'paused',
          cancelada: 'cancelled',
        }[statuses.get(req.body.status)]
      }
      try {
        await updatePreapproval(currentSubscription.mercadopago_preapproval_id, providerUpdate, paymentOptions)
      } catch (error) {
        console.error('Could not update Mercado Pago subscription:', error.message)
        return res.status(error.statusCode || 502).json({ message: 'Não foi possível atualizar a assinatura no Mercado Pago.' })
      }
    }

    values.push(id, req.user.id)
    try {
      const result = await pool.query(
        `UPDATE customer_subscriptions SET ${updates.join(', ')}
         WHERE id = $${values.length - 1} AND user_id = $${values.length}
         RETURNING id, plan_id, grind, frequency, status, started_at, next_renewal, canceled_at,
           billing_amount, shipping_cost, shipping_method`,
        values,
      )
      if (result.rowCount === 0) return res.status(404).json({ message: 'Assinatura não encontrada.' })
      return res.json(result.rows[0])
    } catch (error) {
      console.error('Could not update customer subscription:', error.message)
      return res.status(500).json({ message: 'Não foi possível atualizar sua assinatura.' })
    }
  })

  return router
}

module.exports = function createSubscriptionRouters(pool, options = {}) {
  return {
    plans: createPlansRouter(pool),
    subscriptions: createSubscriptionsRouter(pool),
    customers: createCustomerSubscriptionsRouter(pool, options),
  }
}