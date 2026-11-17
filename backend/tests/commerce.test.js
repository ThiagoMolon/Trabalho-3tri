const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  getShippingOptions,
  readItems,
  validateAddress,
} = require('../services/commerce')

test('checkout items are normalized using server-owned identifiers and quantities', () => {
  assert.deepEqual(readItems([
    { product_id: '4', quantity: '2', grind: 'Moagem média' },
    { item_type: 'subscription', plan_id: 7, quantity: 1, grind: 'Grãos inteiros', frequency: 'quinzenal' },
  ]), [
    { itemType: 'product', productId: 4, quantity: 2, grind: 'Moagem média', frequency: null },
    { itemType: 'subscription', planId: 7, quantity: 1, grind: 'Grãos inteiros', frequency: 'quinzenal' },
  ])
})

test('checkout validation rejects invalid quantities and incomplete addresses', () => {
  assert.throws(() => readItems([{ product_id: 1, quantity: 0, grind: 'Fina' }]), /quantidade/i)
  assert.throws(() => validateAddress({ cep: '1234', street: 'Rua' }), /endereço|cep/i)
})

test('shipping quotes are calculated from catalog weight and CEP zone', async () => {
  const pool = {
    async query(sql) {
      assert.match(sql, /FROM products/)
      return { rowCount: 1, rows: [{ weight_grams: 250 }] }
    },
  }
  const nearQuote = await getShippingOptions(pool, '89000000', [
    { product_id: 1, quantity: 2, grind: 'Grãos inteiros' },
  ])
  const otherQuote = await getShippingOptions(pool, '40000000', [
    { product_id: 1, quantity: 2, grind: 'Grãos inteiros' },
  ])

  assert.equal(nearQuote.weight_grams, 500)
  assert.deepEqual(nearQuote.options.map(({ id, cost, min_days, max_days }) => ({ id, cost, min_days, max_days })), [
    { id: 'pac', cost: 17.9, min_days: 7, max_days: 10 },
    { id: 'sedex', cost: 29.9, min_days: 2, max_days: 4 },
  ])
  assert.equal(otherQuote.options[0].cost, 27.9)
})
