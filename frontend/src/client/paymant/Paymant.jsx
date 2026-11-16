import { useState } from 'react'
import Navbar from '../../components/Navbar'
import { readCart } from '../../services/cart'
import { getShippingOptions, readDelivery } from '../../services/checkout'
import { PublicFooter } from '../../client/Storefront'
import '../../styles/Paymant.scss'

const STEPS = ['Carrinho', 'Entrega', 'Pagamento', 'Confirmação']
const CURRENT_STEP = 2

const brl = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function CheckoutSteps({ steps, current }) {
  return (
    <div className="checkout-steps">
      <ol className="checkout-steps__list">
        {steps.map((label, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          return (
            <li key={label} className={`checkout-steps__item checkout-steps__item--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="checkout-steps__circle">
                {state === 'done' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                ) : i + 1}
              </span>
              <span className="checkout-steps__label">{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DeliveryCard({ delivery }) {
  if (delivery) {
    const { address } = delivery
    return (
      <section className="delivery-card">
        <h2 className="delivery-card__name">Entrega para {address.addressType || 'endereço'}</h2>
        <p className="delivery-card__text">
          {address.recipient}<br />
          {address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ''}<br />
          {address.neighborhood} · {address.city}/{address.state} · CEP {address.postalCode}<br />
          {getShippingOptions()[delivery.shippingMethod].label} · prazo estimado para demonstração
        </p>
        <a href="/destino">Alterar endereço ou frete</a>
      </section>
    )
  }

  return (
    <section className="delivery-card">
      <h2 className="delivery-card__name">Endereço não informado</h2>
      <p className="delivery-card__text">Informe o endereço e escolha uma estimativa de frete antes do pagamento.</p>
      <a href="/destino">Informar endereço</a>
    </section>
  );
}

function PixPanel() {
  return (
    <div className="pix">
      <div className="pix__top">
        <div className="pix__qr" aria-hidden="true">
          <span>QR Code indisponível</span>
        </div>
        <div className="pix__info">
          <h3>Pix não habilitado</h3>
          <p>O código será exibido aqui quando houver uma integração de pagamento.</p>
        </div>
      </div>
      <p className="pix__status" role="status">Nenhuma cobrança será gerada nesta prévia.</p>
    </div>
  );
}

function CardPanel() {
  return (
    <p className="card-panel" role="status">
      O pagamento por cartão não está configurado. Não informe dados reais do cartão nesta demonstração.
    </p>
  )
}

function PaymentCard({ method, onMethodChange }) {
  const tabs = [{ id: 'card', label: 'Cartão de Crédito' }, { id: 'pix', label: 'Pix' }];
  return (
    <section className="payment-card">
      <h2 className="payment-card__title">Forma de pagamento</h2>

      <div className="payment-card__tabs" role="tablist" aria-label="Forma de pagamento">
        {tabs.map(({ id, label }) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={method === id} aria-controls="payment-panel"
            className={`payment-card__tab${method === id ? ' payment-card__tab--active' : ''}`}
            onClick={() => onMethodChange(id)}>
            {label}
          </button>
        ))}
      </div>

      <div id="payment-panel" role="tabpanel" aria-labelledby={`tab-${method}`} className="payment-card__panel">
        {method === 'pix' ? <PixPanel /> : <CardPanel />}
      </div>
    </section>
  );
}

function OrderSummary({ items, total, delivery }) {
  const shipping = delivery ? getShippingOptions()[delivery.shippingMethod].price : 0
  return (
    <aside className="order-summary" aria-label="Resumo do pedido">
      <h2 className="order-summary__title">Resumo do pedido</h2>
      <ul className="order-summary__items">
        {items.map((item) => (
          <li key={`${item.product_id}-${item.grind}`} className="order-summary__item">
            <span>{item.name} × {item.quantity}<small>{item.grind}</small></span>
            <span>{brl(Number(item.price) * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="order-summary__item"><span>Subtotal</span><span>{brl(total)}</span></p>
      {delivery && <p className="order-summary__item"><span>Frete - {getShippingOptions()[delivery.shippingMethod].label}</span><span>{brl(shipping)}</span></p>}
      <p className="order-summary__total">
        <span className="order-summary__total-label">Total</span>
        <span className="order-summary__total-value">{brl(total + shipping)}</span>
      </p>
      <p className="order-summary__note">Frete e pagamento são apenas uma prévia; nenhum pedido será processado.</p>
      <button type="button" className="order-summary__button" disabled>Pagamento indisponível</button>
      <a href={delivery ? '/destino' : '/carrinho'} className="order-summary__link">{delivery ? 'Alterar endereço ou frete' : 'Voltar ao carrinho'}</a>
    </aside>
  );
}

export default function CheckoutPaymentPage() {
  const [method, setMethod] = useState('pix');
  const { items, error } = readCart()
  const { delivery, error: deliveryError } = readDelivery()
  const total = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)

  return (
    <div className="public-site checkout">
      <Navbar activePage="cart" />
      <main className="checkout__main">
        <header className="checkout__heading">
          <h1>Prévia do checkout</h1>
          <p role="status">Demonstração visual: nenhum pedido ou pagamento será processado.</p>
        </header>
        {(error || deliveryError) && <p className="checkout__error" role="alert">{error || deliveryError}</p>}
        {items.length === 0 ? (
          <section className="checkout__empty">
            <h2>Seu carrinho está vazio</h2>
            <p>Adicione cafés antes de visualizar o resumo do checkout.</p>
            <a className="checkout__empty-link" href="/loja">Explorar cafés</a>
          </section>
        ) : (
          <>
            <CheckoutSteps steps={STEPS} current={CURRENT_STEP} />
            <div className="checkout__layout">
              <div className="checkout__column">
                <DeliveryCard delivery={delivery} />
                <PaymentCard method={method} onMethodChange={setMethod} />
              </div>
              <OrderSummary items={items} total={total} delivery={delivery} />
            </div>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}