import { useState } from 'react';
import './StorePage.scss';

// ===== Header =====

const LINKS = [
  { label: 'Home', href: '#' },
  { label: 'Loja', href: '/loja' },
  { label: 'Conta', href: '#' },
];

function Header({ active = 'Loja', cartCount = 0 }) {
  return (
    <header className="header">
      <a className="header__logo logo" href="/loja" aria-label="Origin & Beans - início">
        <svg className="logo__icon" viewBox="0 0 40 48" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M18 3c-4 4 3 7-1 11M24 6c-3 3 2 5-1 8" />
          <path d="M7 24h26v4c0 6-5 10-13 10S7 34 7 28z" />
          <path d="M33 26c5 0 5 7 0 7M3 42c8 4 26 4 34 0" />
        </svg>
        <span className="logo__text">Origin <em>&amp;</em> <b className="logo__highlight">Beans</b></span>
      </a>

      <nav className="header__nav nav" aria-label="Principal">
        {LINKS.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            className={`nav__link${label === active ? ' nav__link--active' : ''}`}
          >
            {label}
          </a>
        ))}
        <a className="nav__link nav__link--cart" href="#" aria-label={`Carrinho com ${cartCount} itens`}>
          <svg className="nav__cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M5 8h14l1 13H4z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </svg>
          ({cartCount})
        </a>
      </nav>
    </header>
  );
}

// ===== PageTitle =====

function PageTitle({ eyebrow = 'Loja', title = 'Todos os nossos cafés', onSearch }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch?.(new FormData(e.currentTarget).get('q'));
  };

  return (
    <section className="page-title">
      <div className="page-title__text">
        <p className="page-title__eyebrow">{eyebrow}</p>
        <h1 className="page-title__heading">{title}</h1>
      </div>

      <form className="search" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="buscar">Buscar café</label>
        <input id="buscar" name="q" className="search__input" type="search" placeholder="Buscar por nome, origem ou nota" />
        <button className="search__button" type="submit">Buscar</button>
      </form>
    </section>
  );
}

// ===== Filters =====

const CATEGORIES = ['Cafés em grãos', 'Cafés moídos', 'Métodos de preparo', 'Acessórios', 'Kits especiais'];
const ORIGINS = ['(Região 1)', '(Região 2)', '(Região 3)'];
const NOTES = ['Chocolate', 'Caramelo', 'Cítrico', 'Frutas Vermelhas', 'Floral'];

const INITIAL = { categories: [], origins: [], notes: ['Chocolate'], altitude: 700, score: 70 };

const toggle = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function CheckGroup({ legend, options, selected, onToggle }) {
  return (
    <fieldset className="filters__group">
      <legend className="filters__legend">{legend}</legend>
      {options.map((opt) => (
        <label key={opt} className="filters__option">
          <input
            className="filters__checkbox"
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => onToggle(opt)}
          />{' '}
          {opt}
        </label>
      ))}
    </fieldset>
  );
}

function Filters({ onChange }) {
  const [state, setState] = useState(INITIAL);

  const update = (patch) => {
    const next = { ...state, ...patch };
    setState(next);
    onChange?.(next);
  };

  return (
    <aside className="filters">
      <CheckGroup legend="Categoria" options={CATEGORIES} selected={state.categories}
        onToggle={(v) => update({ categories: toggle(state.categories, v) })} />
      <CheckGroup legend="Origem" options={ORIGINS} selected={state.origins}
        onToggle={(v) => update({ origins: toggle(state.origins, v) })} />

      <fieldset className="filters__group">
        <legend className="filters__legend">Notas sensoriais</legend>
        <div className="filters__chips">
          {NOTES.map((note) => (
            <button
              key={note}
              type="button"
              aria-pressed={state.notes.includes(note)}
              className={`filters__chip${state.notes.includes(note) ? ' filters__chip--active' : ''}`}
              onClick={() => update({ notes: toggle(state.notes, note) })}
            >
              {note}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filters__group">
        <legend className="filters__legend">Altitude e pontuação</legend>
        <div className="filters__range-label"><span>Altitude Mínima</span><output>{state.altitude}M</output></div>
        <input className="filters__range" type="range" min="0" max="1000" value={state.altitude}
          aria-label="Altitude mínima" onChange={(e) => update({ altitude: +e.target.value })} />
        <div className="filters__range-label"><span>Pontuação Mínima</span><output>{state.score}</output></div>
        <input className="filters__range" type="range" min="0" max="100" value={state.score}
          aria-label="Pontuação mínima" onChange={(e) => update({ score: +e.target.value })} />
      </fieldset>

      <button className="filters__reset" type="button" onClick={() => update(INITIAL)}>
        Limpar filtros
      </button>
    </aside>
  );
}

// ===== ProductCard =====

function ProductCard({ name, region, weight = '250g', notes, score, price, image, onAdd }) {
  return (
    <article className="product-card">
      <div className="product-card__image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
      <h2 className="product-card__name">{name}</h2>
      <p className="product-card__info">Região: {region} - {weight}</p>
      <p className="product-card__info">Notas: {notes}</p>
      <p className="product-card__info">Pontuação: {score}</p>
      <strong className="product-card__price">R$ {price}</strong>
      <button className="product-card__button" type="button" onClick={onAdd}>
        Adicionar ao carrinho
      </button>
    </article>
  );
}

// ===== ProductList =====

function ProductList({ products, total, onAdd }) {
  return (
    <section className="product-list" aria-label="Lista de cafés">
      <div className="product-list__toolbar">
        <p className="product-list__count">Mostrando [{products.length}] de [{total}] cafés</p>
        <label className="product-list__sort">
          Ordenar por
          <select className="product-list__select">
            <option>Mais Recente</option>
            <option>Menor preço</option>
            <option>Maior pontuação</option>
          </select>
        </label>
      </div>

      <div className="product-list__grid">
        {products.map((p) => (
          <ProductCard key={p.id} {...p} onAdd={() => onAdd?.(p)} />
        ))}
      </div>

      <nav className="pagination" aria-label="Paginação">
        {[1, 2, 3].map((n) => (
          <a key={n} href="#" className={`pagination__link${n === 1 ? ' pagination__link--current' : ''}`}>{n}</a>
        ))}
      </nav>
    </section>
  );
}

// ===== QuizBanner =====

function QuizBanner({ href = '#' }) {
  return (
    <section className="quiz-banner">
      <div className="quiz-banner__text">
        <p className="quiz-banner__eyebrow">Taste Finder</p>
        <h2 className="quiz-banner__title">Não sabe qual escolher?</h2>
        <small className="quiz-banner__description">
          Responda algumas perguntas e descubra os cafés ideais para o seu gosto.
        </small>
      </div>
      <a className="quiz-banner__cta" href={href}>Fazer o quiz</a>
    </section>
  );
}

// ===== Footer =====

function Footer() {
  return (
    <footer className="footer">
      <p className="footer__about">
        A Origem &amp; Beans foca na personalização do consumidor,<br />
        transparência e adaptabilidade em informações detalhadas<br />
        sobre os grãos.<br />
        © 2026 Origin &amp; Beans. Todos os direitos reservados.
      </p>
      <p className="footer__contact">origin&amp;beans@gmail.com<br />IFC - Videira, SC</p>
    </footer>
  );
}

// ===== StorePage =====
// Dados de exemplo — substituir pela resposta da API/Typesense
const MOCK_PRODUCTS = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `[Nome do café ${i + 1}]`,
  region: '[região]',
  notes: '[notas sensoriais]',
  score: '[xx]',
  price: '[xx,xx]',
}));

export default function StorePage() {
  const [cart, setCart] = useState([]);

  return (
    <>
      <Header cartCount={cart.length} />
      <PageTitle />
      <main className="store">
        <Filters />
        <ProductList
          products={MOCK_PRODUCTS}
          total={24}
          onAdd={(p) => setCart((c) => [...c, p])}
        />
      </main>
      <QuizBanner />
      <Footer />
    </>
  );
}