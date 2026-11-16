import { useState } from 'react'
import { currencyFormatter } from '../admin/formatters'
import { addCartItem } from '../services/cart'
import usePublicData from '../services/usePublicData'
import Navbar from '../components/Navbar'
import '../styles/Landpage.scss'

const categories = [
  { id: 'coffee', label: <>Cafés de origem<br />em grãos e moídos</>, icon: '/images/category-coffee.svg', href: '/loja?categoria=cafes' },
  { id: 'quiz', label: <>Descubra seu<br />paladar</>, icon: '/images/category-preparo.svg', href: '/quiz' },
  { id: 'accessories', label: 'Acessórios', icon: '/images/category-accessories.svg', href: '/loja?categoria=acessorios' },
  { id: 'kits', label: <>Kits<br />especiais</>, icon: '/images/category-kits.svg', href: '/loja?categoria=kits' },
  { id: 'subscriptions', label: <>Assinaturas<br />personalizadas</>, icon: '/images/category-subscriptions.svg', href: '/clube' },
]

function Hero() {
  return (
    <section className="landing-hero">
      <div className="landing-hero__inner">
        <div className="landing-hero__copy">
          <h1>Cafés especiais, do plantio à sua xícara</h1>
          <p className="landing-hero__tagline">Descubra o café que combina com você.</p>
          <p>
            Uma experiência personalizada, com cafés de origem, assinaturas sob medida e tudo o que você precisa para viver o melhor do café.
          </p>
          <a className="gold-button" href="/quiz">Fazer o Taste Finder</a>
        </div>
      </div>
    </section>
  )
}

function Categories() {
  return (
    <nav className="landing-categories" aria-label="Explore a Origin & Beans">
      <ul>
        {categories.map(({ id, label, icon, href }) => (
          <li key={id}>
            <a href={href}>
              <img src={icon} alt="" aria-hidden="true" />
              <span>{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ProductCard({ product, onAdd }) {
  const notes = Array.isArray(product.sensory_notes) ? product.sensory_notes.filter(Boolean) : []
  const [imageError, setImageError] = useState(false)

  return (
    <article className="featured-card">
      <a className="featured-card__visual" href={`/produto/${product.id}`} aria-label={`Ver detalhes de ${product.name}`}>
        {product.image_url && !imageError ? (
          <img src={product.image_url} alt={product.name} loading="lazy" onError={() => setImageError(true)} />
        ) : (
          <div className="featured-card__placeholder" role="img" aria-label={`Imagem de ${product.name} ainda não cadastrada`}>
            <span className="featured-card__pack">
              <span className="featured-card__pack-brand">Origin &amp; Beans</span>
              <span className="featured-card__pack-origin">{product.origin || 'Café especial'}</span>
            </span>
          </div>
        )}
        {product.origin && <span className="featured-card__origin">{product.origin}</span>}
      </a>
      <div className="featured-card__body">
        <h3><a href={`/produto/${product.id}`}>{product.name}</a></h3>
        {product.weight_grams && <p className="featured-card__detail">{product.weight_grams} g</p>}
        {notes.length > 0 && <p className="featured-card__detail"><span>Notas:</span> {notes.join(', ')}</p>}
        {product.score != null && <p className="featured-card__detail"><span>Pontuação:</span> {product.score}</p>}
        <strong className="featured-card__price">{currencyFormatter.format(Number(product.price))}</strong>
        <button type="button" onClick={() => onAdd(product)} disabled={!product.in_stock}>
          {product.in_stock ? 'Adicionar ao carrinho' : 'Fora de estoque'}
        </button>
      </div>
    </article>
  )
}

function Featured({ products, loading, error, onAdd }) {
  const featuredProducts = [...products]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 3)

  return (
    <section className="landing-featured" aria-labelledby="featured-title">
      <header className="landing-section-heading">
        <h2 id="featured-title">Nossos cafés em destaque</h2>
        <p>Uma seleção de cafés especiais com origem e notas para explorar.</p>
      </header>
      {loading ? (
        <p className="landing-state" role="status">Carregando cafés...</p>
      ) : error ? (
        <div className="landing-state landing-state--error" role="alert">
          <p>{error}</p>
          <a href="/loja">Abrir a loja</a>
        </div>
      ) : featuredProducts.length === 0 ? (
        <p className="landing-state">Ainda não há cafés ativos para exibir. Volte em breve para conhecer a seleção.</p>
      ) : (
        <div className="featured-grid">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={onAdd} />
          ))}
        </div>
      )}
    </section>
  )
}

function TasteFinder() {
  return (
    <section className="landing-taste">
      <div className="landing-taste__inner">
        <h2>Taste Finder: qual é o seu perfil de paladar?</h2>
        <p>Responda algumas perguntas e descubra cafés que combinam com o seu gosto.</p>
        <a className="light-button" href="/quiz">Fazer o quiz</a>
      </div>
    </section>
  )
}

function PlanCard({ plan, featured }) {
  const period = {
    semanal: 'semana',
    mensal: 'mês',
    bimestral: '2 meses',
  }[plan.frequency] || plan.frequency

  return (
    <article className={`landing-plan${featured ? ' landing-plan--featured' : ''}`}>
      <p className="landing-plan__frequency">{plan.frequency}</p>
      <h3>{plan.name}</h3>
      <p className="landing-plan__price">
        {currencyFormatter.format(Number(plan.price))}
        <span> / {period}</span>
      </p>
      {plan.description && <p className="landing-plan__description">{plan.description}</p>}
      {plan.products?.length > 0 && (
        <ul className="landing-plan__products">
          {plan.products.map((product) => <li key={product.id}>{product.name}</li>)}
        </ul>
      )}
      <a href={`/clube#plano-${plan.id}`}>Conhecer plano</a>
    </article>
  )
}

function Plans({ plans, loading, error }) {
  const featuredIndex = Math.floor(plans.length / 2)

  return (
    <section className="landing-plans" aria-labelledby="plans-title">
      <header className="landing-section-heading landing-section-heading--plans">
        <h2 id="plans-title">Planos de assinatura</h2>
        <p>Um plano para cada frequência de xícara. Conheça as opções e escolha a frequência que faz sentido para você.</p>
      </header>
      {loading ? (
        <p className="landing-state" role="status">Carregando planos...</p>
      ) : error ? (
        <div className="landing-state landing-state--error" role="alert">
          <p>{error}</p>
          <a href="/clube">Ver o clube</a>
        </div>
      ) : plans.length === 0 ? (
        <p className="landing-state">Ainda não há planos disponíveis. Os cafés avulsos continuam na loja.</p>
      ) : (
        <div className={`landing-plans__grid${plans.length === 1 ? ' landing-plans__grid--single' : plans.length === 2 ? ' landing-plans__grid--pair' : ''}`}>
          {plans.slice(0, 3).map((plan, index) => (
            <PlanCard key={plan.id} plan={plan} featured={index === featuredIndex && plans.length > 1} />
          ))}
        </div>
      )}
      <p className="landing-plans__note">As assinaturas são para quem quer descobrir cafés com uma frequência definida.</p>
    </section>
  )
}

function Footer() {
  return (
    <footer className="landing-footer">
      <img
        className="landing-footer__landscape"
        src="/images/paisagem-transicao.png"
        alt=""
        width="1440"
        height="601"
        loading="lazy"
        decoding="async"
      />
      <div className="landing-footer__body">
        <div className="landing-footer__content">
          <p className="landing-footer__about">
            A Origin &amp; Beans aproxima você de cafés especiais, com informações sobre sua origem e perfil sensorial.
          </p>
          <nav aria-label="Links do rodapé">
            <a href="/loja">Explorar cafés</a>
            <a href="/quiz">Taste Finder</a>
            <a href="/clube">Assinaturas</a>
            <a href="/login">Minha conta</a>
          </nav>
        </div>
        <p className="landing-footer__copyright">© {new Date().getFullYear()} Origin &amp; Beans. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}

export default function Landpage() {
  const { data: products, loading: productsLoading, error: productsError } = usePublicData(
    '/vitrine/produtos',
    'Não foi possível carregar os cafés.',
  )
  const { data: plans, loading: plansLoading, error: plansError } = usePublicData(
    '/vitrine/planos',
    'Não foi possível carregar os planos.',
  )
  const [cartFeedback, setCartFeedback] = useState('')

  function addProduct(product) {
    const result = addCartItem(product)
    setCartFeedback(result || `${product.name} adicionado ao carrinho.`)
  }

  return (
    <div className="landing-page">
      <Navbar activePage="home" visibleLinks={['home', 'account','store']}/>
      <main>
        <Hero />
        <Categories />
        <Featured
          products={products}
          loading={productsLoading}
          error={productsError}
          onAdd={addProduct}
        />
        {cartFeedback && <p className="landing-cart-feedback" role="status">{cartFeedback}</p>}
        <TasteFinder />
        <Plans plans={plans} loading={plansLoading} error={plansError} />
      </main>
      <Footer />
    </div>
  )
}
