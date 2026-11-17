const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const express = require('express')
const {
  createOrderPreference,
  createSubscriptionPlan,
  verifyWebhookSignature,
} = require('../services/mercadopago')
const createMercadoPagoWebhooksRouter = require('../routes/mercadopago-webhooks')

const environment = {
  FRONTEND_URL: 'https://trabalho-3tri.pages.dev',
  MP_ACCESS_TOKEN: 'TEST-token',
  MP_WEBHOOK_SECRET: 'webhook-secret',
}

test('creates a Mercado Pago preference using server-calculated order values', async () => {
  let requestUrl
  let requestBody
  const initPoint = 'https://sandbox.mercadopago.com/checkout/test'
  const result = await createOrderPreference({
    id: 12,
    shipping_cost: '17.90',
    items: [{
      product_id: 3,
      name: 'Café Teste',
      quantity: 1,
      unit_price: '20.00',
    }],
  }, 'buyer@example.com', 8, {
    environment,
    fetchImpl: async (url, options) => {
      requestUrl = url
      requestBody = JSON.parse(options.body)
      return new Response(JSON.stringify({
        id: 'preference-12',
        init_point: 'https://www.mercadopago.com/checkout/live',
        sandbox_init_point: initPoint,
      }), { status: 201 })
    },
  })

  assert.equal(result.initPoint, initPoint)
  assert.equal(requestUrl, 'https://api.mercadopago.com/checkout/preferences')
  assert.equal(requestBody.external_reference, '12')
  assert.equal(requestBody.payer.email, 'buyer@example.com')
  assert.equal(requestBody.notification_url, 'https://trabalho-3tri.pages.dev/webhooks/mercadopago')
  assert.equal(requestBody.back_urls.success, 'https://trabalho-3tri.pages.dev/confirmacao/12?subscription_id=8')
  assert.deepEqual(requestBody.items.map(({ title, quantity, unit_price }) => ({ title, quantity, unit_price })), [
    { title: 'Café Teste', quantity: 1, unit_price: 20 },
    { title: 'Frete', quantity: 1, unit_price: 17.9 },
  ])
})

test('creates an automatic subscription plan with Mercado Pago frequency units', async () => {
  let requestBody
  const result = await createSubscriptionPlan({
    name: 'Plano semanal',
    frequency: 'semanal',
    amount: 25.9,
    backUrl: 'https://trabalho-3tri.pages.dev/confirmacao/assinatura/4',
  }, {
    environment,
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body)
      return new Response(JSON.stringify({
        id: 'plan-4',
        init_point: 'https://www.mercadopago.com/subscriptions/checkout/4',
      }), { status: 201 })
    },
  })

  assert.equal(result.id, 'plan-4')
  assert.equal(requestBody.auto_recurring.frequency, 7)
  assert.equal(requestBody.auto_recurring.frequency_type, 'days')
  assert.equal(requestBody.auto_recurring.transaction_amount, 25.9)
  assert.equal(requestBody.auto_recurring.currency_id, 'BRL')
})

test('validates Mercado Pago webhook signatures with the documented manifest', () => {
  const manifest = 'id:12345;request-id:req-1;ts:1742505638683;'
  const signature = crypto.createHmac('sha256', environment.MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex')

  assert.equal(verifyWebhookSignature({
    signature: `ts=1742505638683,v1=${signature}`,
    requestId: 'req-1',
    dataId: '12345',
    secret: environment.MP_WEBHOOK_SECRET,
  }), true)
  assert.equal(verifyWebhookSignature({
    signature: `ts=1742505638683,v1=${signature}`,
    requestId: 'other-request',
    dataId: '12345',
    secret: environment.MP_WEBHOOK_SECRET,
  }), false)
})

test('only a signed and approved Mercado Pago payment marks its order as paid', async () => {
  const statements = []
  let updateValues
  const client = {
    async query(sql, values = []) {
      statements.push(sql)
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] }
      if (sql.includes('FROM orders WHERE id = $1 FOR UPDATE')) {
        return {
          rowCount: 1,
          rows: [{
            id: 12,
            status: 'pending',
            total: '37.90',
            payment_gateway: 'mercadopago',
            gateway_payment_id: null,
          }],
        }
      }
      if (sql.includes("UPDATE orders SET status = 'paid'")) updateValues = values
      return { rowCount: 1, rows: [] }
    },
    release() {},
  }
  const pool = { connect: async () => client }
  const app = express()
  app.use(express.json())
  app.use('/webhooks/mercadopago', createMercadoPagoWebhooksRouter(pool, {
    environment,
    fetchImpl: async () => new Response(JSON.stringify({
      id: 12345,
      status: 'approved',
      currency_id: 'BRL',
      external_reference: '12',
      transaction_amount: '37.90',
    }), { status: 200 }),
  }))
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    const requestId = 'payment-request-1'
    const dataId = '12345'
    const manifest = `id:${dataId};request-id:${requestId};ts:1000;`
    const signature = crypto.createHmac('sha256', environment.MP_WEBHOOK_SECRET)
      .update(manifest)
      .digest('hex')
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/webhooks/mercadopago?data.id=${dataId}&type=payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
          'x-signature': `ts=1000,v1=${signature}`,
        },
        body: JSON.stringify({ type: 'payment', data: { id: dataId } }),
      },
    )

    assert.equal(response.status, 200)
    assert.ok(statements.includes('BEGIN'))
    assert.ok(statements.includes('COMMIT'))
    assert.deepEqual(updateValues, ['12345', 12])
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
