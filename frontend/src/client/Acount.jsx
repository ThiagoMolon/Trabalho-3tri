import { useEffect, useState } from 'react'
import api from '../services/api'
import { currencyFormatter } from '../admin/formatters'
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
        <li><a className="account-menu__link" href="#enderecos">Endereços</a></li>
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

function AddressManager({ addresses, onAdd, onDelete, saving, feedback }) {
  const [form, setForm] = useState({
    cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  })

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    const saved = await onAdd({ ...form, cep: form.cep.replace(/\D/g, '') })
    if (saved) setForm({ cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' })
  }

  return (
    <section className="account-empty-section" id="enderecos">
      <h2 className="account-empty-section__title">Meus endereços</h2>
      {addresses.length === 0 ? <p>Nenhum endereço cadastrado.</p> : (
        <ul className="account-address-list">
          {addresses.map((address) => (
            <li key={address.id}>
              <span>{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ''}<br />
                {address.neighborhood} · {address.city}/{address.state} · CEP {address.cep}</span>
              <button type="button" onClick={() => onDelete(address.id)}>Remover</button>
            </li>
          ))}
        </ul>
      )}
      <form className="account-address-form" onSubmit={submit}>
        <label>CEP<input name="cep" inputMode="numeric" maxLength="8" value={form.cep} onChange={(event) => setForm((current) => ({ ...current, cep: event.target.value.replace(/\D/g, '').slice(0, 8) }))} required /></label>
        <label>Rua<input name="street" value={form.street} onChange={updateField} required /></label>
        <label>Número<input name="number" value={form.number} onChange={updateField} required /></label>
        <label>Complemento<input name="complement" value={form.complement} onChange={updateField} /></label>
        <label>Bairro<input name="neighborhood" value={form.neighborhood} onChange={updateField} required /></label>
        <label>Cidade<input name="city" value={form.city} onChange={updateField} required /></label>
        <label>Estado<input name="state" maxLength="2" value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value.toUpperCase().slice(0, 2) }))} required /></label>
        <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Adicionar endereço'}</button>
      </form>
      {feedback && <p role="status">{feedback}</p>}
    </section>
  )
}

function SubscriptionsSection({ subscriptions, onUpdate, feedback }) {
  return (
    <section className="account-empty-section" id="assinatura">
      <h2 className="account-empty-section__title">Minhas assinaturas</h2>
      {subscriptions.length === 0 ? (
        <>
          <p>Você ainda não possui uma assinatura.</p>
          <a className="account-empty-section__link" href="/clube">Conhecer os planos</a>
        </>
      ) : subscriptions.map((subscription) => (
        <SubscriptionCard key={subscription.id} subscription={subscription} onUpdate={onUpdate} />
      ))}
      {feedback && <p role="status">{feedback}</p>}
    </section>
  )
}

function SubscriptionCard({ subscription, onUpdate }) {
  const [grind, setGrind] = useState(subscription.grind || 'Grãos inteiros')
  const [frequency, setFrequency] = useState(subscription.frequency || 'mensal')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function update(payload) {
    setSaving(true)
    setFeedback('')
    const result = await onUpdate(subscription.id, payload)
    if (result) {
      setFeedback('Preferências atualizadas.')
    }
    setSaving(false)
  }

  return (
    <article className="account-subscription-card">
      <h3>{subscription.plan_name}</h3>
      <p>{subscription.plan_description}</p>
      <p>{subscription.status === 'pendente' ? 'Aguardando confirmação demonstrativa' : subscription.status}
        {' · '}{subscription.billing_amount != null
          ? `${currencyFormatter.format(Number(subscription.billing_amount))} por ciclo`
          : subscription.plan_price != null ? currencyFormatter.format(Number(subscription.plan_price)) : ''}</p>
      <p>Próxima renovação: {subscription.next_renewal ? new Date(`${subscription.next_renewal.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : 'não definida'}</p>
      <div className="account-subscription-preferences">
        <label>Moagem
          <select value={grind} onChange={(event) => setGrind(event.target.value)}>
            <option>Grãos inteiros</option><option>Moagem fina</option><option>Moagem média</option><option>Moagem grossa</option>
          </select>
        </label>
        <label>Frequência
          <select value={frequency} disabled={subscription.status === 'pendente' || subscription.status === 'cancelada'}
            onChange={(event) => setFrequency(event.target.value)}>
            <option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option>
            <option value="mensal">Mensal</option><option value="bimestral">A cada 2 meses</option>
          </select>
        </label>
        <button type="button" disabled={saving || subscription.status === 'cancelada' || subscription.status === 'pendente'}
          onClick={() => update({ grind, frequency })}>Salvar alterações</button>
      </div>
      <div className="account-subscription-actions">
        {subscription.status !== 'cancelada' && subscription.status !== 'pendente' && (
          <button type="button" disabled={saving} onClick={() => update({ status: subscription.status === 'ativa' ? 'pausada' : 'ativa' })}>
            {subscription.status === 'ativa' ? 'Pausar' : 'Reativar'}
          </button>
        )}
        {subscription.status !== 'cancelada' && subscription.status !== 'pendente' && (
          <button type="button" disabled={saving} onClick={() => update({ status: 'cancelada' })}>Cancelar assinatura</button>
        )}
      </div>
      {feedback && <p role="status">{feedback}</p>}
    </article>
  )
}

function OrdersSection({ orders }) {
  return (
    <section className="account-empty-section" id="entregas">
      <h2 className="account-empty-section__title">Pedidos e entregas</h2>
      {orders.length === 0 ? <p>Seus pedidos e informações de rastreio aparecerão aqui.</p> : (
        <div className="account-orders-list">
          {orders.map((order) => (
            <article key={order.id}>
              <div><strong>Pedido #{order.id}</strong><span>{new Date(order.created_at).toLocaleDateString('pt-BR')}</span></div>
              <p>{order.status} · {currencyFormatter.format(Number(order.total))}</p>
              {order.tracking_code && <p>Rastreio: {order.tracking_code}</p>}
              <a href={`/confirmacao/${order.id}`}>Ver pedido</a>
            </article>
          ))}
        </div>
      )}
    </section>
  )
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
  const [addresses, setAddresses] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [orders, setOrders] = useState([])
  const [commerceError, setCommerceError] = useState('')
  const [addressFeedback, setAddressFeedback] = useState('')
  const [subscriptionFeedback, setSubscriptionFeedback] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let isCurrent = true
    api.get('/auth/me')
      .then(async ({ data }) => {
        if (!isCurrent) return
        if (data.user.role === 'admin') {
          window.location.replace('/admin')
          return
        }
        setUser(data.user)
        try {
          const [addressResult, subscriptionResult, orderResult] = await Promise.all([
            api.get('/addresses'),
            api.get('/subscriptions/me'),
            api.get('/orders/me'),
          ])
          if (!isCurrent) return
          setAddresses(addressResult.data)
          setSubscriptions(subscriptionResult.data)
          setOrders(orderResult.data)
        } catch (requestError) {
          if (isCurrent) {
            setCommerceError(requestError.response?.data?.message || 'Não foi possível carregar endereços, assinaturas ou pedidos.')
          }
        }
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

  async function addAddress(address) {
    setSavingAddress(true)
    setAddressFeedback('')
    try {
      const { data } = await api.post('/addresses', address)
      setAddresses((current) => [data, ...current])
      setAddressFeedback('Endereço adicionado.')
      return true
    } catch (requestError) {
      setAddressFeedback(requestError.response?.data?.message || 'Não foi possível salvar o endereço.')
      return false
    } finally {
      setSavingAddress(false)
    }
  }

  async function deleteAddress(id) {
    setAddressFeedback('')
    try {
      await api.delete(`/addresses/${id}`)
      setAddresses((current) => current.filter((address) => address.id !== id))
    } catch (requestError) {
      setAddressFeedback(requestError.response?.data?.message || 'Não foi possível remover o endereço.')
    }
  }

  async function updateSubscription(id, changes) {
    setSubscriptionFeedback('')
    try {
      const { data } = await api.patch(`/subscriptions/${id}`, changes)
      setSubscriptions((current) => current.map((item) => item.id === id ? { ...item, ...data } : item))
      return true
    } catch (requestError) {
      setSubscriptionFeedback(requestError.response?.data?.message || 'Não foi possível atualizar a assinatura.')
      return false
    }
  }

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
              <AddressManager addresses={addresses} onAdd={addAddress} onDelete={deleteAddress}
                saving={savingAddress} feedback={addressFeedback} />
              <SubscriptionsSection subscriptions={subscriptions} onUpdate={updateSubscription} feedback={subscriptionFeedback} />
              <OrdersSection orders={orders} />
              {commerceError && <p className="account-message account-message--error" role="alert">{commerceError}</p>}
              <TasteProfile profile={user.taste_profile} />
              {error && <p className="account-message account-message--error" role="alert">{error}</p>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}