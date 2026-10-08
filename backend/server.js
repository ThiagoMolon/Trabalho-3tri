require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const createProductsRouter = require('./routes/products')
const createSubscriptionRouters = require('./routes/subscriptions')
const createQuizRouter = require('./routes/quiz')
const createAuthRouter = require('./routes/auth')

const app = express()
const port = process.env.PORT || 3000
const authSecret = process.env.AUTH_TOKEN_SECRET
const secureCookies = process.env.NODE_ENV === 'production'
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

app.use(cors({ origin: frontendOrigin, credentials: true }))
app.use(express.json())
if (!authSecret || authSecret.length < 32) {
  throw new Error('Configure AUTH_TOKEN_SECRET com pelo menos 32 caracteres.')
}
const { requireAuth, requireAdmin } = createAuthRouter.createAuthMiddleware(pool, authSecret, secureCookies)
app.use('/auth', createAuthRouter(pool, authSecret, secureCookies))
app.use('/produtos', requireAuth, createProductsRouter(pool, requireAdmin))
app.use('/quiz', createQuizRouter(pool, requireAuth, requireAdmin))
const subscriptionRouters = createSubscriptionRouters(pool)
app.use('/planos', requireAuth, requireAdmin, subscriptionRouters.plans)
app.use('/assinaturas', requireAuth, requireAdmin, subscriptionRouters.subscriptions)

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      role VARCHAR(10) NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'admin')),
      taste_profile JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
}

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

async function ensureQuizTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id SERIAL PRIMARY KEY,
      text VARCHAR(300) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_options (
      id SERIAL PRIMARY KEY,
      question_id INT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
      text VARCHAR(300) NOT NULL,
      acidity_weight INT NOT NULL DEFAULT 0,
      bitterness_weight INT NOT NULL DEFAULT 0,
      sweetness_weight INT NOT NULL DEFAULT 0
    )
  `)

  const existing = await pool.query('SELECT EXISTS (SELECT 1 FROM quiz_questions) AS has_questions')
  if (existing.rows[0].has_questions) return

  const questions = [
    {
      text: 'Como você prefere a acidez do seu café?',
      options: [
        { text: 'Suave e delicada', weights: [2, 4, 7] },
        { text: 'Equilibrada e presente', weights: [5, 4, 6] },
        { text: 'Vibrante e frutada', weights: [9, 4, 6] },
      ],
    },
    {
      text: 'Qual nível de amargor combina mais com você?',
      options: [
        { text: 'Quase nenhum, prefiro leveza', weights: [5, 1, 8] },
        { text: 'Um toque para equilibrar', weights: [5, 5, 6] },
        { text: 'Marcante, como chocolate amargo', weights: [4, 9, 4] },
      ],
    },
    {
      text: 'Que intensidade de doçura você procura?',
      options: [
        { text: 'Doçura sutil', weights: [5, 5, 3] },
        { text: 'Notas doces de caramelo', weights: [5, 4, 7] },
        { text: 'Bem doce e naturalmente frutado', weights: [7, 3, 10] },
      ],
    },
  ]

  for (const [index, question] of questions.entries()) {
    const inserted = await pool.query(
      'INSERT INTO quiz_questions (text, sort_order) VALUES ($1, $2) RETURNING id',
      [question.text, index],
    )
    for (const option of question.options) {
      await pool.query(
        `INSERT INTO quiz_options (
          question_id, text, acidity_weight, bitterness_weight, sweetness_weight
        ) VALUES ($1, $2, $3, $4, $5)`,
        [inserted.rows[0].id, option.text, ...option.weights],
      )
    }
  }
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

ensureUsersTable()
  .then(ensureProductsTable)
  .then(ensureSubscriptionTables)
  .then(ensureQuizTables)
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on port ${port}`)
    })
  })
  .catch((error) => {
    console.error('Could not initialize products table:', error.message)
    process.exit(1)
  })
