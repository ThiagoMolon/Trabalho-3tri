const express = require('express')
const { normalizeCep } = require('../services/commerce')

function validationError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function readAddress(body = {}) {
  const fields = ['street', 'number', 'neighborhood', 'city']
  const address = {}
  for (const field of fields) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      throw validationError('Preencha todos os campos obrigatórios do endereço.')
    }
    address[field] = body[field].trim()
  }
  if (address.street.length > 200 || address.number.length > 20
    || address.neighborhood.length > 100 || address.city.length > 100) {
    throw validationError('Um ou mais campos do endereço excedem o limite permitido.')
  }
  const cep = normalizeCep(body.cep || body.postalCode)
  const state = typeof body.state === 'string' ? body.state.trim().toUpperCase() : ''
  if (!/^\d{8}$/.test(cep)) throw validationError('Informe um CEP válido com 8 números.')
  if (!/^[A-Z]{2}$/.test(state)) throw validationError('Informe a sigla do estado.')
  const complement = typeof body.complement === 'string' ? body.complement.trim() : ''
  if (complement.length > 100) throw validationError('O complemento deve ter até 100 caracteres.')
  return [body.user_id, cep, address.street, address.number, complement || null,
    address.neighborhood, address.city, state]
}

function createAddressesRouter(pool) {
  const router = express.Router()

  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, cep, street, number, complement, neighborhood, city, state
         FROM addresses WHERE user_id = $1 ORDER BY id DESC`,
        [req.user.id],
      )
      return res.json(result.rows)
    } catch (error) {
      console.error('Could not list customer addresses:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar os endereços.' })
    }
  })

  router.post('/', async (req, res) => {
    try {
      const values = readAddress({ ...req.body, user_id: req.user.id })
      const result = await pool.query(
        `INSERT INTO addresses (user_id, cep, street, number, complement, neighborhood, city, state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, cep, street, number, complement, neighborhood, city, state`,
        values,
      )
      return res.status(201).json(result.rows[0])
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
      console.error('Could not create customer address:', error.message)
      return res.status(500).json({ message: 'Não foi possível salvar o endereço.' })
    }
  })

  router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Identificador inválido.' })
    try {
      const result = await pool.query(
        'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, req.user.id],
      )
      if (result.rowCount === 0) return res.status(404).json({ message: 'Endereço não encontrado.' })
      return res.status(204).end()
    } catch (error) {
      if (error.code === '23503') {
        return res.status(409).json({ message: 'Este endereço está vinculado a uma assinatura.' })
      }
      console.error('Could not delete customer address:', error.message)
      return res.status(500).json({ message: 'Não foi possível remover o endereço.' })
    }
  })

  return router
}

module.exports = createAddressesRouter
