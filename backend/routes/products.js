const express = require('express')

const categories = new Set(['graos', 'moidos', 'acessorios', 'kits'])
const coffeeCategories = new Set(['graos', 'moidos'])

function optionalNumber(value, field, integer = false) {
  if (value === undefined || value === null || value === '') return null

  const number = Number(value)
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number))) {
    throw new Error(`O campo ${field} deve ser ${integer ? 'um número inteiro' : 'um número válido'}.`)
  }

  return number
}

function buildProductValues(body) {
  const {
    name,
    category,
    description,
    price,
    weight_grams,
    image_url,
    origin,
    producer,
    altitude,
    variety,
    score,
    sensory_notes,
    stock = 0,
    active = true,
  } = body || {}

  if (typeof name !== 'string' || !name.trim() || name.trim().length > 200) {
    throw new Error('Informe um nome com até 200 caracteres.')
  }
  if (!categories.has(category)) {
    throw new Error('Selecione uma categoria válida.')
  }
  if (price === undefined || price === null || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) {
    throw new Error('Informe um preço válido, igual ou maior que zero.')
  }
  if (typeof active !== 'boolean') {
    throw new Error('O campo ativo deve ser verdadeiro ou falso.')
  }

  const isCoffee = coffeeCategories.has(category)
  const notes = isCoffee ? sensory_notes ?? [] : []
  if (!Array.isArray(notes) || notes.some((note) => typeof note !== 'string')) {
    throw new Error('As notas sensoriais devem ser uma lista de textos.')
  }

  const weight = optionalNumber(weight_grams, 'peso', true)
  const coffeeAltitude = isCoffee ? optionalNumber(altitude, 'altitude', true) : null
  const coffeeScore = isCoffee ? optionalNumber(score, 'nota') : null
  const stockCount = optionalNumber(stock, 'estoque', true)

  if (weight !== null && weight < 0) throw new Error('O peso não pode ser negativo.')
  if (coffeeAltitude !== null && coffeeAltitude < 0) throw new Error('A altitude não pode ser negativa.')
  if (stockCount === null || stockCount < 0) throw new Error('O estoque deve ser um número inteiro igual ou maior que zero.')

  return [
    name.trim(),
    category,
    description || null,
    Number(price),
    weight,
    image_url || null,
    isCoffee ? origin || null : null,
    isCoffee ? producer || null : null,
    coffeeAltitude,
    isCoffee ? variety || null : null,
    coffeeScore,
    notes.map((note) => note.trim()).filter(Boolean),
    stockCount,
    active,
  ]
}

function createProductsRouter(pool, requireAdmin) {
  const router = express.Router()

  router.use(requireAdmin)

  router.get('/', async (_req, res) => {
    try {
      const result = await pool.query('SELECT * FROM products ORDER BY name ASC, id ASC')
      return res.json(result.rows)
    } catch (error) {
      console.error('Could not list products:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar os produtos.' })
    }
  })

  router.post('/', async (req, res) => {
    try {
      const result = await pool.query(
        `INSERT INTO products (
          name, category, description, price, weight_grams, image_url,
          origin, producer, altitude, variety, score, sensory_notes, stock, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, name, category, price, stock, active`,
        buildProductValues(req.body),
      )

      return res.status(201).json(result.rows[0])
    } catch (error) {
      if (error instanceof Error && !error.code) {
        return res.status(400).json({ message: error.message })
      }
      console.error('Could not create product:', error.message)
      return res.status(500).json({ message: 'Não foi possível salvar o produto.' })
    }
  })

  router.put('/:id', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'Identificador de produto inválido.' })
    }

    try {
      const result = await pool.query(
        `UPDATE products SET
          name = $1, category = $2, description = $3, price = $4,
          weight_grams = $5, image_url = $6, origin = $7, producer = $8,
          altitude = $9, variety = $10, score = $11, sensory_notes = $12,
          stock = $13, active = $14
        WHERE id = $15
        RETURNING id, name, category, price, stock, active`,
        [...buildProductValues(req.body), id],
      )

      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Produto não encontrado.' })
      }
      return res.json(result.rows[0])
    } catch (error) {
      if (error instanceof Error && !error.code) {
        return res.status(400).json({ message: error.message })
      }
      console.error('Could not update product:', error.message)
      return res.status(500).json({ message: 'Não foi possível atualizar o produto.' })
    }
  })

  router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'Identificador de produto inválido.' })
    }

    try {
      const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id])
      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Produto não encontrado.' })
      }
      return res.status(204).end()
    } catch (error) {
      console.error('Could not delete product:', error.message)
      return res.status(500).json({ message: 'Não foi possível excluir o produto.' })
    }
  })

  return router
}

module.exports = createProductsRouter