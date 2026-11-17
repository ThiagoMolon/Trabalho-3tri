const { test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const createSubscriptionRouters = require('../routes/subscriptions')

test('creates a recurring Mercado Pago plan with the saved delivery charge', async () => {
  const environment = {
    FRONTEND_URL: 'https://trabalho-3tri.pages.dev',
    MP_ACCESS_TOKEN: 'TEST-token',
  }
  const statements = []
  let insertedSubscription
  let providerPlan
  const pool = {
    async query(sql, values = []) {
      statements.push(sql)
      if (sql.includes('SELECT id, name, price FROM subscription_plans')) {
        return { rowCount: 1, rows: [{ id: 4, name: 'Clube da Serra', price: '20.00' }] }
      }
      if (sql.includes('SELECT id, cep FROM addresses')) {
        return { rowCount: 1, rows: [{ id: 11, cep: '89000000' }] }
      }
      if (sql.includes('SELECT id FROM orders')) return { rowCount: 1, rows: [{ id: 19 }] }
      if (sql.includes('SELECT id, mercadopago_checkout_url')) return { rowCount: 0, rows: [] }
      if (sql.includes('SELECT plan.id')) return { rowCount: 1, rows: [{ id: 4, weight_grams: 250 }] }
      if (sql.includes('INSERT INTO customer_subscriptions')) {
        insertedSubscription = values
        return { rowCount: 1, rows: [{ id: 51 }] }
      }
      return { rowCount: 1, rows: [] }
    },
  }
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: 9, name: 'Cliente Teste', email: 'cliente@example.com' }
    next()
  })
  app.use('/subscriptions', createSubscriptionRouters(pool, {
    environment,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.mercadopago.com/preapproval_plan')
      providerPlan = JSON.parse(options.body)
      return new Response(JSON.stringify({
        id: 'plan-51',
        init_point: 'https://www.mercadopago.com/subscriptions/checkout/51',
      }), { status: 201 })
    },
  }).customers)
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/subscriptions/me/mercadopago-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: 4,
        address_id: 11,
        order_id: 19,
        frequency: 'bimestral',
        grind: 'Grãos inteiros',
        shipping_method: 'pac',
        shipping_recipient: 'Cliente Teste',
        shipping_phone: '48999990000',
      }),
    })
    const body = await response.json()

    assert.equal(response.status, 201, body.message)
    assert.equal(body.id, 51)
    assert.equal(body.init_point, 'https://www.mercadopago.com/subscriptions/checkout/51')
    assert.equal(insertedSubscription[7], 17.9)
    assert.equal(insertedSubscription[8], 37.9)
    assert.equal(insertedSubscription[12], 19)
    assert.equal(providerPlan.auto_recurring.frequency, 2)
    assert.equal(providerPlan.auto_recurring.frequency_type, 'months')
    assert.equal(providerPlan.auto_recurring.transaction_amount, 37.9)
    assert.equal(providerPlan.back_url, 'https://trabalho-3tri.pages.dev/pagamento?order_id=19&subscription_id=51')
    assert.ok(statements.some((sql) => sql.includes('shipping_cost, billing_amount')))
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
