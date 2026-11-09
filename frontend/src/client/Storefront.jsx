import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { addCartItem, readCart, removeCartItem, updateCartItem } from '../services/cart'
import { currencyFormatter } from '../admin/formatters'
import '../styles/Storefront.scss'

const categories = [
  ['todos', 'Todas as categorias'],
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

function usePublicData(path, fallbackMessage) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get(path)
      .then(({ data: result }) => {
        if (active) setData(result)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || fallbackMessage)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [path, fallbackMessage])

  return { data, loading, error }
}

function getCartCount() {
  const { items } = readCart()
  return items.reduce((total, item) => total + item.quantity, 0)
}

function PublicHeader({ activePage }) {
  const [cartCount, setCartCount] = useState(getCartCount)

  useEffect(() => {
    function updateCount() {
      setCartCount(getCartCount())
    }
    window.addEventListener('origin-cart-updated', updateCount)
    window.addEventListener('storage', updateCount)
    return () => {
      window.removeEventListener('origin-cart-updated', updateCount)
      window.removeEventListener('storage', updateCount)
    }
  }, [])

  return (
    <header className="public-header">
      <a className="public-brand" href="/loja" aria-label="Origin & Beans, início">
        <span className="coffee-mark" aria-hidden="true">OB</span>
        <span>Origin <em>&amp;</em> <b>Beans</b></span>
      </a>
      <nav className="public-nav" aria-label="Navegação principal">
        <a href="/loja" aria-current={activePage === 'store' ? 'page' : undefined}>Loja</a>
        <a href="/clube" aria-current={activePage === 'plans' ? 'page' : undefined}>Clube</a>
        <a href="/quiz" aria-current={activePage === 'quiz' ? 'page' : undefined}>Taste Finder</a>
        <a href="/login">Minha conta</a>
        <a className="public-cart-link" href="/carrinho" aria-label={`Carrinho, ${cartCount} itens`}>
          Carrinho ({cartCount})
        </a>
      </nav>
    </header>
  )
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
  const [category, setCategory] = useState('todos')
  const [sort, setSort] = useState('name')
  const [feedback, setFeedback] = useState('')

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return products
      .filter((product) => category === 'todos' || product.category === category)
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
      <PublicHeader activePage="store" />
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
        <PublicHeader />
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
      <PublicHeader activePage="store" />
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
            <p className="local-cart-note">O carrinho fica salvo neste navegador. O checkout e o pagamento ainda não estão disponíveis.</p>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}

function SubscriptionPlans() {
  const { data: plans, loading, error } = usePublicData('/vitrine/planos', 'Não foi possível carregar os planos.')
  return (
    <div className="public-site">
      <PublicHeader activePage="plans" />
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
                <article className="plan-card" key={plan.id}>
                  <p className="plan-frequency">{plan.frequency}</p>
                  <h3>{plan.name}</h3>
                  <p className="plan-price">{currencyFormatter.format(Number(plan.price))}<span> / {plan.frequency}</span></p>
                  {plan.description && <p className="plan-description">{plan.description}</p>}
                  <div className="plan-products">
                    <strong>O que acompanha</strong>
                    <ul>{plan.products.map((product) => <li key={product.id}>{product.name}</li>)}</ul>
                  </div>
                  <button className="plan-unavailable" type="button" disabled title="Contratação online indisponível">
                    Contratação online indisponível
                  </button>
                </article>
              ))}
            </div>
          </StoreState>
          <p className="plans-disclaimer">As assinaturas ainda não podem ser contratadas online.</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}

function CartPage() {
  const [items, setItems] = useState(() => readCart().items)
  const [error, setError] = useState(() => readCart().error)
  const subtotal = items.reduce((total, item) => total + Number(item.price) * item.quantity, 0)

  function refreshCart() {
    const result = readCart()
    setItems(result.items)
    setError(result.error)
  }

  function updateItem(item, quantity) {
    const result = updateCartItem(item.product_id, item.grind, quantity)
    if (result) setError(result)
    else {
      setError('')
      refreshCart()
    }
  }

  function removeItem(item) {
    const result = removeCartItem(item.product_id, item.grind)
    if (result) setError(result)
    else {
      setError('')
      refreshCart()
    }
  }

  return (
    <div className="public-site">
      <PublicHeader />
      <main className="cart-main">
        <p className="store-overline">SUA SELEÇÃO</p>
        <h1>Carrinho</h1>
        {error && <p className="feedback-error" role="alert">{error}</p>}
        {items.length === 0 ? (
          <section className="cart-empty store-state">
            <h2>Seu carrinho está vazio</h2>
            <a className="gold-button button-link" href="/loja">Explorar cafés</a>
          </section>
        ) : (
          <div className="cart-layout">
            <div className="cart-items">
              {items.map((item) => (
                <article className="cart-item" key={`${item.product_id}-${item.grind}`}>
                  <ProductImage product={item} />
                  <div className="cart-item-copy">
                    <h2>{item.name}</h2>
                    <p>{item.weight_grams ? `${item.weight_grams} g · ` : ''}{item.grind}</p>
                    <strong>{currencyFormatter.format(Number(item.price) * item.quantity)}</strong>
                  </div>
                  <div className="cart-item-controls">
                    <label className="visually-hidden" htmlFor={`quantity-${item.product_id}-${item.grind}`}>Quantidade de {item.name}</label>
                    <select id={`quantity-${item.product_id}-${item.grind}`} value={item.quantity} onChange={(event) => updateItem(item, Number(event.target.value))}>
                      {Array.from({ length: 10 }, (_, index) => index + 1).map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
                    </select>
                    <button className="text-button" type="button" onClick={() => removeItem(item)}>Remover</button>
                  </div>
                </article>
              ))}
            </div>
            <aside className="cart-summary">
              <h2>Resumo do pedido</h2>
              <p><span>Subtotal</span><strong>{currencyFormatter.format(subtotal)}</strong></p>
              <button className="gold-button" type="button" disabled title="Checkout indisponível">Checkout indisponível</button>
              <a href="/loja">Continuar comprando</a>
              <p className="local-cart-note">O checkout e o pagamento online ainda não estão disponíveis.</p>
            </aside>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}

export { CartPage, ProductDetails, PublicFooter, PublicHeader, Storefront, SubscriptionPlans }
