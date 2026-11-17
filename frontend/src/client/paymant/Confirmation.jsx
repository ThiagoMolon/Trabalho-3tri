import { useEffect, useState } from 'react'
import api from '../../services/api'
import Navbar from '../../components/Navbar'
import { currencyFormatter } from '../../admin/formatters'
import { PublicFooter } from '../Storefront'
import '../../styles/Confirmation.scss'

const steps = ['Carrinho', 'Destino', 'Pagamento', 'Confirmação']
const statusLabels = {
  pending: 'Aguardando pagamento',
  paid: 'Pago (simulação)',
  shipped: 'Enviado',
  delivered: 'Entregue',
  canceled: 'Cancelado',
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

export default function ConfirmationPage({ orderId }) {
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(orderId))

  useEffect(() => {
    let active = true
    if (!orderId) {
      return () => { active = false }
    }
    api.get(`/orders/${orderId}`)
      .then(({ data }) => { if (active) setOrder(data) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Não foi possível carregar o pedido.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [orderId])

  const address = order?.shipping_address || {}
  const shippingLabel = address.shipping_label || ''

  return (
    <div className="public-site confirmation-page">
      <Navbar activePage="cart" />
      <main className="confirmation-main">
        <header className="confirmation-heading">
          <p>Finalizar compra · Etapa 4 de 4</p>
          <CheckoutProgress />
        </header>
        {loading && <p className="confirmation-feedback" role="status">Carregando os dados do pedido...</p>}
        {error && <p className="confirmation-feedback" role="alert">{error}</p>}
        {!loading && !error && !order && (
          <section className="confirmation-empty">
            <h1>Nenhum pedido selecionado</h1>
            <p>Confirme o pedido pelo checkout para consultar seus dados nesta tela.</p>
            <a href="/loja">Voltar à loja</a>
          </section>
        )}
        {order && (
          <>
            <header className="confirmation-hero">
              <span className="confirmation-hero__icon" aria-hidden="true">✓</span>
              <p>PEDIDO #{order.id}</p>
              <h1>{order.status === 'paid' ? 'Pedido confirmado' : 'Pedido registrado'}</h1>
              <p>Status: {statusLabels[order.status] || order.status}</p>
            </header>
            <div className="confirmation-layout">
              <div className="confirmation-column">
                <section className="confirmation-card confirmation-next-steps">
                  <p className="confirmation-overline">Itens do pedido</p>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.id}>
                        <span>{item.name} × {item.quantity}{item.grind ? ` · ${item.grind}` : ''}{item.frequency ? ` · ${item.frequency}` : ''}</span>
                        <strong>{currencyFormatter.format(Number(item.unit_price) * item.quantity)}</strong>
                      </li>
                    ))}
                  </ul>
                  {order.status === 'paid' && <p>Pagamento registrado em modo de simulação. Nenhuma cobrança real foi feita.</p>}
                  {order.status !== 'paid' && <p>O pedido está registrado, mas ainda aguarda confirmação de pagamento.</p>}
                </section>
                <section className="confirmation-card confirmation-info">
                  <p className="confirmation-overline">Endereço de entrega</p>
                  <strong>{address.recipient || 'Destinatário'}</strong>
                  <p>{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ''}<br />
                    {address.neighborhood} · {address.city}/{address.state}<br />
                    CEP {address.cep || address.postalCode}</p>
                  {shippingLabel && <p>{shippingLabel} · {address.shipping_min_days} a {address.shipping_max_days} dias úteis</p>}
                </section>
              </div>
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
            </div>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}
