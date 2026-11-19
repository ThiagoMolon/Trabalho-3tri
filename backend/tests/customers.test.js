const { test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const createCustomersRouter = require('../routes/customers')

test('customer list returns admin customer details and a taste label', async () => {
  let query
  const pool = {
    async query(sql) {
      query = sql
      return {
        rows: [{
          id: 8,
          name: 'Cliente',
          email: 'cliente@example.test',
          city: 'Videira',
          cep: '89560000',
          orders: 2,
          taste_profile: { sweetness: 7, acidity: 5, bitterness: 2 },
          created_at: '2026-01-01T12:00:00.000Z',
        }],
      }
    },
  }
  const app = express()
  app.use('/customers', createCustomersRouter(pool))
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/customers`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.match(query, /WHERE u\.role = 'customer'/)
    assert.equal(body.count, 1)
    assert.deepEqual(body.rows[0], {
      id: 8,
      name: 'Cliente',
      email: 'cliente@example.test',
      city: 'Videira',
      cep: '89560000',
      orders: 2,
      taste: 'doce/ácido',
      createdAt: '2026-01-01T12:00:00.000Z',
    })
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
})
