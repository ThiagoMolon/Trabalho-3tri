import { useState } from 'react'
import Navbar from '../../components/Navbar'
import { readCart } from '../../services/cart'
import { getShippingOptions, readDelivery, saveDelivery } from '../../services/checkout'
import { currencyFormatter } from '../../admin/formatters'
import { PublicFooter } from '../../client/Storefront'
import '../../styles/Destination.scss'

const steps = ['Carrinho', 'Destino', 'Pagamento', 'Confirmação']
const states = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]
const shippingOptions = getShippingOptions()

function formatPostalCode(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

function CheckoutProgress() {
  return (
    <nav className="destination-progress" aria-label="Etapas da compra">
      {steps.map((step, index) => (
        <span className="destination-progress__step" key={step}>
          <span
            className={`destination-progress__number${index < 1 ? ' is-complete' : index === 1 ? ' is-current' : ''}`}
            aria-hidden="true"
          >
            {index === 0 ? '✓' : index + 1}
          </span>
          <span aria-current={index === 1 ? 'step' : undefined}>{step}</span>
          {index < steps.length - 1 && <span className="destination-progress__line" aria-hidden="true" />}
        </span>
      ))}
    </nav>
  )
}

function OrderSummary({ items, shippingMethod }) {
  const subtotal = items.reduce((total, item) => total + Number(item.price) * item.quantity, 0)
  const shipping = shippingOptions[shippingMethod].price

  return (
    <aside className="destination-summary" aria-labelledby="destination-summary-title">
      <h2 id="destination-summary-title">Resumo do pedido</h2>
      <ul className="destination-summary__items">
        {items.map((item) => (
          <li key={`${item.product_id}-${item.grind}`}>
            <span>{item.name} × {item.quantity}</span>
            <span>{currencyFormatter.format(Number(item.price) * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="destination-summary__line">
        <span>Subtotal</span><span>{currencyFormatter.format(subtotal)}</span>
      </div>
      <div className="destination-summary__line">
        <span>Frete - {shippingOptions[shippingMethod].label}</span>
        <span>{currencyFormatter.format(shipping)}</span>
      </div>
      <div className="destination-summary__total">
        <strong>Total hoje</strong>
        <strong>{currencyFormatter.format(subtotal + shipping)}</strong>
      </div>
      <p className="destination-summary__notice">Frete estimado para demonstração; o valor não é calculado por uma transportadora.</p>
      <button className="destination-summary__button" type="submit" form="destination-form">
        Continuar pagamento
      </button>
      <a className="destination-summary__link" href="/loja">Continuar comprando</a>
    </aside>
  )
}

export default function DestinationPage() {
  const cart = readCart()
  const storedDelivery = readDelivery()
  const initialAddress = storedDelivery.delivery?.address || {}
  const [shippingMethod, setShippingMethod] = useState(storedDelivery.delivery?.shippingMethod || 'pac')
  const [postalCode, setPostalCode] = useState(() => formatPostalCode(initialAddress.postalCode || ''))
  const [feedback, setFeedback] = useState(cart.error || storedDelivery.error)

  function continueToPayment(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const address = {
      recipient: String(formData.get('recipient') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      postalCode: String(formData.get('postalCode') || '').trim(),
      street: String(formData.get('street') || '').trim(),
      number: String(formData.get('number') || '').trim(),
      complement: String(formData.get('complement') || '').trim(),
      neighborhood: String(formData.get('neighborhood') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      state: String(formData.get('state') || ''),
      addressType: String(formData.get('addressType') || 'Casa'),
      isDefault: formData.get('isDefault') === 'on',
    }

    const error = saveDelivery({ address, shippingMethod })
    if (error) {
      setFeedback(error)
      return
    }
    window.location.assign('/pagamento')
  }

  return (
    <div className="public-site destination-page">
      <Navbar activePage="cart" />
      <main className="destination-main">
        <header className="destination-heading">
          <p>Finalizar compra · Etapa 2 de 4</p>
          <CheckoutProgress />
        </header>

        {feedback && <p className="destination-feedback" role={cart.error || storedDelivery.error ? 'alert' : 'status'}>{feedback}</p>}
        {cart.items.length === 0 ? (
          <section className="destination-empty">
            <h1>Seu carrinho está vazio</h1>
            <p>Adicione cafés antes de informar o endereço de entrega.</p>
            <a href="/loja">Explorar cafés</a>
          </section>
        ) : (
          <div className="destination-layout">
            <div className="destination-column">
              <section className="destination-card" aria-labelledby="destination-title">
                <p className="destination-overline">Destino</p>
                <h1 id="destination-title">Onde devemos entregar?</h1>
                <p className="destination-intro">Preencha o endereço para continuar. O frete exibido é apenas uma estimativa demonstrativa.</p>

                <form id="destination-form" onSubmit={continueToPayment}>
                  <div className="destination-fields">
                    <div className="destination-field destination-field--full">
                      <label htmlFor="recipient">Nome completo do destinatário</label>
                      <input id="recipient" name="recipient" autoComplete="name" defaultValue={initialAddress.recipient || ''} required />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="phone">Telefone com DDD</label>
                      <input id="phone" name="phone" type="tel" placeholder="(00) 00000-0000" autoComplete="tel" defaultValue={initialAddress.phone || ''} required />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="postalCode">CEP</label>
                      <input
                        id="postalCode"
                        name="postalCode"
                        inputMode="numeric"
                        placeholder="00000-000"
                        autoComplete="postal-code"
                        value={postalCode}
                        onChange={(event) => setPostalCode(formatPostalCode(event.target.value))}
                        pattern="[0-9]{5}-[0-9]{3}"
                        maxLength={9}
                        title="Digite um CEP com 8 números."
                        required
                      />
                    </div>
                    <div className="destination-field destination-field--street">
                      <label htmlFor="street">Rua / Avenida</label>
                      <input id="street" name="street" autoComplete="address-line1" defaultValue={initialAddress.street || ''} required />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="number">Número</label>
                      <input id="number" name="number" autoComplete="address-line2" defaultValue={initialAddress.number || ''} required />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="complement">Complemento (opcional)</label>
                      <input id="complement" name="complement" placeholder="Apto, bloco, referência" defaultValue={initialAddress.complement || ''} />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="neighborhood">Bairro</label>
                      <input id="neighborhood" name="neighborhood" autoComplete="address-level3" defaultValue={initialAddress.neighborhood || ''} required />
                    </div>
                    <div className="destination-field destination-field--city">
                      <label htmlFor="city">Cidade</label>
                      <input id="city" name="city" autoComplete="address-level2" defaultValue={initialAddress.city || ''} required />
                    </div>
                    <div className="destination-field">
                      <label htmlFor="state">Estado</label>
                      <select id="state" name="state" autoComplete="address-level1" defaultValue={initialAddress.state || ''} required>
                        <option value="">Selecionar</option>
                        {states.map((state) => <option key={state}>{state}</option>)}
                      </select>
                    </div>
                  </div>

                  <fieldset className="destination-address-type">
                    <legend>Salvar como</legend>
                    {['Casa', 'Trabalho', 'Outro'].map((type) => (
                      <label key={type}>
                        <input type="radio" name="addressType" value={type} defaultChecked={(initialAddress.addressType || 'Casa') === type} />
                        <span>{type}</span>
                      </label>
                    ))}
                  </fieldset>
                  <label className="destination-default">
                    <input type="checkbox" name="isDefault" defaultChecked={initialAddress.isDefault ?? true} />
                    <span>Usar como endereço padrão</span>
                  </label>
                </form>
              </section>

              <fieldset className="destination-card destination-shipping">
                <legend>Escolha do frete</legend>
                {Object.entries(shippingOptions).map(([id, option]) => (
                  <label className="destination-shipping__option" key={id}>
                    <input type="radio" name="shipping" value={id} checked={shippingMethod === id} onChange={() => setShippingMethod(id)} />
                    <span><strong>{option.label}</strong><small>{id === 'pac' ? '7 a 14 dias úteis' : '2 a 4 dias úteis'}</small></span>
                    <strong>{currencyFormatter.format(option.price)}</strong>
                  </label>
                ))}
              </fieldset>
            </div>
            <OrderSummary items={cart.items} shippingMethod={shippingMethod} />
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}
