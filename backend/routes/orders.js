const express = require('express')
const { getShippingOptions, readItems, validateAddress } = require('../services/commerce')
const { createOrderPreference } = require('../services/mercadopago')

function readId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) {
    const error = new Error('Identificador inválido.')
    error.statusCode = 400
    throw error
  }
  return id
}

async function loadOrder(client, id, userId, lock = false) {
  const result = await client.query(
    `SELECT id, status, shipping_address, subtotal, shipping_cost, total, payment_gateway,
       gateway_payment_id, gateway_preference_id, gateway_checkout_url, tracking_code, created_at
     FROM orders WHERE id = $1 AND user_id = $2${lock ? ' FOR UPDATE' : ''}`,
    [id, userId],
  )
  if (result.rowCount === 0) return null
  const order = result.rows[0]
  const items = await client.query(
    `SELECT item.id, item.product_id, item.plan_id, item.subscription_id,
       item.grind, item.frequency, item.quantity, item.unit_price, item.is_recurring,
       COALESCE(product.name, plan.name, 'Item do pedido') AS name
     FROM order_items AS item
     LEFT JOIN products AS product ON product.id = item.product_id
     LEFT JOIN subscription_plans AS plan ON plan.id = item.plan_id
     WHERE item.order_id = $1
     ORDER BY item.id`,
    [id],
  )
  return { ...order, items: items.rows }
}

function createOrdersRouter(pool, options = {}) {
  const router = express.Router()
  const paymentOptions = {
    environment: options.environment || process.env,
    fetchImpl: options.fetchImpl || globalThis.fetch,
  }

  router.get('/me', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id FROM orders WHERE user_id = $1 ORDER BY created_at DESC, id DESC',
        [req.user.id],
      )
      const orders = []
      for (const row of result.rows) {
        orders.push(await loadOrder(pool, row.id, req.user.id))
      }
      return res.json(orders)
    } catch (error) {
      console.error('Could not list customer orders:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar seus pedidos.' })
    }
  })

  router.get('/admin/payments', async (req, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Esta área é exclusiva para administradores.' })
    }
    try {
      const result = await pool.query(`
        SELECT 'order' AS kind, order_record.id, order_record.created_at AS date,
          user_record.name AS customer,
          CASE
            WHEN order_record.status = 'paid' THEN 'aprovado'
            WHEN order_record.status = 'canceled' THEN 'recusado'
            ELSE 'pendente'
          END AS status,
          order_record.total AS amount,
          CASE
            WHEN order_record.payment_gateway = 'simulation' THEN 'pix'
            WHEN order_record.payment_gateway = 'mercadopago' THEN 'mercado_pago'
            ELSE 'demonstrativo'
          END AS method
        FROM orders AS order_record
        JOIN users AS user_record ON user_record.id = order_record.user_id
        UNION ALL
        SELECT 'subscription' AS kind, subscription.id, subscription.created_at AS date,
          subscription.customer_name AS customer,
          CASE
            WHEN subscription.status = 'ativa' THEN 'aprovado'
            WHEN subscription.status = 'cancelada' THEN 'recusado'
            ELSE 'pendente'
          END AS status,
          COALESCE(subscription.billing_amount, plan.price) AS amount,
          'recorrente' AS method
        FROM customer_subscriptions AS subscription
        JOIN subscription_plans AS plan ON plan.id = subscription.plan_id
        ORDER BY date DESC, kind, id DESC
      `)
      return res.json(result.rows)
    } catch (error) {
      console.error('Could not load real payments:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar os pagamentos do banco.' })
    }
  })

  router.post('/', async (req, res) => {
    let client
    try {
      const items = readItems(req.body?.items)
      if (items.some((item) => item.itemType !== 'product')) {
        return res.status(400).json({ message: 'Assinaturas recorrentes devem ser iniciadas separadamente do pedido de produtos.' })
      }
      const shippingMethod = req.body?.shipping_method
      if (!['pac', 'sedex'].includes(shippingMethod)) {
        return res.status(400).json({ message: 'Selecione uma opção de frete válida.' })
      }
      client = await pool.connect()
      await client.query('BEGIN')

      let address
      let addressId = null
      if (req.body?.address_id !== undefined && req.body.address_id !== null) {
        addressId = readId(req.body.address_id)
        const addressResult = await client.query(
          `SELECT id, cep, street, number, complement, neighborhood, city, state
           FROM addresses WHERE id = $1 AND user_id = $2`,
          [addressId, req.user.id],
        )
        if (addressResult.rowCount === 0) {
          await client.query('ROLLBACK')
          return res.status(400).json({ message: 'Selecione um endereço salvo na sua conta.' })
        }
        address = validateAddress({
          ...addressResult.rows[0],
          recipient: req.body?.shipping_address?.recipient,
          phone: req.body?.shipping_address?.phone,
        })
      } else {
        address = validateAddress(req.body?.shipping_address)
      }

      const shippingQuote = await getShippingOptions(client, address.cep, items)
      const selectedShipping = shippingQuote.options.find((option) => option.id === shippingMethod)
      let subtotal = 0
      const resolvedItems = []

      for (const item of items) {
        if (item.itemType === 'product') {
          const result = await client.query(
            `SELECT id, name, price, stock, active
             FROM products WHERE id = $1 FOR UPDATE`,
            [item.productId],
          )
          const product = result.rows[0]
          if (!product || !product.active) {
            const error = new Error('Um dos produtos não está mais disponível.')
            error.statusCode = 409
            throw error
          }
          if (product.stock < item.quantity) {
            const error = new Error(`Estoque insuficiente para ${product.name}.`)
            error.statusCode = 409
            throw error
          }
          await client.query(
            'UPDATE products SET stock = stock - $1 WHERE id = $2',
            [item.quantity, product.id],
          )
          resolvedItems.push({
            productId: product.id,
            planId: null,
            quantity: item.quantity,
            grind: item.grind,
            frequency: null,
            price: Number(product.price),
            recurring: false,
          })
          subtotal = Math.round((subtotal + Number(product.price) * item.quantity + Number.EPSILON) * 100) / 100
          continue
        }

        const planResult = await client.query(
          'SELECT id, name, price FROM subscription_plans WHERE id = $1 AND active = TRUE FOR UPDATE',
          [item.planId],
        )
        const plan = planResult.rows[0]
        if (!plan) {
          const error = new Error('Um dos planos não está mais disponível.')
          error.statusCode = 409
          throw error
        }
        const includedProducts = await client.query(
          `SELECT product.id, product.name, product.stock
           FROM subscription_plan_products AS link
           JOIN products AS product ON product.id = link.product_id
           WHERE link.plan_id = $1 AND product.active = TRUE
           ORDER BY product.id
           FOR UPDATE OF product`,
          [plan.id],
        )
        for (const product of includedProducts.rows) {
          if (product.stock < item.quantity) {
            const error = new Error(`Estoque insuficiente para ${product.name}, incluído no plano ${plan.name}.`)
            error.statusCode = 409
            throw error
          }
          await client.query(
            'UPDATE products SET stock = stock - $1 WHERE id = $2',
            [item.quantity, product.id],
          )
        }
        for (let index = 0; index < item.quantity; index += 1) {
          resolvedItems.push({
            productId: null,
            planId: plan.id,
            quantity: 1,
            grind: item.grind,
            frequency: item.frequency,
            price: Number(plan.price),
            recurring: true,
          })
        }
        subtotal = Math.round((subtotal + Number(plan.price) * item.quantity + Number.EPSILON) * 100) / 100
      }

      const shippingCost = selectedShipping.cost
      const total = Math.round((subtotal + shippingCost + Number.EPSILON) * 100) / 100
      const snapshot = {
        ...address,
        address_id: addressId,
        shipping_method: selectedShipping.id,
        shipping_label: selectedShipping.label,
        shipping_min_days: selectedShipping.min_days,
        shipping_max_days: selectedShipping.max_days,
      }
      const insertedOrder = await client.query(
        `INSERT INTO orders
          (user_id, address_id, shipping_address, subtotal, shipping_cost, total, status)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, 'pending')
         RETURNING id`,
        [req.user.id, addressId, JSON.stringify(snapshot), subtotal, shippingCost, total],
      )
      const orderId = insertedOrder.rows[0].id
      for (const item of resolvedItems) {
        await client.query(
          `INSERT INTO order_items
            (order_id, product_id, plan_id, grind, frequency, quantity, unit_price, is_recurring)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [orderId, item.productId, item.planId, item.grind, item.frequency,
            item.quantity, item.price, item.recurring],
        )
      }
      const order = await loadOrder(client, orderId, req.user.id)
      await client.query('COMMIT')
      return res.status(201).json(order)
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK')
        } catch (rollbackError) {
          console.error('Could not roll back order creation:', rollbackError.message)
        }
      }
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
      console.error('Could not create customer order:', error.message)
      return res.status(500).json({ message: 'Não foi possível criar o pedido.' })
    } finally {
      client?.release()
    }
  })

  router.post('/:id/demo-confirm', async (req, res) => {
    let client
    try {
      const id = readId(req.params.id)
      client = await pool.connect()
      await client.query('BEGIN')
      const order = await loadOrder(client, id, req.user.id, true)
      if (!order) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Pedido não encontrado.' })
      }
      if (order.status !== 'pending') {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'Este pedido já foi finalizado.' })
      }
      await client.query(
        `UPDATE orders
         SET status = 'paid',
             payment_gateway = 'simulation',
             gateway_payment_id = $1,
             gateway_preference_id = NULL,
             gateway_checkout_url = NULL
         WHERE id = $2 AND user_id = $3 AND status = 'pending'`,
        [`demo-${Date.now()}-${id}`, id, req.user.id],
      )
      await client.query('COMMIT')
      return res.json({ ...order, status: 'paid', payment_gateway: 'simulation' })
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK')
        } catch (rollbackError) {
          console.error('Could not roll back simulated order confirmation:', rollbackError.message)
        }
      }
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
      console.error('Could not confirm simulated order:', error.message)
      return res.status(500).json({ message: 'Não foi possível confirmar o pedido demonstrativo.' })
    } finally {
      client?.release()
    }
  })

  router.post('/:id/mercadopago-preference', async (req, res) => {
    let client
    try {
      const id = readId(req.params.id)
      client = await pool.connect()
      await client.query('BEGIN')
      const order = await loadOrder(client, id, req.user.id, true)
      if (!order) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Pedido não encontrado.' })
      }
      if (order.status !== 'pending') {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'Este pedido não está aguardando pagamento.' })
      }
      if (order.payment_gateway && order.payment_gateway !== 'mercadopago') {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'Este pedido foi iniciado por outro meio de pagamento.' })
      }
      if (order.items.length === 0 || order.items.some((item) => item.is_recurring)) {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'Este pedido não pode ser pago pelo Checkout Pro.' })
      }
      if (order.gateway_checkout_url) {
        await client.query('COMMIT')
        return res.json({ init_point: order.gateway_checkout_url })
      }
      const subscriptionId = req.body?.subscription_id ? readId(req.body.subscription_id) : null
      if (subscriptionId) {
        const subscription = await client.query(
          `SELECT id FROM customer_subscriptions
           WHERE id = $1 AND user_id = $2`,
          [subscriptionId, req.user.id],
        )
        if (subscription.rowCount === 0) {
          await client.query('ROLLBACK')
          return res.status(400).json({ message: 'A assinatura associada não está disponível.' })
        }
      }

      const preference = await createOrderPreference(
        order,
        req.user.email,
        subscriptionId,
        paymentOptions,
      )
      await client.query(
        `UPDATE orders SET payment_gateway = 'mercadopago',
          gateway_preference_id = $1, gateway_checkout_url = $2
         WHERE id = $3 AND user_id = $4 AND status = 'pending'
           AND (payment_gateway IS NULL OR payment_gateway = 'mercadopago')`,
        [preference.id, preference.initPoint, id, req.user.id],
      )
      await client.query('COMMIT')
      return res.json({ init_point: preference.initPoint })
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK')
        } catch (rollbackError) {
          console.error('Could not roll back Mercado Pago preference creation:', rollbackError.message)
        }
      }
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
      console.error('Could not create Mercado Pago preference:', error.message)
      return res.status(500).json({ message: 'Não foi possível iniciar o pagamento pelo Mercado Pago.' })
    } finally {
      client?.release()
    }
  })

  router.get('/:id', async (req, res) => {
    try {
      const order = await loadOrder(pool, readId(req.params.id), req.user.id)
      if (!order) return res.status(404).json({ message: 'Pedido não encontrado.' })
      return res.json(order)
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
      console.error('Could not load customer order:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar o pedido.' })
    }
  })

  return router
}

module.exports = createOrdersRouter
