const express = require('express')
const { getShippingOptions, readItems, validateAddress } = require('../services/commerce')

function readId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) {
    const error = new Error('Identificador inválido.')
    error.statusCode = 400
    throw error
  }
  return id
}

async function loadOrder(client, id, userId) {
  const result = await client.query(
    `SELECT id, status, shipping_address, subtotal, shipping_cost, total, tracking_code, created_at
     FROM orders WHERE id = $1 AND user_id = $2`,
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

function createOrdersRouter(pool) {
  const router = express.Router()

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

  router.post('/', async (req, res) => {
    let client
    try {
      const items = readItems(req.body?.items)
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

  router.patch('/:id/simulate-pay', async (req, res) => {
    let client
    try {
      const id = readId(req.params.id)
      client = await pool.connect()
      await client.query('BEGIN')
      const orderResult = await client.query(
        `SELECT order_record.*, user_record.name AS customer_name, user_record.email AS customer_email
         FROM orders AS order_record
         JOIN users AS user_record ON user_record.id = order_record.user_id
         WHERE order_record.id = $1 AND order_record.user_id = $2
         FOR UPDATE OF order_record`,
        [id, req.user.id],
      )
      if (orderResult.rowCount === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Pedido não encontrado.' })
      }
      const order = orderResult.rows[0]
      if (order.status === 'paid') {
        await client.query('COMMIT')
        return res.json(await loadOrder(pool, id, req.user.id))
      }
      if (order.status !== 'pending') {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'Este pedido não pode receber pagamento.' })
      }

      const items = await client.query(
        `SELECT id, plan_id, grind, frequency, quantity
         FROM order_items WHERE order_id = $1 AND is_recurring = TRUE`,
        [id],
      )
      const addressId = order.address_id || order.shipping_address?.address_id || null
      for (const item of items.rows) {
        for (let index = 0; index < item.quantity; index += 1) {
          const subscription = await client.query(
            `INSERT INTO customer_subscriptions
              (customer_name, customer_email, user_id, plan_id, address_id, grind, frequency,
               status, started_at, next_renewal)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'ativa', CURRENT_DATE,
               CASE $7
                 WHEN 'semanal' THEN CURRENT_DATE + 7
                 WHEN 'quinzenal' THEN CURRENT_DATE + 14
                 WHEN 'bimestral' THEN CURRENT_DATE + 60
                 ELSE CURRENT_DATE + 30
               END)
             RETURNING id`,
            [order.customer_name, order.customer_email, req.user.id, item.plan_id,
              addressId, item.grind || 'Grãos inteiros', item.frequency || 'mensal'],
          )
          await client.query(
            'UPDATE order_items SET subscription_id = $1 WHERE id = $2',
            [subscription.rows[0].id, item.id],
          )
        }
      }
      await client.query(
        "UPDATE orders SET status = 'paid', payment_gateway = 'simulation' WHERE id = $1",
        [id],
      )
      const paidOrder = await loadOrder(client, id, req.user.id)
      await client.query('COMMIT')
      return res.json(paidOrder)
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK')
        } catch (rollbackError) {
          console.error('Could not roll back simulated payment:', rollbackError.message)
        }
      }
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
      if (error.code === '23503') return res.status(409).json({ message: 'Não foi possível ativar a assinatura deste pedido.' })
      console.error('Could not simulate customer payment:', error.message)
      return res.status(500).json({ message: 'Não foi possível registrar o pagamento simulado.' })
    } finally {
      client?.release()
    }
  })

  return router
}

module.exports = createOrdersRouter
