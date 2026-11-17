const { test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const createProductsRouter = require('../routes/products')

async function withProductServer(pool, run) {
  const app = express()
  app.use(express.json())
  app.use('/produtos', createProductsRouter(pool, (_req, _res, next) => next()))
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    await run(`http://127.0.0.1:${server.address().port}/produtos`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

const coffeePayload = {
  name: 'Café de teste',
  category: 'graos',
  price: 42,
  stock: 3,
  active: true,
  acidity: 7.5,
  bitterness: 3,
  sweetness: 8,
}

test('coffee creation persists sensory scores on the 0–10 scale', async () => {
  let insertedValues
  const pool = {
    async query(sql, values) {
      assert.match(sql, /acidity, bitterness, sweetness, stock, active/)
      insertedValues = values
      return { rowCount: 1, rows: [{ id: 1, name: coffeePayload.name }] }
    },
  }

  await withProductServer(pool, async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coffeePayload),
    })
    assert.equal(response.status, 201)
  })

  assert.deepEqual(insertedValues.slice(12, 15), [7.5, 3, 8])
})

test('coffee sensory scores outside 0–10 are rejected', async () => {
  let queryCalled = false
  const pool = {
    async query() {
      queryCalled = true
      return { rowCount: 0, rows: [] }
    },
  }

  await withProductServer(pool, async (url) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...coffeePayload, acidity: 10.1 }),
    })
    const body = await response.json()
    assert.equal(response.status, 400)
    assert.match(body.message, /acidez.*0 e 10/i)
  })

  assert.equal(queryCalled, false)
})
