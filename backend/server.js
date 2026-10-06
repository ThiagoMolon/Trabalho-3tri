require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const createProductsRouter = require('./routes/products')

const app = express()
const port = process.env.PORT || 3000

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

app.use(cors())
app.use(express.json())
app.use('/produtos', createProductsRouter(pool))

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
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on port ${port}`)
    })
  })
  .catch((error) => {
    console.error('Could not initialize products table:', error.message)
    process.exit(1)
  })

