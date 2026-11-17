import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTasteStoreUrl,
  filterProductsForTaste,
  readTasteProfile,
} from '../src/services/tasteProfile.js'

test('quiz profile links carry all three sensory scores to the store', () => {
  const profile = { acidity: 5, bitterness: 4, sweetness: 8 }
  const url = buildTasteStoreUrl(profile)

  assert.deepEqual(readTasteProfile(url.split('?')[1]), profile)
})

test('taste filtering applies ±1 to each trait and keeps unscored coffees visible', () => {
  const products = [
    { id: 1, category: 'graos', acidity: 6, bitterness: 4, sweetness: 8 },
    { id: 2, category: 'graos', acidity: 6.1, bitterness: 4, sweetness: 8 },
    { id: 3, category: 'moidos', acidity: null, bitterness: null, sweetness: null },
    { id: 4, category: 'acessorios', acidity: null, bitterness: null, sweetness: null },
  ]

  assert.deepEqual(
    filterProductsForTaste(products, { acidity: 5, bitterness: 4, sweetness: 8 }).map(({ id }) => id),
    [1, 3],
  )
})

test('invalid or incomplete taste profiles do not activate storefront filtering', () => {
  assert.equal(readTasteProfile('?acidity=8&bitterness=3'), null)
  assert.equal(readTasteProfile('?acidity=11&bitterness=3&sweetness=7'), null)
})
