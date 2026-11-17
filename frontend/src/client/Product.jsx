/// <reference types="vite/client" />

import { useEffect, useState } from 'react'
import api from '../services/api'
import { addCartItem } from '../services/cart'
import { currencyFormatter } from '../admin/formatters'
import Navbar from '../components/Navbar'
import '../styles/Product.scss'

const grinds = ['Grãos inteiros', 'Moagem fina', 'Moagem média', 'Moagem grossa']

function productSpec(label, value) {
  return [label, value]
}

function getCategoryLabel(category) {
  const labels = {
    graos: 'Café em grãos',
    moidos: 'Café moído',
    acessorios: 'Acessório',
    kits: 'Kit especial',
  }
  return labels[category] || 'Produto Origin & Beans'
}

function Gallery({ product }) {
  return (
    <div className="gallery">
      {product.image_url ? (
        <img className="gallery__main" src={product.image_url} alt={product.name} />
      ) : (
        <div className="gallery__main gallery__main--empty" role="img" aria-label={`Imagem de ${product.name} indisponível`}>
          <span aria-hidden="true">OB</span>
          <span>Imagem indisponível</span>
        </div>
      )}
    </div>
  )
}

function GrindSelector({ value, onChange }) {
  return (
    <fieldset className="grind">
      <legend className="grind__legend">Como prefere receber?</legend>
      {grinds.map((label, index) => {
        const id = `product-grind-${index}`
        return (
          <span key={label} className="grind__option">
            <input
              className="grind__input"
              type="radio"
              name="product-grind"
              id={id}
              value={label}
              checked={value === label}
              onChange={() => onChange(label)}
            />
            <label className="grind__label" htmlFor={id}>{label}</label>
          </span>
        )
      })}
    </fieldset>
  )
}

function Quantity({ value, onChange }) {
  return (
    <div className="quantity" aria-label="Quantidade">
      <button
        className="quantity__button"
        type="button"
        aria-label="Diminuir quantidade"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </button>
      <span className="quantity__value" aria-live="polite">{value}</span>
      <button
        className="quantity__button"
        type="button"
        aria-label="Aumentar quantidade"
        disabled={value >= 99}
        onClick={() => onChange(Math.min(99, value + 1))}
      >
        +
      </button>
    </div>
  )
}

function ProductInfo({ product, onAdd }) {
  const [grind, setGrind] = useState(grinds[0])
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState('')
  const notes = Array.isArray(product.sensory_notes) ? product.sensory_notes : []
  function addProduct() {
    const error = onAdd(quantity, product.category === 'graos' ? grind : 'Não se aplica')
    setFeedback(error || `${product.name} adicionado ao carrinho.`)
  }

  return (
    <div className="product-info">
      <p className="product-info__category">{getCategoryLabel(product.category)}</p>
      <h1 className="product-info__name">{product.name}</h1>
      {product.score && <span className="tag tag--filled">{product.score} pts</span>}
      <p className="product-info__price">{currencyFormatter.format(Number(product.price))}</p>
      {product.weight_grams && <p className="product-info__price-note">{product.weight_grams} g</p>}

      {notes.length > 0 && (
        <>
          <p className="product-info__label">Notas sensoriais</p>
          <div className="product-info__tags product-info__tags--notes">
            {notes.map((note) => <span key={note} className="tag tag--note">{note}</span>)}
          </div>
        </>
      )}

      {product.category === 'graos' && <GrindSelector value={grind} onChange={setGrind} />}

      <div className="purchase">
        <Quantity value={quantity} onChange={setQuantity} />
        <button
          className="purchase__add"
          type="button"
          disabled={!product.in_stock}
          onClick={addProduct}
        >
          {product.in_stock ? 'Adicionar ao carrinho' : 'Fora de estoque'}
        </button>
      </div>
      {feedback && <p className="purchase__feedback" role="status">{feedback}</p>}

      {product.description && (
        <section className="product-info__description">
          <h2 className="product-info__description-title">Sobre este café</h2>
          <p className="product-info__description-text">{product.description}</p>
        </section>
      )}
      <p className="product-info__cart-note">
        O carrinho fica salvo neste navegador. Os pagamentos são processados pelo Mercado Pago.
      </p>
    </div>
  )
}

function Details({ product }) {
  const specs = [
    productSpec('Origem', product.origin),
    productSpec('Produtor', product.producer),
    productSpec('Altitude', product.altitude ? `${product.altitude} m` : null),
    productSpec('Variedade', product.variety),
    productSpec('Pontuação', product.score ? `${product.score} pts` : null),
    productSpec('Peso', product.weight_grams ? `${product.weight_grams} g` : null),
  ].filter(([, value]) => value)
  const notes = Array.isArray(product.sensory_notes) ? product.sensory_notes : []

  if (specs.length === 0 && notes.length === 0) return null

  return (
    <section className="details">
      {specs.length > 0 && (
        <article className="info-card">
          <p className="info-card__eyebrow">Ficha do produto</p>
          <h2 className="info-card__title">Origem e detalhes</h2>
          <dl className="spec-list">
            {specs.map(([term, value]) => (
              <div key={term} className="spec-list__item">
                <dt className="spec-list__term">{term}</dt>
                <dd className="spec-list__value">{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      )}
      {notes.length > 0 && (
        <article className="info-card">
          <p className="info-card__eyebrow">Na xícara</p>
          <h2 className="info-card__title">Notas sensoriais</h2>
          <ul className="details__notes">
            {notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </article>
      )}
    </section>
  )
}

function QuizCta() {
  return (
    <section className="quiz-cta">
      <div>
        <p className="quiz-cta__eyebrow">Taste Finder</p>
        <h2 className="quiz-cta__title">Este café combina com você?</h2>
      </div>
      <a href="/quiz" className="quiz-cta__button">Descobrir meu perfil</a>
    </section>
  )
}

function Related({ items, onAdd }) {
  if (items.length === 0) return null

  return (
    <section className="related">
      <h2 className="related__title">Você também pode gostar</h2>
      <div className="related__grid">
        {items.map((product) => (
          <article key={product.id} className="related-card">
            <a href={`/produto/${product.id}`} aria-label={`Ver ${product.name}`}>
              {product.image_url ? (
                <img className="related-card__image" src={product.image_url} alt="" loading="lazy" />
              ) : (
                <div className="related-card__image related-card__image--empty" aria-hidden="true">OB</div>
              )}
              <h3 className="related-card__name">{product.name}</h3>
            </a>
            <p className="related-card__meta">
              <span>{product.origin || getCategoryLabel(product.category)}</span>
              {product.score && <span>{product.score} pts</span>}
            </p>
            <p className="related-card__price">{currencyFormatter.format(Number(product.price))}</p>
            <button
              className="related-card__button"
              type="button"
              disabled={!product.in_stock}
              onClick={() => onAdd(product)}
            >
              {product.in_stock ? 'Adicionar ao carrinho' : 'Fora de estoque'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function BottomBar() {
  return (
    <footer className="bottom-bar">
      <p>© 2026 Origin &amp; Beans. Todos os direitos reservados.</p>
      <a href="/loja">Continuar explorando</a>
    </footer>
  )
}

function ProductState({ loading, error, empty }) {
  if (loading) return <div className="product-state" role="status">Carregando produto...</div>
  if (error) return <div className="product-state product-state--error" role="alert">{error}</div>
  if (empty) {
    return (
      <div className="product-state">
        <p>Este produto não foi encontrado ou não está mais disponível.</p>
        <a href="/loja">Voltar para a loja</a>
      </div>
    )
  }
  return null
}

export default function ProductPage({ productId }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const product = products.find((item) => String(item.id) === productId)
  const related = products.filter((item) => String(item.id) !== productId).slice(0, 3)

  useEffect(() => {
    let active = true
    api.get('/vitrine/produtos')
      .then(({ data }) => {
        if (active) setProducts(data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Não foi possível carregar este produto.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function addProductToCart(item, quantity = 1, grind = 'Não se aplica') {
    const message = addCartItem(item, quantity, grind)
    return message
  }

  return (
    <div className="product-page-shell">
      <Navbar activePage="store" />
      <main className="page">
        {loading || error || !product ? (
          <ProductState loading={loading} error={error} empty={!loading && !error && !product} />
        ) : (
          <>
            <nav className="product-breadcrumb" aria-label="Breadcrumb">
              <a href="/loja">Loja</a><span aria-hidden="true">/</span><span>{product.name}</span>
            </nav>
            <section className="product">
              <Gallery product={product} />
              <ProductInfo product={product} onAdd={(quantity, grind) => addProductToCart(product, quantity, grind)} />
            </section>
            <Details product={product} />
            <QuizCta />
            <Related items={related} onAdd={(item) => addProductToCart(item)} />
          </>
        )}
      </main>
      <BottomBar />
    </div>
  )
}
