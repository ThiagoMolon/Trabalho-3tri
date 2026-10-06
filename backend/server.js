require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const createProductsRouter = require('./routes/products')
const createSubscriptionRouters = require('./routes/subscriptions')

const app = express()
const port = process.env.PORT || 3000

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

app.use(cors())
app.use(express.json())
app.use('/produtos', createProductsRouter(pool))
const subscriptionRouters = createSubscriptionRouters(pool)
app.use('/planos', subscriptionRouters.plans)
app.use('/assinaturas', subscriptionRouters.subscriptions)

async function ensureProductsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category VARCHAR(20) NOT NULL
        CHECK (category IN ('graos', 'moidos', 'acessorios', 'kits')),
      description TEXT,
      price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
      weight_grams INT,
      image_url VARCHAR(500),
      origin VARCHAR(150),
      producer VARCHAR(150),
      altitude INT,
      variety VARCHAR(100),
      score NUMERIC(4,1),
      sensory_notes TEXT[],
      stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `)
}

async function ensureSubscriptionTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
      frequency VARCHAR(20) NOT NULL
        CHECK (frequency IN ('semanal', 'mensal', 'bimestral')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_plan_products (
      plan_id INT NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
      product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      PRIMARY KEY (plan_id, product_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_subscriptions (
      id SERIAL PRIMARY KEY,
      customer_name VARCHAR(200) NOT NULL,
      customer_email VARCHAR(254) NOT NULL,
      plan_id INT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
      status VARCHAR(20) NOT NULL CHECK (status IN ('ativa', 'pausada', 'cancelada')),
      started_at DATE NOT NULL DEFAULT CURRENT_DATE,
      next_renewal DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

app.get('/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW()')
    res.json({
      status: 'ok',
      databaseTime: result.rows[0].now
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    })
  }
})

ensureProductsTable()
  .then(ensureSubscriptionTables)
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on port ${port}`)
    })
  })
  .catch((error) => {
    console.error('Could not initialize products table:', error.message)
    process.exit(1)
  })

