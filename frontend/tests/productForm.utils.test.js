import { test } from 'node:test'
import assert from 'node:assert/strict'
import { productToForm } from '../src/admin/ProductForm.utils.js'

const product = {
  name: 'Café de teste',
  category: 'graos',
  price: 42,
  stock: 3,
  active: true,
}

test('productToForm formats sensory notes from arrays and serialized arrays', () => {
  assert.equal(productToForm({ ...product, sensory_notes: ['chocolate', 'caramelo'] }).sensory_notes, 'chocolate, caramelo')
  assert.equal(productToForm({ ...product, sensory_notes: '["chocolate","caramelo"]' }).sensory_notes, 'chocolate, caramelo')
})

test('productToForm accepts comma-separated notes and ignores unsupported values', () => {
  assert.equal(productToForm({ ...product, sensory_notes: 'chocolate, caramelo' }).sensory_notes, 'chocolate, caramelo')
  assert.equal(productToForm({ ...product, sensory_notes: null }).sensory_notes, '')
  assert.equal(productToForm({ ...product, sensory_notes: { chocolate: true } }).sensory_notes, '')
})
