const express = require('express')
const { getShippingOptions } = require('../services/commerce')

function createShippingRouter(pool) {
  const router = express.Router()

  router.post('/calculate', async (req, res) => {
    try {
      return res.json(await getShippingOptions(pool, req.body?.cep, req.body?.items))
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
      console.error('Could not calculate shipping:', error.message)
      return res.status(500).json({ message: 'Não foi possível calcular o frete.' })
    }
  })

  return router
}

module.exports = createShippingRouter
