import { useEffect, useState } from 'react'
import api from '../services/api'
import '../styles/Acount.scss'
import Navbar from '../components/Navbar'

const tasteDimensions = [
  { key: 'acidity', label: 'Acidez' },
  { key: 'bitterness', label: 'Amargor' },
  { key: 'sweetness', label: 'Doçura' },
]

function AccountHero({ name }) {
  return (
    <section className="account-hero">
      <p className="account-hero__eyebrow">Minha conta</p>
      <h1 className="account-hero__title">Olá, {name.split(' ')[0]}</h1>
    </section>
  );
}

function AccountMenu({ onLogout, signingOut }) {
  return (
    <nav className="account-menu" aria-label="Minha conta">
      <ul className="account-menu__list">
        <li><a className="account-menu__link account-menu__link--active" href="#dados-pessoais">Dados pessoais</a></li>
        <li><a className="account-menu__link" href="#assinatura">Minha assinatura</a></li>
        <li><a className="account-menu__link" href="#entregas">Entregas</a></li>
        <li><a className="account-menu__link" href="#paladar">Perfil de paladar</a></li>
      </ul>
      <button className="account-menu__logout" type="button" onClick={onLogout} disabled={signingOut}>
        {signingOut ? 'Saindo...' : 'Sair da conta'}
      </button>
    </nav>
  );
}

function AccountDetails({ user }) {
  return (
    <section className="account-profile" id="dados-pessoais">
      <h2 className="account-profile__title">Dados pessoais</h2>
      <dl className="account-profile__details">
        <div><dt>Nome</dt><dd>{user.name}</dd></div>
        <div><dt>E-mail</dt><dd>{user.email}</dd></div>
        {user.phone && <div><dt>Telefone</dt><dd>{user.phone}</dd></div>}
      </dl>
    </section>
  );
}

function EmptyAccountSection({ id, title, children, action }) {
  return (
    <section className="account-empty-section" id={id}>
      <h2 className="account-empty-section__title">{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}

function TasteProfile({ profile }) {
  const traits = tasteDimensions.map(({ key, label }) => ({ label, value: profile?.[key] }))
    .filter(({ value }) => Number.isFinite(value))

  return (
    <section className="taste-profile" id="paladar">
      <div className="taste-profile__header">
        <h2 className="taste-profile__title">Meu perfil de paladar</h2>
        <a href="/quiz" className="taste-profile__button">Refazer Taste Finder</a>
      </div>
      {traits.length ? (
        <ul className="taste-profile__list">
          {traits.map(({ label, value }) => (
            <li key={label} className="taste-profile__trait">
              <div className="taste-profile__trait-header">
                <span>{label}</span>
                <span>{value}/10</span>
              </div>
              <div
                className="taste-profile__bar"
                style={{ '--v': `${value * 10}%` }}
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={value}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="account-empty-section__message">Faça o Taste Finder para descobrir seu perfil de café.</p>
      )}
    </section>
  );
}

export default function AccountPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let isCurrent = true
    api.get('/auth/me')
      .then(({ data }) => {
        if (!isCurrent) return
        if (data.user.role === 'admin') {
          window.location.replace('/admin')
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
    <div className="account">
      <Navbar activePage="account" />
      {user && <AccountHero name={user.name} />}
      <main className="account__layout">
        {user && <AccountMenu onLogout={logout} signingOut={signingOut} />}
        <div className="account__content" aria-live="polite">
          {loading && <p className="account-message">Carregando sua conta...</p>}
          {!loading && error && <p className="account-message account-message--error" role="alert">{error}</p>}
          {!loading && user && (
            <>
              <AccountDetails user={user} />
              <EmptyAccountSection
                id="assinatura"
                title="Minha assinatura"
                action={<a className="account-empty-section__link" href="/clube">Conhecer os planos</a>}
              >
                As informações da sua assinatura serão exibidas aqui quando estiverem disponíveis.
              </EmptyAccountSection>
              <EmptyAccountSection id="entregas" title="Histórico de entregas">
                Seus pedidos e informações de rastreio aparecerão aqui.
              </EmptyAccountSection>
              <TasteProfile profile={user.taste_profile} />
              {error && <p className="account-message account-message--error" role="alert">{error}</p>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}