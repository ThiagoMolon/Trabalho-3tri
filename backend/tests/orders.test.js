const { test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const createOrdersRouter = require('../routes/orders')

test('order creation calculates totals from the catalog and decrements stock transactionally', async () => {
  const statements = []
  let order
  let orderItem
  const client = {
    async query(sql, values = []) {
      statements.push(sql)
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] }
      if (sql.includes('SELECT weight_grams FROM products')) {
        return { rowCount: 1, rows: [{ weight_grams: 250 }] }
      }
      if (sql.includes('FROM products WHERE id = $1 FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: 3, name: 'Café Teste', price: '20.00', stock: 4, active: true }] }
      }
      if (sql.includes('INSERT INTO orders')) {
        order = {
          id: 12,
          status: 'pending',
          shipping_address: JSON.parse(values[2]),
          subtotal: values[3],
          shipping_cost: values[4],
          total: values[5],
          tracking_code: null,
          created_at: new Date().toISOString(),
        }
        return { rowCount: 1, rows: [{ id: order.id }] }
      }
      if (sql.includes('INSERT INTO order_items')) {
        orderItem = {
          id: 20,
          product_id: values[1],
          plan_id: values[2],
          grind: values[3],
          frequency: values[4],
          quantity: values[5],
          unit_price: values[6],
          is_recurring: values[7],
          name: 'Café Teste',
        }
        return { rowCount: 1, rows: [] }
      }
      if (sql.includes('FROM orders WHERE id = $1 AND user_id = $2')) {
        return { rowCount: 1, rows: [order] }
      }
      if (sql.includes('FROM order_items AS item')) return { rowCount: 1, rows: [orderItem] }
      return { rowCount: 1, rows: [] }
    },
    release() {},
  }
  const pool = {
    connect: async () => client,
  }
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { req.user = { id: 9 }; next() })
  app.use('/orders', createOrdersRouter(pool))
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ product_id: 3, quantity: 1, grind: 'Moagem média' }],
        shipping_method: 'pac',
        shipping_address: {
          recipient: 'Cliente',
          phone: '48999990000',
          cep: '89000000',
          street: 'Rua A',
          number: '1',
          neighborhood: 'Centro',
          city: 'Videira',
          state: 'SC',
        },
      }),
    })
    const body = await response.json()

    assert.equal(response.status, 201, body.message)
    assert.equal(body.status, 'pending')
    assert.equal(Number(body.subtotal), 20)
    assert.equal(Number(body.shipping_cost), 17.9)
    assert.equal(Number(body.total), 37.9)
    assert.equal(body.items[0].name, 'Café Teste')
    assert.ok(statements.includes('BEGIN'))
    assert.ok(statements.includes('COMMIT'))
    assert.ok(statements.some((sql) => sql.includes('UPDATE products SET stock = stock - $1')))
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
