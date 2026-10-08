const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const cookieName = 'origin_beans_session'
const tokenLifetimeSeconds = 7 * 24 * 60 * 60

function setSessionCookie(res, token, secure) {
  const secureFlag = secure ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${tokenLifetimeSeconds}${secureFlag}`,
  )
}

function clearSessionCookie(res, secure) {
  const secureFlag = secure ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureFlag}`,
  )
}

function readSessionToken(req) {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null

  const sessionCookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
  return sessionCookie ? sessionCookie.slice(cookieName.length + 1) : null
}

function createAuthMiddleware(pool, secret, secureCookies = false) {
  async function requireAuth(req, res, next) {
    const token = readSessionToken(req)
    if (!token) return res.status(401).json({ message: 'Entre na sua conta para continuar.' })

    let payload
    try {
      payload = jwt.verify(token, secret)
    } catch {
      clearSessionCookie(res, secureCookies)
      return res.status(401).json({ message: 'Sua sessão expirou. Entre novamente.' })
    }

    try {
      const result = await pool.query(
        'SELECT id, name, email, phone, role FROM users WHERE id = $1',
        [Number(payload.sub)],
      )
      if (result.rowCount === 0) {
        clearSessionCookie(res, secureCookies)
        return res.status(401).json({ message: 'Esta conta não está mais disponível.' })
      }
      req.user = result.rows[0]
      return next()
    } catch (error) {
      console.error('Could not authenticate request:', error.message)
      return res.status(500).json({ message: 'Não foi possível validar sua sessão.' })
    }
  }

  function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Esta área é exclusiva para administradores.' })
    }
    return next()
  }

  return { requireAuth, requireAdmin }
}

function createAuthRouter(pool, secret, secureCookies = false) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('AUTH_TOKEN_SECRET deve ter pelo menos 32 caracteres.')
  }

  const router = express.Router()

  router.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body || {}
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 150) {
      return res.status(400).json({ message: 'Informe seu nome (até 150 caracteres).' })
    }
    if (typeof email !== 'string' || email.trim().length > 255
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ message: 'Informe um e-mail válido.' })
    }
    if (typeof password !== 'string' || password.length < 8
      || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ message: 'A senha deve ter entre 8 e 72 bytes.' })
    }
    if (phone !== undefined && phone !== null
      && (typeof phone !== 'string' || phone.trim().length > 20)) {
      return res.status(400).json({ message: 'O telefone deve ter até 20 caracteres.' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    try {
      const passwordHash = await bcrypt.hash(password, 12)
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, phone, role`,
        [name.trim(), normalizedEmail, passwordHash, phone?.trim() || null],
      )
      const user = result.rows[0]
      const token = jwt.sign({ sub: String(user.id) }, secret, { expiresIn: tokenLifetimeSeconds })
      setSessionCookie(res, token, secureCookies)
      return res.status(201).json({ user })
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Já existe uma conta com este e-mail.' })
      }
      console.error('Could not register user:', error.message)
      return res.status(500).json({ message: 'Não foi possível criar sua conta.' })
    }
  })

  router.post('/login', async (req, res) => {
    const { email, password } = req.body || {}
    if (typeof email !== 'string' || !email.trim()
      || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Informe seu e-mail e sua senha.' })
    }
    if (Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ message: 'A senha deve ter no máximo 72 bytes.' })
    }

    try {
      const result = await pool.query(
        'SELECT id, name, email, phone, role, password_hash FROM users WHERE LOWER(email) = $1',
        [email.trim().toLowerCase()],
      )
      const user = result.rows[0]
      const passwordMatches = user && await bcrypt.compare(password, user.password_hash)
      if (!passwordMatches) {
        return res.status(401).json({ message: 'E-mail ou senha incorretos.' })
      }

      const token = jwt.sign({ sub: String(user.id) }, secret, { expiresIn: tokenLifetimeSeconds })
      setSessionCookie(res, token, secureCookies)
      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      })
    } catch (error) {
      console.error('Could not log in user:', error.message)
      return res.status(500).json({ message: 'Não foi possível entrar na sua conta.' })
    }
  })

  router.get('/me', async (req, res) => {
    const token = readSessionToken(req)
    if (!token) return res.status(401).json({ message: 'Entre na sua conta para continuar.' })

    let payload
    try {
      payload = jwt.verify(token, secret)
    } catch {
      clearSessionCookie(res, secureCookies)
      return res.status(401).json({ message: 'Sua sessão expirou. Entre novamente.' })
    }

    try {
      const result = await pool.query(
        'SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1',
        [Number(payload.sub)],
      )
      if (result.rowCount === 0) {
        clearSessionCookie(res, secureCookies)
        return res.status(401).json({ message: 'Esta conta não está mais disponível.' })
      }
      return res.json({ user: result.rows[0] })
    } catch (error) {
      console.error('Could not load authenticated user:', error.message)
      return res.status(500).json({ message: 'Não foi possível carregar sua conta.' })
    }
  })

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res, secureCookies)
    return res.status(204).end()
  })

  return router
}

module.exports = createAuthRouter
module.exports.createAuthMiddleware = createAuthMiddleware
