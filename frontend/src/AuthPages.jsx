import { useEffect, useState } from 'react'
import api from './services/api'

const tasteDimensions = [
  { key: 'acidity', label: 'Acidez' },
  { key: 'bitterness', label: 'Amargor' },
  { key: 'sweetness', label: 'Doçura' },
]

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
    <main className="auth-page">
      <a className="auth-brand" href="/" aria-label="Origin Beans, início">
        <span className="taste-brand-mark">OB</span>
        <span>origin<span>beans</span></span>
      </a>
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
            {user.taste_profile && (
              <section className="account-taste-profile" aria-labelledby="account-taste-title">
                <p className="eyebrow">TASTE FINDER</p>
                <h2 id="account-taste-title">Seu perfil de paladar</h2>
                <div className="taste-profile-bars">
                  {tasteDimensions.map(({ key, label }) => (
                    <div className="taste-profile-row" key={key}>
                      <div className="taste-profile-label">
                        <span>{label}</span>
                        <strong>{user.taste_profile[key]}/10</strong>
                      </div>
                      <div className="taste-profile-track" role="meter" aria-label={label} aria-valuemin="0" aria-valuemax="10" aria-valuenow={user.taste_profile[key]}>
                        <span style={{ width: `${user.taste_profile[key] * 10}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {error && <p className="auth-feedback feedback-error" role="alert">{error}</p>}
            <a className="submit-button auth-submit account-quiz-link" href="/quiz">{user.taste_profile ? 'Atualizar meu perfil de paladar' : 'Fazer o Taste Finder'}</a>
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
export { PasswordResetPage, PasswordResetRequestPage }
export default AuthPage
