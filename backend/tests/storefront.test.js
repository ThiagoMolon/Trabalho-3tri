const { test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const createStorefrontRouter = require('../routes/storefront')

test('public coffee listing includes sensory scores for quiz filtering', async () => {
  const coffee = {
    id: 1,
    name: 'Café de teste',
    category: 'graos',
    acidity: '7.5',
    bitterness: '3.0',
    sweetness: '8.0',
  }
  const pool = {
    async query(sql) {
      assert.match(sql, /acidity, bitterness, sweetness/)
      return { rows: [coffee] }
    },
  }
  const app = express()
  app.use('/vitrine', createStorefrontRouter(pool))
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/vitrine/produtos`)
    const products = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(products[0], coffee)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
})
