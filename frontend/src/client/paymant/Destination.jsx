import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import Navbar from '../../components/Navbar'
import { readCart, serializeCartItems } from '../../services/cart'
import { readDelivery, readShippingQuote, saveDelivery, saveShippingQuote } from '../../services/checkout'
import { currencyFormatter } from '../../admin/formatters'
import { PublicFooter } from '../../client/Storefront'
import '../../styles/Destination.scss'

const states = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]
const steps = ['Carrinho', 'Destino', 'Pagamento', 'Confirmação']
const emptyAddress = {
  recipient: '', phone: '', cep: '', street: '', number: '', complement: '',
  neighborhood: '', city: '', state: '',
}

function normalizeAddress(address = {}) {
  return {
    ...emptyAddress,
    ...address,
    cep: String(address.cep || address.postalCode || '').replace(/\D/g, '').slice(0, 8),
  }
}

function CheckoutProgress() {
  return (
    <nav className="destination-progress" aria-label="Etapas da compra">
      {steps.map((step, index) => (
        <span className="destination-progress__step" key={step}>
          <span className={`destination-progress__number${index < 1 ? ' is-complete' : index === 1 ? ' is-current' : ''}`} aria-hidden="true">
            {index === 0 ? '✓' : index + 1}
          </span>
          <span aria-current={index === 1 ? 'step' : undefined}>{step}</span>
          {index < steps.length - 1 && <span className="destination-progress__line" aria-hidden="true" />}
        </span>
      ))}
    </nav>
  )
}

export default function DestinationPage() {
  const cart = useMemo(() => readCart(), [])
  const savedDelivery = useMemo(() => readDelivery(), [])
  const savedQuote = useMemo(() => readShippingQuote(), [])
  const [user, setUser] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [address, setAddress] = useState(() => normalizeAddress({
    ...savedDelivery.delivery?.address,
    cep: savedDelivery.delivery?.address?.cep || savedQuote.quote?.cep,
  }))
  const [saveAddress, setSaveAddress] = useState(true)
  const [quote, setQuote] = useState(savedQuote.quote)
  const [shippingMethod, setShippingMethod] = useState(savedDelivery.delivery?.shippingMethod || savedQuote.quote?.selected_method || 'pac')
  const [loadingAccount, setLoadingAccount] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [lookingUpCep, setLookingUpCep] = useState(false)
  const [feedback, setFeedback] = useState(cart.error || savedDelivery.error || savedQuote.error)

  useEffect(() => {
    let active = true
    async function loadAccount() {
      try {
        const { data } = await api.get('/auth/me')
        if (!active) return
        setUser(data.user)
        const addressResponse = await api.get('/addresses')
        if (!active) return
        setAddresses(addressResponse.data)
        const savedId = savedDelivery.delivery?.addressId
        const chosenAddress = addressResponse.data.find((item) => String(item.id) === String(savedId))
          || addressResponse.data[0]
        if (chosenAddress) {
          setSelectedAddressId(String(chosenAddress.id))
          if (!savedDelivery.delivery?.address) {
            setAddress(normalizeAddress(chosenAddress))
          }
        }
      } catch (requestError) {
        if (active && requestError.response?.status !== 401) {
          setFeedback(requestError.response?.data?.message || 'Não foi possível carregar sua conta e seus endereços.')
        }
      } finally {
        if (active) setLoadingAccount(false)
      }
    }
    loadAccount()
    return () => { active = false }
  }, [savedDelivery.delivery?.address, savedDelivery.delivery?.addressId])

  const selectedOption = quote?.options.find((option) => option.id === shippingMethod)
  const subtotal = cart.items.reduce((total, item) => total + Number(item.price) * item.quantity, 0)
  const hasSubscription = cart.items.some((item) => item.item_type === 'subscription')
  const hasProducts = cart.items.some((item) => item.item_type !== 'subscription')

  function updateAddress(field, value) {
    setAddress((current) => ({ ...current, [field]: value }))
    if (field === 'cep') {
      setQuote(null)
      setSelectedAddressId('')
    }
  }

  function chooseAddress(event) {
    const id = event.target.value
    setSelectedAddressId(id)
    if (!id) {
      setAddress(emptyAddress)
      setQuote(null)
      return
    }
    const selected = addresses.find((item) => String(item.id) === id)
    if (selected) {
      setAddress((current) => normalizeAddress({ ...selected, recipient: current.recipient, phone: current.phone }))
      const currentQuote = savedQuote.quote
      setQuote(currentQuote?.cep === selected.cep ? currentQuote : null)
    }
  }

  async function lookupCep() {
    if (!/^\d{8}$/.test(address.cep)) {
      setFeedback('Informe um CEP com 8 números.')
      return
    }
    setLookingUpCep(true)
    setFeedback('')
    try {
      const response = await fetch(`https://viacep.com.br/ws/${address.cep}/json/`)
      if (!response.ok) throw new Error('Não foi possível consultar o CEP.')
      const data = await response.json()
      if (data.erro) throw new Error('CEP não encontrado.')
      setAddress((current) => ({
        ...current,
        street: data.logradouro || current.street,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        state: data.uf || current.state,
      }))
      setSelectedAddressId('')
      setQuote(null)
    } catch (error) {
      setFeedback(error.message || 'Não foi possível consultar o CEP.')
    } finally {
      setLookingUpCep(false)
    }
  }

  async function calculateShipping() {
    setCalculating(true)
    setFeedback('')
    try {
      const { data } = await api.post('/shipping/calculate', {
        cep: address.cep,
        items: serializeCartItems(cart.items),
      })
      const nextQuote = { ...data, selected_method: shippingMethod }
      const saveError = saveShippingQuote(nextQuote)
      if (saveError) {
        setFeedback(saveError)
        return
      }
      setQuote(nextQuote)
    } catch (requestError) {
      setFeedback(requestError.response?.data?.message || 'Não foi possível calcular o frete.')
    } finally {
      setCalculating(false)
    }
  }

  async function continueToPayment(event) {
    event.preventDefault()
    if (!user) {
      setFeedback('Entre ou crie uma conta para concluir o pedido.')
      return
    }
    if (!quote || quote.cep !== address.cep || !selectedOption) {
      setFeedback('Calcule o frete para este CEP antes de continuar.')
      return
    }
    setFeedback('')
    let addressId = selectedAddressId ? Number(selectedAddressId) : null
    if (!addressId && (saveAddress || hasSubscription)) {
      try {
        const { data } = await api.post('/addresses', address)
        addressId = data.id
        setAddresses((current) => [data, ...current])
        setSelectedAddressId(String(data.id))
      } catch (requestError) {
        setFeedback(requestError.response?.data?.message || 'Não foi possível salvar o endereço.')
        return
      }
    }
    const deliveryAddress = {
      ...address,
      postalCode: address.cep,
      addressType: 'Entrega',
    }
    const saveError = saveDelivery({
      address: deliveryAddress,
      addressId,
      shippingMethod,
      shippingCost: Number(selectedOption.cost),
      shippingOption: selectedOption,
    })
    if (saveError) {
      setFeedback(saveError)
      return
    }
    window.location.assign('/pagamento')
  }

  function selectShipping(method) {
    setShippingMethod(method)
    if (quote) {
      const updatedQuote = { ...quote, selected_method: method }
      setQuote(updatedQuote)
      const saveError = saveShippingQuote(updatedQuote)
      if (saveError) setFeedback(saveError)
    }
  }

  return (
    <div className="public-site destination-page">
      <Navbar activePage="cart" />
      <main className="destination-main">
        <header className="destination-heading">
          <p>Finalizar compra · Etapa 2 de 4</p>
          <CheckoutProgress />
        </header>

        {feedback && <p className="destination-feedback" role="alert">{feedback}</p>}
        {!user && !loadingAccount && (
          <p className="destination-feedback" role="status">
            Para concluir o pedido, <a href="/login?next=%2Fdestino">entre</a> ou <a href="/cadastro?next=%2Fdestino">crie uma conta</a>.
          </p>
        )}
        {cart.items.length === 0 ? (
          <section className="destination-empty">
            <h1>Seu carrinho está vazio</h1>
            <p>Adicione cafés ou planos antes de informar a entrega.</p>
            <a href="/loja">Explorar loja</a>
          </section>
        ) : (
          <div className="destination-layout">
            <div className="destination-column">
              <section className="destination-card" aria-labelledby="destination-title">
                <p className="destination-overline">Destino</p>
                <h1 id="destination-title">Onde devemos entregar?</h1>
                <p className="destination-intro">Selecione um endereço salvo ou informe um novo endereço.</p>
                <form id="destination-form" onSubmit={continueToPayment}>
                  {addresses.length > 0 && (
                    <label className="destination-field destination-field--full">
                      Endereço salvo
                      <select value={selectedAddressId} onChange={chooseAddress}>
                        <option value="">Informar novo endereço</option>
                        {addresses.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.street}, {item.number} · {item.city}/{item.state} · {item.cep}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="destination-fields">
                    <div className="destination-field destination-field--full">
                      <label htmlFor="recipient">Nome completo do destinatário</label>
                      <input id="recipient" autoComplete="name" value={address.recipient}
                        onChange={(event) => updateAddress('recipient', event.target.value)} required />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="phone">Telefone com DDD</label>
                      <input id="phone" type="tel" autoComplete="tel" value={address.phone}
                        onChange={(event) => updateAddress('phone', event.target.value)} required />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="cep">CEP</label>
                      <div className="destination-cep-row">
                        <input id="cep" inputMode="numeric" placeholder="00000000" maxLength={8}
                          value={address.cep} onChange={(event) => updateAddress('cep', event.target.value.replace(/\D/g, '').slice(0, 8))} required />
                        <button type="button" onClick={lookupCep} disabled={lookingUpCep}>
                          {lookingUpCep ? 'Buscando...' : 'Buscar CEP'}
                        </button>
                      </div>
                    </div>
                    <div className="destination-field destination-field--street">
                      <label htmlFor="street">Rua / Avenida</label>
                      <input id="street" autoComplete="address-line1" value={address.street}
                        onChange={(event) => updateAddress('street', event.target.value)} required />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="number">Número</label>
                      <input id="number" autoComplete="address-line2" value={address.number}
                        onChange={(event) => updateAddress('number', event.target.value)} required />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="complement">Complemento (opcional)</label>
                      <input id="complement" value={address.complement}
                        onChange={(event) => updateAddress('complement', event.target.value)} />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="neighborhood">Bairro</label>
                      <input id="neighborhood" autoComplete="address-level3" value={address.neighborhood}
                        onChange={(event) => updateAddress('neighborhood', event.target.value)} required />
                    </div>
                    <div className="destination-field destination-field--city">
                      <label htmlFor="city">Cidade</label>
                      <input id="city" autoComplete="address-level2" value={address.city}
                        onChange={(event) => updateAddress('city', event.target.value)} required />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="state">Estado</label>
                      <select id="state" autoComplete="address-level1" value={address.state}
                        onChange={(event) => updateAddress('state', event.target.value)} required>
                        <option value="">Selecionar</option>
                        {states.map((state) => <option key={state}>{state}</option>)}
                      </select>
                    </div>
                  </div>
                  {!selectedAddressId && (
                    <label className="destination-default">
                      <input type="checkbox" checked={hasSubscription || saveAddress} disabled={hasSubscription}
                        onChange={(event) => setSaveAddress(event.target.checked)} />
                      <span>{hasSubscription
                        ? 'Este endereço será salvo para as entregas recorrentes da assinatura'
                        : 'Salvar este endereço na minha conta'}</span>
                    </label>
                  )}
                  <button className="destination-calculate" type="button" onClick={calculateShipping}
                    disabled={calculating || !/^\d{8}$/.test(address.cep)}>
                    {calculating ? 'Calculando frete...' : 'Calcular frete para este CEP'}
                  </button>
                </form>
              </section>

              <fieldset className="destination-card destination-shipping">
                <legend>Escolha do frete</legend>
                {quote?.cep === address.cep ? quote.options.map((option) => (
                  <label className="destination-shipping__option" key={option.id}>
                    <input type="radio" name="shipping" value={option.id} checked={shippingMethod === option.id}
                      onChange={() => selectShipping(option.id)} />
                    <span><strong>{option.label}</strong><small>{option.min_days} a {option.max_days} dias úteis</small></span>
                    <strong>{currencyFormatter.format(Number(option.cost))}</strong>
                  </label>
                )) : <p>Calcule o frete para exibir as opções disponíveis.</p>}
              </fieldset>
            </div>
            <aside className="destination-summary" aria-labelledby="destination-summary-title">
              <h2 id="destination-summary-title">Resumo do pedido</h2>
              <ul className="destination-summary__items">
                {cart.items.map((item) => (
                  <li key={`${item.item_type || 'product'}-${item.product_id || item.plan_id}-${item.grind}`}>
                    <span>{item.name} × {item.quantity}</span>
                    <span>{currencyFormatter.format(Number(item.price) * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="destination-summary__line"><span>Subtotal</span><span>{currencyFormatter.format(subtotal)}</span></div>
              {selectedOption && <div className="destination-summary__line">
                <span>Frete - {selectedOption.label}</span><span>{currencyFormatter.format(Number(selectedOption.cost))}</span>
              </div>}
              {hasSubscription && hasProducts && (
                <p className="destination-summary__line">
                  Produtos e assinatura serão pagos separadamente; o frete será recalculado para cada cobrança.
                </p>
              )}
              <div className="destination-summary__total">
                <strong>Total</strong><strong>{currencyFormatter.format(subtotal + Number(selectedOption?.cost || 0))}</strong>
              </div>
              <button className="destination-summary__button" type="submit" form="destination-form" disabled={!user || loadingAccount}>
                Continuar para checkout demonstrativo
              </button>
              <a className="destination-summary__link" href="/carrinho">Voltar ao carrinho</a>
            </aside>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}
