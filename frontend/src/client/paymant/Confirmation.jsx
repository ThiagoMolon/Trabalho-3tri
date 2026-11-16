import Navbar from '../../components/Navbar'
import { currencyFormatter } from '../../admin/formatters'
import { readCart } from '../../services/cart'
import { getShippingOptions, readDelivery } from '../../services/checkout'
import { PublicFooter } from '../Storefront'
import '../../styles/Confirmation.scss'

const steps = ['Carrinho', 'Destino', 'Pagamento', 'Confirmação']

function CheckoutProgress() {
  return (
    <nav className="confirmation-progress" aria-label="Etapas da compra">
      {steps.map((step, index) => (
        <span className="confirmation-progress__step" key={step}>
          <span
            className={`confirmation-progress__number${index < 3 ? ' is-done' : ' is-current'}`}
            aria-hidden="true"
          >
            {index < 3 ? '✓' : index + 1}
          </span>
          <span aria-current={index === 3 ? 'step' : undefined}>{step}</span>
          {index < steps.length - 1 && <span className="confirmation-progress__line" aria-hidden="true" />}
        </span>
      ))}
    </nav>
  )
}

function OrderSummary({ items, delivery }) {
  const subtotal = items.reduce((total, item) => total + Number(item.price) * item.quantity, 0)
  const shipping = delivery ? getShippingOptions()[delivery.shippingMethod].price : 0

  return (
    <aside className="confirmation-summary" aria-labelledby="confirmation-summary-title">
      <h2 id="confirmation-summary-title">Resumo do pedido</h2>
      <ul>
        {items.map((item) => (
          <li key={`${item.product_id}-${item.grind}`}>
            <span>{item.name} × {item.quantity}</span>
            <span>{currencyFormatter.format(Number(item.price) * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <p><span>Subtotal</span><span>{currencyFormatter.format(subtotal)}</span></p>
      {delivery && (
        <p>
          <span>Frete - {getShippingOptions()[delivery.shippingMethod].label}</span>
          <span>{currencyFormatter.format(shipping)}</span>
        </p>
      )}
      <div className="confirmation-summary__total">
        <strong>Total estimado</strong>
        <strong>{currencyFormatter.format(subtotal + shipping)}</strong>
      </div>
      <p className="confirmation-summary__notice">Prévia visual: nenhum pedido foi criado e nenhum pagamento foi processado.</p>
      <a className="confirmation-summary__button" href="/carrinho">Voltar ao carrinho</a>
      <a className="confirmation-summary__link" href="/loja">Voltar à loja</a>
    </aside>
  )
}

export default function ConfirmationPage() {
  const { items, error } = readCart()
  const { delivery, error: deliveryError } = readDelivery()
  const address = delivery?.address
  const shippingLabel = delivery ? getShippingOptions()[delivery.shippingMethod].label : ''

  return (
    <div className="public-site confirmation-page">
      <Navbar activePage="cart" />
      <main className="confirmation-main">
        <header className="confirmation-heading">
          <p>Finalizar compra · Etapa 4 de 4 · Prévia</p>
          <CheckoutProgress />
        </header>
        {(error || deliveryError) && <p className="confirmation-feedback" role="alert">{error || deliveryError}</p>}
        {items.length === 0 ? (
          <section className="confirmation-empty">
            <h1>Seu carrinho está vazio</h1>
            <p>Adicione cafés para visualizar a prévia da confirmação.</p>
            <a href="/loja">Explorar cafés</a>
          </section>
        ) : (
          <>
            <header className="confirmation-hero">
              <span className="confirmation-hero__icon" aria-hidden="true">✓</span>
              <p>DEMONSTRAÇÃO · SEM PEDIDO</p>
              <h1>Prévia da confirmação</h1>
              <p>Esta tela demonstra a etapa final do checkout. Nenhum pedido foi criado ou confirmado.</p>
            </header>

            <div className="confirmation-layout">
              <div className="confirmation-column">
                <section className="confirmation-card confirmation-next-steps" aria-labelledby="confirmation-next-title">
                  <p className="confirmation-overline">Próximos passos</p>
                  <h2 id="confirmation-next-title">Acompanhe seu café</h2>
                  <ol>
                    <li>
                      <span>1</span>
                      <div><strong>Pagamento</strong><p>O pagamento ainda não está configurado.</p></div>
                    </li>
                    <li>
                      <span>2</span>
                      <div><strong>Torra e moagem</strong><p>O pedido só será preparado após uma integração de pagamento.</p></div>
                    </li>
                    <li>
                      <span>3</span>
                      <div><strong>Envio</strong><p>Nenhum código de rastreio foi gerado.</p></div>
                    </li>
                    <li>
                      <span>4</span>
                      <div><strong>Entrega</strong><p>{shippingLabel ? `${shippingLabel} · prazo estimado para demonstração` : 'Frete não informado'}</p></div>
                    </li>
                  </ol>
                </section>

                <div className="confirmation-details">
                  <section className="confirmation-card confirmation-info">
                    <p className="confirmation-overline">Entrega</p>
                    {address ? (
                      <>
                        <strong>{address.recipient}</strong>
                        <p>{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ''}<br />
                          {address.neighborhood} · {address.city}/{address.state}<br />
                          CEP {address.postalCode}</p>
                      </>
                    ) : (
                      <p>Endereço ainda não informado. <a href="/destino">Adicionar endereço</a></p>
                    )}
                  </section>
                  <section className="confirmation-card confirmation-info">
                    <p className="confirmation-overline">Pagamento</p>
                    <strong>Não configurado</strong>
                    <p>Nenhum dado de pagamento foi coletado.</p>
                  </section>
                </div>
              </div>
              <OrderSummary items={items} delivery={delivery} />
            </div>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}
