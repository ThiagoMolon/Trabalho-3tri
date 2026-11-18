import { useEffect, useState } from 'react'
import api from '../../services/api'
import { clearCart } from '../../services/cart'
import { clearDelivery, clearShippingQuote } from '../../services/checkout'
import Navbar from '../../components/Navbar'
import { currencyFormatter } from '../../admin/formatters'
import { PublicFooter } from '../Storefront'
import '../../styles/Confirmation.scss'

const steps = ['Carrinho', 'Destino', 'Pagamento', 'Confirmação']
const statusLabels = {
  pending: 'Aguardando confirmação',
  paid: 'Confirmado — demonstração',
  shipped: 'Enviado',
  delivered: 'Entregue',
  canceled: 'Cancelado',
}
const subscriptionStatusLabels = {
  pendente: 'Aguardando autorização',
  ativa: 'Ativa',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
}

function CheckoutProgress() {
  return (
    <nav className="confirmation-progress" aria-label="Etapas da compra">
      {steps.map((step, index) => (
        <span className="confirmation-progress__step" key={step}>
          <span className={`confirmation-progress__number${index < 3 ? ' is-done' : ' is-current'}`} aria-hidden="true">
            {index < 3 ? '✓' : index + 1}
          </span>
          <span aria-current={index === 3 ? 'step' : undefined}>{step}</span>
          {index < steps.length - 1 && <span className="confirmation-progress__line" aria-hidden="true" />}
        </span>
      ))}
    </nav>
  )
}

export default function ConfirmationPage({ orderId, subscriptionId }) {
  const [order, setOrder] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [orderError, setOrderError] = useState('')
  const [subscriptionError, setSubscriptionError] = useState('')
  const [cleanupError, setCleanupError] = useState('')
  const [loading, setLoading] = useState(Boolean(orderId || subscriptionId))
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  useEffect(() => {
    let active = true
    async function loadConfirmation() {
      const [orderResult, subscriptionResult] = await Promise.all([
        orderId
          ? api.get(`/orders/${orderId}`).then(({ data }) => ({ data })).catch((error) => ({ error }))
          : Promise.resolve(null),
        subscriptionId
          ? api.get(`/subscriptions/me/${subscriptionId}`).then(({ data }) => ({ data })).catch((error) => ({ error }))
          : Promise.resolve(null),
      ])
      if (!active) return

      const orderData = orderResult?.data || null
      const subscriptionData = subscriptionResult?.data || null
      if (orderData) setOrder(orderData)
      if (subscriptionData) setSubscription(subscriptionData)
      if (orderResult?.error) {
        setOrderError(orderResult.error.response?.data?.message || 'Não foi possível carregar o pedido.')
      }
      if (subscriptionResult?.error) {
        setSubscriptionError(subscriptionResult.error.response?.data?.message || 'Não foi possível carregar a assinatura.')
      }

      const orderPaid = orderData?.status === 'paid'
      const subscriptionComplete = subscriptionData && subscriptionData.status !== 'pendente'
      if ((orderPaid && (!subscriptionId || subscriptionComplete))
        || (!orderId && subscriptionData?.status === 'ativa')) {
        const failures = [clearCart(), clearDelivery(), clearShippingQuote()].filter(Boolean)
        if (failures.length) setCleanupError(failures.join(' '))
      }
      setLoading(false)
    }
    loadConfirmation()
    return () => { active = false }
  }, [orderId, subscriptionId])

  const address = order?.shipping_address || {}
  const shippingLabel = address.shipping_label || ''
  const hasContent = Boolean(order || subscription)

  async function confirmPayment() {
    setConfirming(true)
    setConfirmError('')
    try {
      if (orderId) {
        const { data } = await api.post(`/orders/${orderId}/demo-confirm`)
        setOrder((current) => ({ ...current, ...data }))
      }
      if (subscriptionId) {
        const { data } = await api.post(`/subscriptions/me/${subscriptionId}/demo-confirm`)
        setSubscription((current) => ({ ...current, status: data.status }))
      }
      const failures = [clearCart(), clearDelivery(), clearShippingQuote()].filter(Boolean)
      if (failures.length) setCleanupError(failures.join(' '))
      window.location.assign('/loja')
    } catch (requestError) {
      setConfirmError(requestError.response?.data?.message || 'Não foi possível confirmar o pagamento demonstrativo.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="public-site confirmation-page">
      <Navbar activePage="cart" />
      <main className="confirmation-main">
        <header className="confirmation-heading">
          <p>Finalizar compra · Etapa 4 de 4</p>
          <CheckoutProgress />
        </header>
        {loading && <p className="confirmation-feedback" role="status">Carregando os dados do pedido...</p>}
        {orderError && <p className="confirmation-feedback" role="alert">{orderError}</p>}
        {subscriptionError && <p className="confirmation-feedback" role="alert">{subscriptionError}</p>}
        {cleanupError && <p className="confirmation-feedback" role="alert">{cleanupError}</p>}
        {confirmError && <p className="confirmation-feedback" role="alert">{confirmError}</p>}
        {!loading && !hasContent && (
          <section className="confirmation-empty">
            <h1>Nenhum pedido selecionado</h1>
            <p>Confirme o pedido pelo checkout para consultar seus dados nesta tela.</p>
            <a href="/loja">Voltar à loja</a>
          </section>
        )}
        {order && (
          <header className="confirmation-hero">
            <span className="confirmation-hero__icon" aria-hidden="true">✓</span>
            <p>PEDIDO #{order.id}</p>
              <h1>{order.status === 'paid' ? 'Pedido confirmado (demonstração)' : 'Pedido registrado'}</h1>
            <p>Status: {statusLabels[order.status] || order.status}</p>
          </header>
        )}
        {subscription && !order && (
          <header className="confirmation-hero">
            <span className="confirmation-hero__icon" aria-hidden="true">✓</span>
            <p>ASSINATURA #{subscription.id}</p>
            <h1>{subscription.status === 'ativa' ? 'Assinatura autorizada' : 'Assinatura registrada'}</h1>
            <p>Status: {subscriptionStatusLabels[subscription.status] || subscription.status}</p>
          </header>
        )}
        {hasContent && (
          <div className={`confirmation-layout${order ? '' : ' confirmation-layout--single'}`}>
              <div className="confirmation-column">
                {order && (
                  <>
                    <section className="confirmation-card confirmation-next-steps">
                      <p className="confirmation-overline">Itens do pedido</p>
                      <ul>
                        {order.items.map((item) => (
                          <li key={item.id}>
                            <span>{item.name} × {item.quantity}{item.grind ? ` · ${item.grind}` : ''}</span>
                            <strong>{currencyFormatter.format(Number(item.unit_price) * item.quantity)}</strong>
                          </li>
                        ))}
                      </ul>
                      {order.status === 'paid'
                                    ? <p>Pedido confirmado em modo demonstrativo. Nenhum pagamento real foi realizado.</p>
                                    : <p>O pedido está registrado em modo demonstrativo.
                          {' '}<button type="button" onClick={() => window.location.reload()}>Atualizar status</button></p>}
                      {order.status === 'pending' && (
                        <button type="button" className="confirmation-confirm-button" disabled={confirming} onClick={confirmPayment}>
                          {confirming ? 'Confirmando...' : 'Confirmar pagamento demonstrativo'}
                        </button>
                      )}
                    </section>
                    <section className="confirmation-card confirmation-info">
                      <p className="confirmation-overline">Endereço de entrega</p>
                      <strong>{address.recipient || 'Destinatário'}</strong>
                      <p>{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ''}<br />
                        {address.neighborhood} · {address.city}/{address.state}<br />
                        CEP {address.cep || address.postalCode}</p>
                      {shippingLabel && <p>{shippingLabel} · {address.shipping_min_days} a {address.shipping_max_days} dias úteis</p>}
                    </section>
                  </>
                )}
                {subscription && (
                  <section className="confirmation-card confirmation-next-steps">
                    <p className="confirmation-overline">Assinatura recorrente</p>
                    <h2>{subscription.plan_name}</h2>
                    <p>Status: {subscriptionStatusLabels[subscription.status] || subscription.status}</p>
                    <p>{currencyFormatter.format(Number(subscription.billing_amount || subscription.plan_price))}
                      {' '}por ciclo · {subscription.frequency}</p>
                    {subscription.status === 'ativa'
                      ? <p>Assinatura ativada apenas para demonstração. Não haverá cobranças recorrentes reais. Gerencie em <a href="/conta#assinatura">Minha conta</a>.</p>
                      : <p>A assinatura está registrada em modo demonstrativo. Confirme o pagamento abaixo ou acompanhe em <a href="/conta#assinatura">Minha conta</a>.</p>}
                    {subscription.status === 'pendente' && (
                      <button type="button" className="confirmation-confirm-button" disabled={confirming} onClick={confirmPayment}>
                        {confirming ? 'Confirmando...' : 'Confirmar pagamento da assinatura'}
                      </button>
                    )}
                  </section>
                )}
              </div>
              {order && (
                <aside className="confirmation-summary" aria-labelledby="confirmation-summary-title">
                <h2 id="confirmation-summary-title">Resumo do pedido</h2>
                <p><span>Número</span><strong>#{order.id}</strong></p>
                <p><span>Data</span><span>{new Date(order.created_at).toLocaleString('pt-BR')}</span></p>
                <p><span>Subtotal</span><span>{currencyFormatter.format(Number(order.subtotal))}</span></p>
                <p><span>Frete · {shippingLabel}</span><span>{currencyFormatter.format(Number(order.shipping_cost))}</span></p>
                <div className="confirmation-summary__total">
                  <strong>Total</strong><strong>{currencyFormatter.format(Number(order.total))}</strong>
                </div>
                <a className="confirmation-summary__button" href="/conta#entregas">Ver meus pedidos</a>
                <a className="confirmation-summary__link" href="/loja">Voltar à loja</a>
                </aside>
              )}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}
