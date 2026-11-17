require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const createProductsRouter = require('./routes/products')
const createStorefrontRouter = require('./routes/storefront')
const createSubscriptionRouters = require('./routes/subscriptions')
const createQuizRouter = require('./routes/quiz')
const createAuthRouter = require('./routes/auth')
const createAddressesRouter = require('./routes/addresses')
const createShippingRouter = require('./routes/shipping')
const createOrdersRouter = require('./routes/orders')
const createMercadoPagoWebhooksRouter = require('./routes/mercadopago-webhooks')

const app = express()
const port = process.env.PORT || 3000
const authSecret = process.env.AUTH_TOKEN_SECRET
const secureCookies = process.env.NODE_ENV === 'production'
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173'

function isAllowedCorsOrigin(origin) {
  if (!origin) return true
  if (origin === frontendOrigin) return true
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname.endsWith('.devtunnels.ms')
  } catch {
    return false
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedCorsOrigin(origin) ? origin || true : false)
  },
  credentials: true,
}))
app.use(express.json())
app.use('/webhooks/mercadopago', createMercadoPagoWebhooksRouter(pool))
if (!authSecret || authSecret.length < 32) {
  throw new Error('Configure AUTH_TOKEN_SECRET com pelo menos 32 caracteres.')
}
const { requireAuth, requireAdmin } = createAuthRouter.createAuthMiddleware(pool, authSecret, secureCookies)
app.use('/auth', createAuthRouter(pool, authSecret, secureCookies))
app.use('/vitrine', createStorefrontRouter(pool))
app.use('/produtos', requireAuth, createProductsRouter(pool, requireAdmin))
app.use('/quiz', createQuizRouter(pool, requireAuth, requireAdmin))
const subscriptionRouters = createSubscriptionRouters(pool)
app.use('/planos', requireAuth, requireAdmin, subscriptionRouters.plans)
app.use('/assinaturas', requireAuth, requireAdmin, subscriptionRouters.subscriptions)
app.use('/subscriptions', requireAuth, subscriptionRouters.customers)
app.use('/addresses', requireAuth, createAddressesRouter(pool))
app.use('/shipping', createShippingRouter(pool))
app.use('/orders', requireAuth, createOrdersRouter(pool))

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
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS taste_profile JSONB')
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_created_idx
    ON password_reset_tokens (user_id, created_at)
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
      acidity NUMERIC(3,1) CHECK (acidity BETWEEN 0 AND 10),
      bitterness NUMERIC(3,1) CHECK (bitterness BETWEEN 0 AND 10),
      sweetness NUMERIC(3,1) CHECK (sweetness BETWEEN 0 AND 10),
      stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `)
  await pool.query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS acidity NUMERIC(3,1) CHECK (acidity BETWEEN 0 AND 10),
      ADD COLUMN IF NOT EXISTS bitterness NUMERIC(3,1) CHECK (bitterness BETWEEN 0 AND 10),
      ADD COLUMN IF NOT EXISTS sweetness NUMERIC(3,1) CHECK (sweetness BETWEEN 0 AND 10)
  `)
}

async function ensureAddressesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS addresses (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cep CHAR(8) NOT NULL,
      street VARCHAR(200) NOT NULL,
      number VARCHAR(20) NOT NULL,
      complement VARCHAR(100),
      neighborhood VARCHAR(100) NOT NULL,
      city VARCHAR(100) NOT NULL,
      state CHAR(2) NOT NULL
    )
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id)')
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
  await pool.query("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS description TEXT")
  await pool.query("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) NOT NULL DEFAULT 'mensal'")
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscription_plans' AND column_name = 'weight_grams'
      ) THEN
        ALTER TABLE subscription_plans ALTER COLUMN weight_grams DROP NOT NULL;
      END IF;
    END;
    $$;
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
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      plan_id INT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
      address_id INT REFERENCES addresses(id) ON DELETE SET NULL,
      grind VARCHAR(50),
      frequency VARCHAR(20),
      status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'ativa', 'pausada', 'cancelada')),
      started_at DATE NOT NULL DEFAULT CURRENT_DATE,
      next_renewal DATE,
      canceled_at TIMESTAMPTZ,
      shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
      billing_amount NUMERIC(10,2),
      shipping_method VARCHAR(10),
      shipping_recipient VARCHAR(150),
      shipping_phone VARCHAR(20),
      mercadopago_plan_id VARCHAR(100),
      mercadopago_preapproval_id VARCHAR(100),
      mercadopago_checkout_url VARCHAR(1000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    ALTER TABLE customer_subscriptions
      ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS billing_amount NUMERIC(10,2),
      ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(10),
      ADD COLUMN IF NOT EXISTS shipping_recipient VARCHAR(150),
      ADD COLUMN IF NOT EXISTS shipping_phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS mercadopago_plan_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS mercadopago_preapproval_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS mercadopago_checkout_url VARCHAR(1000)
  `)
  await pool.query('ALTER TABLE customer_subscriptions DROP CONSTRAINT IF EXISTS customer_subscriptions_status_check')
  await pool.query(`
    ALTER TABLE customer_subscriptions
      ADD CONSTRAINT customer_subscriptions_status_check
      CHECK (status IN ('pendente', 'ativa', 'pausada', 'cancelada'))
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS customer_subscriptions_mercadopago_plan_idx
    ON customer_subscriptions (mercadopago_plan_id)
    WHERE mercadopago_plan_id IS NOT NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS customer_subscriptions_mercadopago_preapproval_idx
    ON customer_subscriptions (mercadopago_preapproval_id)
    WHERE mercadopago_preapproval_id IS NOT NULL
  `)
  await pool.query('ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE')
  await pool.query('ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS address_id INT REFERENCES addresses(id) ON DELETE SET NULL')
  await pool.query('ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS grind VARCHAR(50)')
  await pool.query('ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS frequency VARCHAR(20)')
  await pool.query('ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ')
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'customer_subscriptions_user_id_fkey'
          AND conrelid = 'customer_subscriptions'::regclass
      ) THEN
        ALTER TABLE customer_subscriptions
          ADD CONSTRAINT customer_subscriptions_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'customer_subscriptions_address_id_fkey'
          AND conrelid = 'customer_subscriptions'::regclass
      ) THEN
        ALTER TABLE customer_subscriptions
          ADD CONSTRAINT customer_subscriptions_address_id_fkey
          FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL NOT VALID;
      END IF;
    END;
    $$;
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS idx_subs_user ON customer_subscriptions(user_id)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_subs_status ON customer_subscriptions(status)')
}

async function ensureOrderTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      address_id INT REFERENCES addresses(id) ON DELETE SET NULL,
      shipping_address JSONB NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
      shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
      total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
      status VARCHAR(15) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'canceled')),
      payment_gateway VARCHAR(15) CHECK (payment_gateway IN ('stripe', 'mercadopago', 'simulation')),
      gateway_payment_id VARCHAR(100) UNIQUE,
      gateway_preference_id VARCHAR(100),
      gateway_checkout_url VARCHAR(1000),
      tracking_code VARCHAR(60),
      label_url VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_id INT REFERENCES addresses(id) ON DELETE SET NULL')
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_preference_id VARCHAR(100)')
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_checkout_url VARCHAR(1000)')
  await pool.query('ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS checkout_order_id INT REFERENCES orders(id) ON DELETE SET NULL')
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS orders_gateway_preference_id_idx
    ON orders (gateway_preference_id)
    WHERE gateway_preference_id IS NOT NULL
  `)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'orders_address_id_fkey' AND conrelid = 'orders'::regclass
      ) THEN
        ALTER TABLE orders
          ADD CONSTRAINT orders_address_id_fkey
          FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL NOT VALID;
      END IF;
    END;
    $$;
  `)
  await pool.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_gateway_check')
  await pool.query(`
    ALTER TABLE orders ADD CONSTRAINT orders_payment_gateway_check
    CHECK (payment_gateway IS NULL OR payment_gateway IN ('stripe', 'mercadopago', 'simulation'))
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id),
      plan_id INT REFERENCES subscription_plans(id),
      subscription_id INT REFERENCES customer_subscriptions(id),
      batch_id INT,
      grind VARCHAR(50),
      frequency VARCHAR(20),
      quantity INT NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
      is_recurring BOOLEAN NOT NULL DEFAULT FALSE
    )
  `)
  await pool.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS plan_id INT REFERENCES subscription_plans(id)')
  await pool.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS frequency VARCHAR(20)')
  await pool.query('ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_subscription_id_fkey')
  await pool.query(`
    ALTER TABLE order_items ADD CONSTRAINT order_items_subscription_id_fkey
    FOREIGN KEY (subscription_id) REFERENCES customer_subscriptions(id) NOT VALID
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)')
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
  .then(ensureAddressesTable)
  .then(ensureSubscriptionTables)
  .then(ensureOrderTables)
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
