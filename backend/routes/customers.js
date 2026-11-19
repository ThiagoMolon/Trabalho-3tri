const express = require('express')

function getTasteLabel(profile) {
  if (!profile) return '—'
  const tasteProfile = typeof profile === 'string' ? JSON.parse(profile) : profile
  const parts = []
  if (tasteProfile.sweetness >= 5) parts.push('doce')
  if (tasteProfile.acidity >= 5) parts.push('ácido')
  if (tasteProfile.bitterness >= 5) parts.push('amargo')
  return parts.length > 0 ? parts.join('/') : 'neutro'
}

function createCustomersRouter(pool) {
  const router = express.Router()

  router.get('/', async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT u.id, u.name, u.email, a.city, a.cep,
               COUNT(o.id)::int AS orders, u.taste_profile, u.created_at
        FROM users AS u
        LEFT JOIN addresses AS a ON a.user_id = u.id
        LEFT JOIN orders AS o ON o.user_id = u.id
        WHERE u.role = 'customer'
        GROUP BY u.id, a.city, a.cep
        ORDER BY u.created_at DESC
        LIMIT 100
      `)
      const rows = result.rows.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        city: customer.city || '—',
        cep: customer.cep || '—',
        orders: customer.orders,
        taste: getTasteLabel(customer.taste_profile),
        createdAt: customer.created_at,
      }))
      return res.json({ count: rows.length, rows })
    } catch (error) {
      console.error('Could not list customers:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar os clientes.' })
    }
  })

  return router
}

module.exports = createCustomersRouter
