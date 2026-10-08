require('dotenv').config()

const { Pool } = require('pg')

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Uso: npm run promote-admin -- email@exemplo.com')
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('Configure DATABASE_URL no ambiente ou no arquivo .env.')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const result = await pool.query(
      `UPDATE users SET role = 'admin'
       WHERE LOWER(email) = $1
       RETURNING id, name, email, role`,
      [email],
    )
    if (result.rowCount === 0) {
      throw new Error(`Não existe uma conta cadastrada com o e-mail ${email}.`)
    }

    console.log(`Conta promovida para administradora: ${result.rows[0].email}`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
