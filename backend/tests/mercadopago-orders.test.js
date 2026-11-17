const { test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const createOrdersRouter = require('../routes/orders')

test('reuses the saved Mercado Pago checkout URL for a pending order', async () => {
  const statements = []
  const client = {
    async query(sql) {
      statements.push(sql)
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rowCount: 0, rows: [] }
      }
      if (sql.includes('FROM orders WHERE id = $1 AND user_id = $2')) {
        return {
          rowCount: 1,
          rows: [{
            id: 12,
            status: 'pending',
            shipping_address: {},
            subtotal: '20.00',
            shipping_cost: '17.90',
            total: '37.90',
            payment_gateway: 'mercadopago',
            gateway_preference_id: 'preference-12',
            gateway_checkout_url: 'https://www.mercadopago.com/checkout/saved',
          }],
        }
      }
      if (sql.includes('FROM order_items')) {
        return { rowCount: 1, rows: [{ id: 1, is_recurring: false }] }
      }
      return { rowCount: 0, rows: [] }
    },
    release() {},
  }
  const pool = { connect: async () => client }
  let providerCalls = 0
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: 8, email: 'buyer@example.com' }
    next()
  })
  app.use('/orders', createOrdersRouter(pool, {
    environment: { MP_ACCESS_TOKEN: 'TEST-token' },
    fetchImpl: async () => {
      providerCalls += 1
      throw new Error('Stored preferences must not be recreated.')
    },
  }))
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/orders/12/mercadopago-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.init_point, 'https://www.mercadopago.com/checkout/saved')
    assert.equal(providerCalls, 0)
    assert.ok(statements.includes('COMMIT'))
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
