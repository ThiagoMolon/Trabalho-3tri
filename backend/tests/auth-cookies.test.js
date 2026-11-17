const { test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const bcrypt = require('bcryptjs')
const createAuthRouter = require('../routes/auth')

const user = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  phone: null,
  role: 'customer',
  auth_version: 0,
  password_hash: bcrypt.hashSync('correct-password', 4),
}

async function withAuthServer(secureCookies, run) {
  const app = express()
  const pool = {
    async query() {
      return { rows: [user], rowCount: 1 }
    },
  }
  app.use(express.json())
  app.use('/auth', createAuthRouter(pool, 'test-secret-that-is-at-least-32-chars', secureCookies))
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    await run(`http://127.0.0.1:${server.address().port}/auth`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

test('production session cookies are secure and same-site', async () => {
  await withAuthServer(true, async (authUrl) => {
    const response = await fetch(`${authUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'correct-password' }),
    })
    const cookie = response.headers.get('set-cookie')

    assert.equal(response.status, 200)
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Lax/)
    assert.match(cookie, /Secure/)

    const logout = await fetch(`${authUrl}/logout`, { method: 'POST' })
    const clearedCookie = logout.headers.get('set-cookie')
    assert.equal(logout.status, 204)
    assert.match(clearedCookie, /SameSite=Lax/)
    assert.match(clearedCookie, /Secure/)
  })
})

test('local session cookies remain Lax and do not require HTTPS', async () => {
  await withAuthServer(false, async (authUrl) => {
    const response = await fetch(`${authUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'correct-password' }),
    })
    const cookie = response.headers.get('set-cookie')

    assert.equal(response.status, 200)
    assert.match(cookie, /SameSite=Lax/)
    assert.doesNotMatch(cookie, /Secure/)
  })
})
