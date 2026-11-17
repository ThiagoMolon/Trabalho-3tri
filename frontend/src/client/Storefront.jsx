import { useMemo, useState } from 'react'
import api from '../services/api'
import { addCartItem, addSubscriptionCartItem, readCart, removeCartItem, serializeCartItems, updateCartItem } from '../services/cart'
import { clearShippingQuote, readShippingQuote, saveShippingQuote } from '../services/checkout'
import usePublicData from '../services/usePublicData'
import { currencyFormatter } from '../admin/formatters'
import Navbar from '../components/Navbar'
import '../styles/Storefront.scss'

const categories = [
  ['todos', 'Todas as categorias'],
  ['cafes', 'Cafés em grãos e moídos'],
  ['graos', 'Cafés em grãos'],
  ['moidos', 'Cafés moídos'],
  ['acessorios', 'Acessórios'],
  ['kits', 'Kits'],
]

const grinds = ['Grãos inteiros', 'Moagem fina', 'Moagem média', 'Moagem grossa']

function ProductImage({ product, large = false }) {
  return (
    <div className={`product-image${large ? ' product-image-large' : ''}`}>
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} />
      ) : (
        <div className="product-image-empty" aria-label="Imagem não disponível">
          <span aria-hidden="true">OB</span>
          <span>Origin &amp; Beans</span>
        </div>
      )}
    </div>
  )
}

function StoreState({ loading, error, empty, children }) {
  if (loading) return <div className="store-state" role="status">Carregando...</div>
  if (error) return <div className="store-state feedback-error" role="alert">{error}</div>
  if (empty) return <div className="store-state">{empty}</div>
  return children
}

function PublicFooter() {
  return (
    <footer className="public-footer">
      <span>© {new Date().getFullYear()} Origin &amp; Beans</span>
      <a href="/quiz">Descubra seu perfil de café</a>
    </footer>
  )
}

function TasteBanner() {
  return (
    <section className="taste-banner">
      <div>
        <p>Taste Finder</p>
        <h2>Descubra o café que combina com você.</h2>
      </div>
      <a className="light-button button-link" href="/quiz">Fazer o quiz</a>
    </section>
  )
}

function CartCheckoutSteps() {
  const steps = ['Carrinho', 'Destino', 'Pagamento', 'Confirmação']

  return (
    <nav className="cart-checkout-steps" aria-label="Etapas da compra">
      <p>Finalizar compra</p>
      <ol>
        {steps.map((step, index) => (
          <li key={step} aria-current={index === 0 ? 'step' : undefined}>
            <span className={index === 0 ? 'is-current' : ''}>{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function ProductCard({ product, onAdd }) {
  const notes = Array.isArray(product.sensory_notes) ? product.sensory_notes.join(', ') : ''
  return (
    <article className="store-product-card">
      <a className="store-product-link" href={`/produto/${product.id}`}>
        <ProductImage product={product} />
        <div className="store-product-copy">
          <span className="product-category">{product.origin || 'Café especial'}</span>
          <h2>{product.name}</h2>
          {product.weight_grams && <p>{product.weight_grams} g</p>}
          {notes && <p className="product-notes">{notes}</p>}
          {product.score && <p className="product-score">Pontuação: {product.score}</p>}
          <strong>{currencyFormatter.format(Number(product.price))}</strong>
          {!product.in_stock && <span className="stock-note">Fora de estoque</span>}
        </div>
      </a>
      <div className="add-to-cart">
        <button className="gold-button" type="button" disabled={!product.in_stock} onClick={() => onAdd(product)}>
          Adicionar ao carrinho
        </button>
      </div>
    </article>
  )
}

function CartFeedback({ message }) {
  return message ? <p className="inline-feedback" role="status">{message}</p> : null
}

function Storefront() {
  const { data: products, loading, error } = usePublicData('/vitrine/produtos', 'Não foi possível carregar os cafés.')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(() => {
    const requestedCategory = new URLSearchParams(window.location.search).get('categoria')
    return categories.some(([value]) => value === requestedCategory) ? requestedCategory : 'todos'
  })
  const [sort, setSort] = useState('name')
  const [feedback, setFeedback] = useState('')

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return products
      .filter((product) => category === 'todos'
        || (category === 'cafes' && ['graos', 'moidos'].includes(product.category))
        || product.category === category)
      .filter((product) => !normalizedQuery || [
        product.name,
        product.origin,
        product.description,
        ...(Array.isArray(product.sensory_notes) ? product.sensory_notes : []),
      ].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(normalizedQuery)))
      .sort((a, b) => sort === 'price'
        ? Number(a.price) - Number(b.price)
        : sort === 'score'
          ? Number(b.score || 0) - Number(a.score || 0)
          : a.name.localeCompare(b.name, 'pt-BR'))
  }, [products, category, query, sort])

  function addProduct(product) {
    const result = addCartItem(product)
    setFeedback(result || `${product.name} adicionado ao carrinho.`)
  }

  return (
    <div className="public-site">
      <Navbar activePage="store" />
      <section className="store-hero">
        <div>
          <p className="store-overline">ORIGEM &amp; TORRA CUIDADAS</p>
          <h1>Cafés especiais, escolhidos para você.</h1>
          <p>Conheça cafés de origem rastreável e encontre seu próximo favorito.</p>
        </div>
        <form className="store-search" onSubmit={(event) => { event.preventDefault(); setQuery(search) }}>
          <label className="visually-hidden" htmlFor="store-search">Buscar cafés</label>
          <input id="store-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por café, origem ou nota" />
          <button type="submit">Buscar</button>
        </form>
      </section>
      <main className="store-main">
        <aside className="store-filters">
          <div className="filter-heading"><h2>Filtros</h2><button type="button" onClick={() => { setCategory('todos'); setSearch(''); setQuery('') }}>Limpar</button></div>
          <label className="filter-field">Categoria
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </aside>
        <section className="store-results" aria-label="Catálogo de cafés">
          <div className="results-toolbar">
            <span>{visibleProducts.length} {visibleProducts.length === 1 ? 'produto' : 'produtos'}</span>
            <label>Ordenar por
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="name">Nome</option>
                <option value="price">Menor preço</option>
                <option value="score">Maior pontuação</option>
              </select>
            </label>
          </div>
          <StoreState loading={loading} error={error} empty={products.length === 0 ? 'Nenhum produto disponível no momento.' : visibleProducts.length === 0 ? 'Nenhum café encontrado com esses filtros.' : ''}>
            <div className="store-product-grid">
              {visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={addProduct} />)}
            </div>
          </StoreState>
          <CartFeedback message={feedback} />
        </section>
      </main>
      <TasteBanner />
      <PublicFooter />
    </div>
  )
}

function ProductDetails({ productId }) {
  const { data: products, loading, error } = usePublicData('/vitrine/produtos', 'Não foi possível carregar este café.')
  const [grind, setGrind] = useState(grinds[0])
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState('')
  const product = products.find((item) => String(item.id) === productId)

  if (loading || error || !product) {
    return (
      <div className="public-site">
        <Navbar activePage="store" />
        <main className="product-main">
          <StoreState loading={loading} error={error} empty="Este café não foi encontrado." />
        </main>
        <PublicFooter />
      </div>
    )
  }

  const notes = Array.isArray(product.sensory_notes) ? product.sensory_notes : []
  function addProduct() {
    const result = addCartItem(product, quantity, grind)
    setFeedback(result || `${product.name} adicionado ao carrinho.`)
  }

  return (
    <div className="public-site product-page">
      <Navbar activePage="store" />
      <main className="product-main">
        <nav className="store-overline" aria-label="Breadcrumb"><a href="/loja">Loja</a> / {product.name}</nav>
        <section className="product-detail">
          <ProductImage product={product} large />
          <div className="product-information">
            <p className="store-overline">{product.origin || 'Café especial'}</p>
            <h1>{product.name}</h1>
            <div className="product-tags">{notes.map((note) => <span key={note}>{note}</span>)}</div>
            <p className="product-price">{currencyFormatter.format(Number(product.price))}</p>
            {product.weight_grams && <p className="muted-copy">{product.weight_grams} g</p>}
            {product.description && <section className="product-description"><h2>Sobre este café</h2><p>{product.description}</p></section>}
            {product.category === 'graos' && (
              <fieldset className="grind-selector">
                <legend>Como prefere receber?</legend>
                {grinds.map((option) => (
                  <label key={option}><input type="radio" name="grind" checked={grind === option} onChange={() => setGrind(option)} />{option}</label>
                ))}
              </fieldset>
            )}
            <div className="product-buy-row">
              <div className="quantity-control">
                <button type="button" aria-label="Diminuir quantidade" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
                <span aria-live="polite">{quantity}</span>
                <button type="button" aria-label="Aumentar quantidade" onClick={() => setQuantity((value) => value + 1)}>+</button>
              </div>
              <div className="add-to-cart"><button className="gold-button" type="button" disabled={!product.in_stock} onClick={addProduct}>Adicionar ao carrinho</button></div>
            </div>
            <CartFeedback message={feedback} />
            {!product.in_stock && <p className="stock-note">Fora de estoque</p>}
            <p className="local-cart-note">O carrinho fica salvo neste navegador. O frete é estimado e o pagamento é simulado.</p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}

function SubscriptionPlans() {
  const { data: plans, loading, error } = usePublicData('/vitrine/planos', 'Não foi possível carregar os planos.')
  const [feedback, setFeedback] = useState('')

  function addPlan(plan, grind, frequency) {
    const result = addSubscriptionCartItem(plan, 1, grind, frequency)
    setFeedback(result || `${plan.name} adicionado ao carrinho.`)
  }

  return (
    <div className="public-site">
      <Navbar activePage="plans" />
      <section className="plans-hero">
        <p className="store-overline">CLUBE ORIGIN &amp; BEANS</p>
        <h1>Um café especial à sua porta.</h1>
        <p>Conheça nossos planos de assinatura e descubra novos sabores com a frequência que preferir.</p>
        <a className="light-button button-link" href="/loja">Explorar cafés</a>
      </section>
      <main className="plans-main">
        <section className="plans-section">
          <div className="plans-heading"><h2>Escolha seu plano</h2><p>Planos disponíveis</p></div>
          <StoreState loading={loading} error={error} empty={plans.length === 0 ? 'Ainda não há planos disponíveis.' : ''}>
            <div className="plans-grid">
              {plans.map((plan) => (
                <article className="plan-card" id={`plano-${plan.id}`} key={plan.id}>
                  <p className="plan-frequency">{plan.frequency}</p>
                  <h3>{plan.name}</h3>
                  <p className="plan-price">{currencyFormatter.format(Number(plan.price))}<span> / {plan.frequency}</span></p>
                  {plan.description && <p className="plan-description">{plan.description}</p>}
                  <div className="plan-products">
                    <strong>O que acompanha</strong>
                    <ul>{plan.products.map((product) => <li key={product.id}>{product.name}</li>)}</ul>
                  </div>
                  <SubscriptionPlanControls plan={plan} onAdd={addPlan} />
                </article>
              ))}
            </div>
          </StoreState>
          {feedback && <p className="inline-feedback" role="status">{feedback}</p>}
          <p className="plans-disclaimer">A contratação é registrada como assinatura de demonstração e o pagamento é simulado.</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}

function SubscriptionPlanControls({ plan, onAdd }) {
  const defaultFrequency = ['semanal', 'quinzenal', 'mensal', 'bimestral'].includes(plan.frequency)
    ? plan.frequency
    : 'mensal'
  const [frequency, setFrequency] = useState(defaultFrequency)
  const [grind, setGrind] = useState(grinds[0])

  return (
    <div className="plan-subscribe-controls">
      <label>Frequência
        <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
          <option value="semanal">Semanal</option>
          <option value="quinzenal">Quinzenal</option>
          <option value="mensal">Mensal</option>
          <option value="bimestral">A cada 2 meses</option>
        </select>
      </label>
      <label>Moagem
        <select value={grind} onChange={(event) => setGrind(event.target.value)}>
          {grinds.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <button className="gold-button" type="button" onClick={() => onAdd(plan, grind, frequency)}>
        Assinar
      </button>
    </div>
  )
}

function CartPage() {
  const [items, setItems] = useState(() => readCart().items)
  const [error, setError] = useState(() => readCart().error)
  const [cep, setCep] = useState(() => readShippingQuote().quote?.cep || '')
  const [shippingQuote, setShippingQuote] = useState(() => readShippingQuote().quote)
  const [shippingMethod, setShippingMethod] = useState(() => readShippingQuote().quote?.selected_method || 'pac')
  const [calculating, setCalculating] = useState(false)
  const [shippingError, setShippingError] = useState('')
  const [shippingNotice, setShippingNotice] = useState('')
  const subtotal = items.reduce((total, item) => total + Number(item.price) * item.quantity, 0)
  const selectedShipping = shippingQuote?.options.find((option) => option.id === shippingMethod)

  async function calculateShipping(event) {
    event.preventDefault()
    setCalculating(true)
    setShippingError('')
    setShippingNotice('')
    try {
      const { data } = await api.post('/shipping/calculate', {
        cep,
        items: serializeCartItems(items),
      })
      const quote = { ...data, selected_method: shippingMethod }
      const saveError = saveShippingQuote(quote)
      if (saveError) {
        setShippingError(saveError)
        return
      }
      setShippingQuote(quote)
      setShippingNotice(`Frete calculado para o CEP ${data.cep.slice(0, 5)}-${data.cep.slice(5)}.`)
    } catch (requestError) {
      setShippingError(requestError.response?.data?.message || 'Não foi possível calcular o frete.')
    } finally {
      setCalculating(false)
    }
  }

  function selectShipping(method) {
    setShippingMethod(method)
    if (shippingQuote) {
      const updatedQuote = { ...shippingQuote, selected_method: method }
      setShippingQuote(updatedQuote)
      const saveError = saveShippingQuote(updatedQuote)
      if (saveError) setShippingError(saveError)
    }
  }

  function refreshCart() {
    const result = readCart()
    setItems(result.items)
    setError(result.error)
  }

  function updateItem(item, quantity) {
    const result = updateCartItem(item, quantity)
    if (result) setError(result)
    else {
      setError('')
      setShippingQuote(null)
      refreshCart()
    }
  }

  function removeItem(item) {
    const result = removeCartItem(item)
    if (result) setError(result)
    else {
      setError('')
      setShippingQuote(null)
      refreshCart()
    }
  }

  return (
    <div className="public-site">
      <Navbar activePage="cart" />
      <main className="cart-main">
        <CartCheckoutSteps />
        {error && <p className="feedback-error" role="alert">{error}</p>}
        {items.length === 0 ? (
          <section className="cart-empty store-state">
            <h2>Seu carrinho está vazio</h2>
            <a className="gold-button button-link" href="/loja">Explorar cafés</a>
          </section>
        ) : (
          <div className="cart-layout">
            <div className="cart-items">
              <section className="cart-items-card" aria-labelledby="cart-title">
                <h1 id="cart-title">Seu carrinho</h1>
                <p className="cart-items-caption">{items.length} {items.length === 1 ? 'item' : 'itens'} selecionados para seu pedido</p>
                {items.map((item) => (
                  <article className="cart-item" key={`${item.item_type || 'product'}-${item.product_id || item.plan_id}-${item.grind}-${item.frequency || ''}`}>
                    {item.item_type === 'subscription' ? <div className="product-image-empty"><span>Clube</span></div> : <ProductImage product={item} />}
                    <div className="cart-item-copy">
                      <h2>{item.name}</h2>
                      <p>{item.item_type === 'subscription' ? `Assinatura ${item.frequency} · ` : item.weight_grams ? `${item.weight_grams} g · ` : ''}{item.grind}</p>
                    </div>
                    <div className="cart-item-controls">
                      <strong>{currencyFormatter.format(Number(item.price) * item.quantity)}</strong>
                      <label htmlFor={`quantity-${item.product_id || item.plan_id}-${item.grind}`}>Quantidade</label>
                      <select id={`quantity-${item.product_id || item.plan_id}-${item.grind}`} value={item.quantity} onChange={(event) => updateItem(item, Number(event.target.value))}>
                        {Array.from({ length: 10 }, (_, index) => index + 1).map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
                      </select>
                      <button className="text-button" type="button" onClick={() => removeItem(item)}>Remover</button>
                    </div>
                  </article>
                ))}
              </section>
            </div>
            <aside className="cart-summary">
              <h2>Resumo do pedido</h2>
              <p><span>Subtotal</span><strong>{currencyFormatter.format(subtotal)}</strong></p>
              <form className="cart-shipping-form" onSubmit={calculateShipping}>
                <label htmlFor="cart-cep">Calcular frete por CEP</label>
                <div>
                  <input id="cart-cep" inputMode="numeric" maxLength="9" value={cep}
                    onChange={(event) => {
                      setCep(event.target.value.replace(/\D/g, '').slice(0, 8))
                      setShippingQuote(null)
                      const clearError = clearShippingQuote()
                      if (clearError) setShippingError(clearError)
                    }}
                    placeholder="00000000" required />
                  <button type="submit" disabled={calculating || items.length === 0}>
                    {calculating ? 'Calculando...' : 'Calcular'}
                  </button>
                </div>
              </form>
              {shippingError && <p className="feedback-error" role="alert">{shippingError}</p>}
              {shippingNotice && <p className="inline-feedback" role="status">{shippingNotice}</p>}
              {shippingQuote && (
                <fieldset className="cart-shipping-options">
                  <legend>Opções de entrega</legend>
                  {shippingQuote.options.map((option) => (
                    <label key={option.id}>
                      <input type="radio" name="cart-shipping" checked={shippingMethod === option.id}
                        onChange={() => selectShipping(option.id)} />
                      <span>{option.label} · {option.min_days} a {option.max_days} dias úteis</span>
                      <strong>{currencyFormatter.format(Number(option.cost))}</strong>
                    </label>
                  ))}
                </fieldset>
              )}
              {selectedShipping && <p><span>Frete</span><strong>{currencyFormatter.format(Number(selectedShipping.cost))}</strong></p>}
              <p className="cart-summary-total"><span>Total</span><strong>{currencyFormatter.format(subtotal + Number(selectedShipping?.cost || 0))}</strong></p>
              <a className="gold-button button-link" href={shippingQuote ? '/destino' : undefined}
                aria-disabled={!shippingQuote} onClick={(event) => { if (!shippingQuote) event.preventDefault() }}>
                Continuar para entrega
              </a>
              <a href="/loja">Continuar comprando</a>
              <p className="local-cart-note">Frete calculado por estimativa de faixa de CEP e peso; pagamento simulado no checkout.</p>
            </aside>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}

export { CartPage, ProductDetails, PublicFooter, Storefront, SubscriptionPlans }
