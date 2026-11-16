import { useState } from 'react'
import api from '../services/api'
import Navbar from '../components/Navbar'

function AuthPage({ mode }) {
  const isRegistering = mode === 'register'
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const { data } = await api.post(isRegistering ? '/auth/register' : '/auth/login', {
        ...(isRegistering ? { name: form.name, phone: form.phone || undefined } : {}),
        email: form.email,
        password: form.password,
      })
      window.location.assign(!isRegistering && data.user.role === 'admin' ? '/admin' : '/conta')
    } catch (requestError) {
      setError(
        requestError.response?.data?.message
        || (requestError.request
          ? 'Não foi possível conectar à API. Verifique se o servidor está disponível.'
          : 'Não foi possível concluir a solicitação.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <Navbar activePage="account" />
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">ORIGIN &amp; BEANS</p>
        <h1>{isRegistering ? 'Crie sua conta' : 'Boas-vindas de volta'}</h1>
        <p className="auth-description">
          {isRegistering
            ? 'Cadastre-se para acompanhar sua experiência com nossos cafés.'
            : 'Entre para acessar sua conta e seu perfil.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegistering && (
            <label className="field">
              <span>Nome completo <b>*</b></span>
              <input
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={updateField}
                maxLength="150"
                required
              />
            </label>
          )}
          <label className="field">
            <span>E-mail <b>*</b></span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={updateField}
              maxLength="255"
              required
            />
          </label>
          {isRegistering && (
            <label className="field">
              <span>Telefone</span>
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={updateField}
                maxLength="20"
              />
            </label>
          )}
          <label className="field">
            <span>Senha <b>*</b></span>
            <input
              name="password"
              type="password"
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={updateField}
              minLength="8"
              maxLength="72"
              required
            />
            {isRegistering && <small>Use pelo menos 8 caracteres.</small>}
          </label>
          {!isRegistering && (
            <p className="auth-forgot-link"><a href="/esqueci-senha">Esqueceu sua senha?</a></p>
          )}

          {error && <p className="auth-feedback feedback-error" role="alert">{error}</p>}
          <button className="submit-button auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Aguarde...' : isRegistering ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}
          {' '}
          <a href={isRegistering ? '/login' : '/cadastro'}>
            {isRegistering ? 'Entrar' : 'Cadastre-se'}
          </a>
        </p>
      </section>

      <a className="auth-back-link" href="/quiz">Conheça seu perfil de café →</a>
    </main>
    </>
  )
}

function PasswordResetRequestPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post('/auth/password-reset/request', { email })
      setNotice(data.message)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Não foi possível solicitar a redefinição.')
      console.error(requestError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <Navbar activePage="account" />
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">ORIGIN &amp; BEANS</p>
        <h1>Redefinir senha</h1>
        <p className="auth-description">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>E-mail <b>*</b></span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength="255"
              required
            />
          </label>
          {error && <p className="auth-feedback feedback-error" role="alert">{error}</p>}
          {notice && <p className="auth-feedback feedback-success" role="status">{notice}</p>}
          <button className="submit-button auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar link de redefinição'}
          </button>
        </form>
        <p className="auth-switch"><a href="/login">Voltar ao login</a></p>
      </section>
    </main>
    </>
  )
}

function PasswordResetPage() {
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post('/auth/password-reset/confirm', { token, password })
      setNotice(data.message)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Não foi possível redefinir sua senha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <Navbar activePage="account" />
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">ORIGIN &amp; BEANS</p>
        <h1>Crie uma nova senha</h1>
        <p className="auth-description">Escolha uma senha com pelo menos 8 caracteres.</p>
        {token ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Nova senha <b>*</b></span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength="8"
                maxLength="72"
                required
              />
            </label>
            {error && <p className="auth-feedback feedback-error" role="alert">{error}</p>}
            {notice && <p className="auth-feedback feedback-success" role="status">{notice}</p>}
            {notice ? (
              <a className="submit-button auth-submit" href="/login">Ir para o login</a>
            ) : (
              <button className="submit-button auth-submit" type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            )}
          </form>
        ) : (
          <>
            <p className="auth-feedback feedback-error" role="alert">Este link de redefinição é inválido ou expirou.</p>
            <a className="submit-button auth-submit" href="/esqueci-senha">Solicitar outro link</a>
          </>
        )}
      </section>
    </main>
    </>
  )
}

export { PasswordResetPage, PasswordResetRequestPage }
export default AuthPage
