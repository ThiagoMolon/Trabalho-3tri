import { useEffect, useState } from 'react'
import api from './services/api'

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
      window.location.assign(!isRegistering && data.user.role === 'admin' ? '/' : '/conta')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Não foi possível concluir a solicitação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <a className="auth-brand" href="/" aria-label="Origin Beans, início">
        <span className="taste-brand-mark">OB</span>
        <span>origin<span>beans</span></span>
      </a>

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
  )
}

function AccountPage() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let isCurrent = true
    api.get('/auth/me')
      .then(({ data }) => {
        if (!isCurrent) return
        if (data.user.role === 'admin') {
          window.location.replace('/')
          return
        }
        setUser(data.user)
      })
      .catch((requestError) => {
        if (!isCurrent) return
        if (requestError.response?.status === 401) {
          window.location.replace('/login')
          return
        }
        setError(requestError.response?.data?.message || 'Não foi possível carregar sua conta.')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  async function logout() {
    setSigningOut(true)
    setError('')
    try {
      await api.post('/auth/logout')
      window.location.replace('/login')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Não foi possível encerrar sua sessão.')
      setSigningOut(false)
    }
  }

  return (
    <main className="auth-page account-page">
      <a className="auth-brand" href="/" aria-label="Origin Beans, início">
        <span className="taste-brand-mark">OB</span>
        <span>origin<span>beans</span></span>
      </a>
      <section className="auth-card account-card">
        {loading ? (
          <p className="catalog-empty">Carregando sua conta...</p>
        ) : user ? (
          <>
            <p className="eyebrow">MINHA CONTA</p>
            <h1>Olá, {user.name.split(' ')[0]}</h1>
            <p className="auth-description">Seus dados de acesso da Origin &amp; Beans.</p>
            <dl className="account-details">
              <div><dt>Nome</dt><dd>{user.name}</dd></div>
              <div><dt>E-mail</dt><dd>{user.email}</dd></div>
              {user.phone && <div><dt>Telefone</dt><dd>{user.phone}</dd></div>}
            </dl>
            {error && <p className="auth-feedback feedback-error" role="alert">{error}</p>}
            <a className="submit-button auth-submit account-quiz-link" href="/quiz">Fazer o Taste Finder</a>
            <button className="auth-logout-button" type="button" onClick={logout} disabled={signingOut}>
              {signingOut ? 'Saindo...' : 'Sair da conta'}
            </button>
          </>
        ) : (
          <p className="auth-feedback feedback-error" role="alert">{error}</p>
        )}
      </section>
    </main>
  )
}

export { AccountPage }
export default AuthPage
