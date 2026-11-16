import './SubscriptionsPage.scss';
import Navbar from '../components/Navbar';

// Dados de exemplo — substituir pela resposta da API
const PLANS = [
  { id: 'origem', eyebrow: 'Origem', name: 'Origem', price: 59, cta: 'Assinar origem', href: '#',
    perks: ['250g de um único terroir por ciclo', 'Moagem à sua escolha', 'Entrega mensal', 'Pausa e cancelamento livres'] },
  { id: 'autoral', eyebrow: 'Mais escolhido', name: 'Autoral', price: 99, cta: 'Assinar Autoral', href: '#', featured: true,
    perks: ['2 sacas de 250g rotativas por perfil', 'Curadoria via Taste Finder', 'Entrega quinzenal ou mensal', 'Acesso a lotes limitados'] },
  { id: 'reserva', eyebrow: 'Reserva', name: 'Reserva', price: 179, cta: 'Assinar Reserva', href: '#',
    perks: ['Microlotes premiados e edições exclusivas', 'Entrega semanal ou quinzenal', 'Degustações e lançamentos antecipados', 'Atendimento prioritário'] },
];

const STEPS = [
  { title: 'Descubra seu perfil', text: 'Responda ao Taste Finder sobre acidez, amargor, doçura e preparo.' },
  { title: 'Escolha o plano', text: 'Veja o plano e os cafés recomendados para o seu paladar.' },
  { title: 'Defina moagem e frequência', text: 'Grãos inteiros, prensa francesa, filtro ou espresso.' },
  { title: 'Receba e ajuste', text: 'Pause, reative, troque a moagem ou cancele no painel do assinante.' },
];

function PlansHero() {
  return (
    <section className="plans-hero">
      <p className="plans-hero__eyebrow">Assinaturas</p>
      <h1 className="plans-hero__title">Um plano para cada frequência de xícara</h1>
      <p className="plans-hero__text">
        Cafés de origem torrados sob medida e entregues na sua porta, com a moagem que você escolher. Pause ou cancele quando quiser.
      </p>
      <a href="/quiz" className="plans-hero__cta">Fazer o Taste Finder</a>
    </section>
  );
}

function SubscriptionPlan({ eyebrow, name, price, perks, cta, href, featured }) {
  return (
    <article className={`subscription-plan${featured ? ' subscription-plan--featured' : ''}`}>
      <p className="subscription-plan__eyebrow">{eyebrow}</p>
      <h2 className="subscription-plan__name">{name}</h2>
      <p className="subscription-plan__price">R${price}<span className="subscription-plan__period">/mês</span></p>
      <ul className="subscription-plan__perks">
        {perks.map((perk) => <li key={perk} className="subscription-plan__perk">{perk}</li>)}
      </ul>
      <a href={href} className="subscription-plan__cta">{cta}</a>
    </article>
  );
}

function Steps() {
  return (
    <section className="steps">
      <p className="steps__eyebrow">Como funciona</p>
      <h2 className="steps__title">Do quiz à sua xícara em quatro passos</h2>
      <ol className="steps__list">
        {STEPS.map(({ title, text }, i) => (
          <li key={title} className="steps__item">
            <span className="steps__number">{i + 1}</span>
            <h3 className="steps__item-title">{title}</h3>
            <p className="steps__item-text">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ManageCta() {
  return (
    <section className="manage-cta">
      <div className="manage-cta__content">
        <p className="manage-cta__eyebrow">Já é assinante?</p>
        <h2 className="manage-cta__title">Gerencie sua assinatura</h2>
        <p className="manage-cta__text">Pausar, reativar, alterar moagem e frequência, ver histórico de entregas.</p>
      </div>
      <a href="/conta/assinatura" className="manage-cta__button">Acessar meu painel</a>
    </section>
  );
}

function BottomBar() {
  return (
    <footer className="bottom-bar">
      <p>© 2026 Origin &amp; Beans. Todos os direitos reservados.</p>
      <p className="bottom-bar__secure">
        <svg className="bottom-bar__secure-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Pagamento Processado em ambiente seguro
      </p>
      <p>Contato@originbeans.com IFC - Videira, SC</p>
    </footer>
  );
}

export default function SubscriptionsPage() {
  return (
    <div className="subscriptions-page">
      <Navbar activePage="plans" />
      <main className="subscriptions-page__main">
        <PlansHero />
        <section className="subscriptions-page__plans" aria-label="Planos de assinatura">
          {PLANS.map((plan) => <SubscriptionPlan key={plan.id} {...plan} />)}
        </section>
        <Steps />
        <ManageCta />
      </main>
      <BottomBar />
    </div>
  );
}