const express = require('express')

function createStorefrontRouter(pool) {
  const router = express.Router()

  router.get('/produtos', async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, name, category, description, price, weight_grams, image_url,
          origin, producer, altitude, variety, score, sensory_notes,
          (stock > 0) AS in_stock
        FROM products
        WHERE active = TRUE
        ORDER BY name ASC, id ASC
      `)
      return res.json(result.rows)
    } catch (error) {
      console.error('Could not list storefront products:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar os cafés.' })
    }
  })

  router.get('/planos', async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT plan.id, plan.name, plan.description, plan.price, plan.frequency,
          COALESCE(json_agg(json_build_object('id', product.id, 'name', product.name))
            FILTER (WHERE product.id IS NOT NULL), '[]'::JSON) AS products
        FROM subscription_plans AS plan
        LEFT JOIN subscription_plan_products AS link ON link.plan_id = plan.id
        LEFT JOIN products AS product ON product.id = link.product_id AND product.active = TRUE
        WHERE plan.active = TRUE
        GROUP BY plan.id
        ORDER BY plan.price ASC, plan.id ASC
      `)
      return res.json(result.rows)
    } catch (error) {
      console.error('Could not list storefront plans:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar os planos.' })
    }
  })

  return router
}

module.exports = createStorefrontRouter
