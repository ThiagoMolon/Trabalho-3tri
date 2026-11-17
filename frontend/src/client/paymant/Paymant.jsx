import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import Navbar from '../../components/Navbar'
import { clearCart, readCart, serializeCartItems } from '../../services/cart'
import { clearDelivery, clearShippingQuote, readDelivery } from '../../services/checkout'
import { currencyFormatter } from '../../admin/formatters'
import { PublicFooter } from '../../client/Storefront'
import '../../styles/Paymant.scss'

const steps = ['Carrinho', 'Entrega', 'Pagamento', 'Confirmação']

function CheckoutSteps() {
  return (
    <div className="checkout-steps">
      <ol className="checkout-steps__list">
        {steps.map((label, index) => {
          const current = index === 2
          const done = index < 2
          return (
            <li key={label} className={`checkout-steps__item checkout-steps__item--${done ? 'done' : current ? 'current' : 'todo'}`}
              aria-current={current ? 'step' : undefined}>
              <span className="checkout-steps__circle">{done ? '✓' : index + 1}</span>
              <span className="checkout-steps__label">{label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function CheckoutPaymentPage() {
  const cart = useMemo(() => readCart(), [])
  const savedDelivery = useMemo(() => readDelivery(), [])
  const [user, setUser] = useState(null)
  const [orderId, setOrderId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(cart.error || savedDelivery.error)
  const [loginChecked, setLoginChecked] = useState(false)
  const subtotal = cart.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
  const shippingCost = Number(savedDelivery.delivery?.shippingCost || 0)
  const total = subtotal + shippingCost

  useEffect(() => {
    let active = true
    api.get('/auth/me')
      .then(({ data }) => { if (active) setUser(data.user) })
      .catch((requestError) => {
        if (active && requestError.response?.status !== 401) {
          setError(requestError.response?.data?.message || 'Não foi possível validar sua conta.')
        }
      })
      .finally(() => { if (active) setLoginChecked(true) })
    return () => { active = false }
  }, [])

  async function completeOrder() {
    setSubmitting(true)
    setError('')
    try {
      let id = orderId
      if (!id) {
        const { data } = await api.post('/orders', {
          items: serializeCartItems(cart.items),
          shipping_method: savedDelivery.delivery.shippingMethod,
          shipping_address: savedDelivery.delivery.address,
          address_id: savedDelivery.delivery.addressId || undefined,
        })
        id = data.id
        setOrderId(id)
      }
      await api.patch(`/orders/${id}/simulate-pay`)
      const failures = [clearCart(), clearDelivery(), clearShippingQuote()].filter(Boolean)
      if (failures.length) {
        setError(failures.join(' '))
        return
      }
      window.location.assign(`/confirmacao/${id}`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Não foi possível concluir o pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  const delivery = savedDelivery.delivery
  const canPay = cart.items.length > 0 && delivery && user && loginChecked

  return (
    <div className="public-site checkout">
      <Navbar activePage="cart" />
      <main className="checkout__main">
        <header className="checkout__heading">
          <h1>Pagamento</h1>
          <p>Ambiente acadêmico: o botão abaixo registra um pagamento simulado, sem cobrança real.</p>
        </header>
        <CheckoutSteps />
        {(error || cart.error || savedDelivery.error) && <p className="checkout__error" role="alert">{error || cart.error || savedDelivery.error}</p>}
        {!user && loginChecked && (
          <p className="checkout__error" role="status">
            Entre ou crie uma conta para continuar: <a href="/login?next=%2Fpagamento">entrar</a> · <a href="/cadastro?next=%2Fpagamento">criar conta</a>.
          </p>
        )}
        {cart.items.length === 0 ? (
          <section className="checkout__empty">
            <h2>Seu carrinho está vazio</h2>
            <a className="checkout__empty-link" href="/loja">Explorar cafés</a>
          </section>
        ) : !delivery ? (
          <section className="checkout__empty">
            <h2>Informe a entrega antes de pagar</h2>
            <a className="checkout__empty-link" href="/destino">Voltar para o endereço</a>
          </section>
        ) : (
          <div className="checkout__layout">
            <div className="checkout__column">
              <section className="delivery-card">
                <h2 className="delivery-card__name">Entrega para {delivery.address.recipient}</h2>
                <p className="delivery-card__text">
                  {delivery.address.street}, {delivery.address.number}{delivery.address.complement ? ` · ${delivery.address.complement}` : ''}<br />
                  {delivery.address.neighborhood} · {delivery.address.city}/{delivery.address.state} · CEP {delivery.address.cep || delivery.address.postalCode}<br />
                  {delivery.shippingOption?.label || delivery.shippingMethod.toUpperCase()} · {delivery.shippingOption?.min_days} a {delivery.shippingOption?.max_days} dias úteis
                </p>
                <a href="/destino">Alterar endereço ou frete</a>
              </section>
              <section className="payment-card">
                <h2 className="payment-card__title">Pagamento de demonstração</h2>
                <p role="status">Não informe dados de cartão. Nenhum gateway está conectado; a ação confirma o pedido apenas no banco de dados.</p>
                {cart.items.some((item) => item.item_type === 'subscription') && (
                  <p>As assinaturas incluídas serão ativadas como demonstração após a confirmação.</p>
                )}
              </section>
            </div>
            <aside className="order-summary" aria-label="Resumo do pedido">
              <h2 className="order-summary__title">Resumo do pedido</h2>
              <ul className="order-summary__items">
                {cart.items.map((item) => (
                  <li key={`${item.item_type || 'product'}-${item.product_id || item.plan_id}-${item.grind}-${item.frequency || ''}`} className="order-summary__item">
                    <span>{item.name} × {item.quantity}<small>{item.grind}{item.frequency ? ` · ${item.frequency}` : ''}</small></span>
                    <span>{currencyFormatter.format(Number(item.price) * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <p className="order-summary__item"><span>Subtotal</span><span>{currencyFormatter.format(subtotal)}</span></p>
              <p className="order-summary__item"><span>Frete · {delivery.shippingOption?.label || delivery.shippingMethod.toUpperCase()}</span><span>{currencyFormatter.format(shippingCost)}</span></p>
              <p className="order-summary__total">
                <span className="order-summary__total-label">Total</span>
                <span className="order-summary__total-value">{currencyFormatter.format(total)}</span>
              </p>
              <button type="button" className="order-summary__button" disabled={!canPay || submitting} onClick={completeOrder}>
                {submitting ? 'Processando...' : orderId ? 'Tentar confirmação novamente' : 'Confirmar pedido (simulação)'}
              </button>
              <a href="/carrinho" className="order-summary__link">Voltar ao carrinho</a>
            </aside>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}
