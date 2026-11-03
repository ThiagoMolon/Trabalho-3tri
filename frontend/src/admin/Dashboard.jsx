import { useState } from 'react'
import { MetricCards, currencyFormatter } from './shared'
import { dashboardMetrics } from './mockData'

function Dashboard() {
  const [search, setSearch] = useState('')
  const grindTotal = dashboardMetrics.grindToday.reduce((sum, item) => sum + item.kg, 0)

  return (
    <>
      <div className="dashboard-topbar">
        <label className="search-field dashboard-search">
          <span className="visually-hidden">Buscar no painel</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar assinantes, pedidos, lotes..."
          />
        </label>
        <button className="notification-button" type="button" aria-label="Notificações">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 22a2.2 2.2 0 0 0 2.2-2.2h-4.4A2.2 2.2 0 0 0 12 22Zm7-5.5V11a7 7 0 1 0-14 0v5.5L3 18v1h18v-1l-2-1.5Z" />
          </svg>
          <span className="notification-dot" />
        </button>
      </div>

      <div className="page-heading">
        <div>
          <p className="eyebrow">VISÃO GERAL</p>
          <h1>Dashboard</h1>
          <p className="page-description">Indicadores da assinatura e da operação do dia.</p>
        </div>
      </div>

      <MetricCards
        items={[
          {
            label: 'MRR',
            value: currencyFormatter.format(dashboardMetrics.mrr),
            hint: `+${dashboardMetrics.mrrDelta}% vs. mês anterior`,
            hintTone: 'metric-hint-up',
          },
          {
            label: 'Churn',
            value: `${dashboardMetrics.churn.toFixed(1).replace('.', ',')}%`,
            hint: `${dashboardMetrics.churnCount} cancelamentos no mês`,
          },
          {
            label: 'Assinantes ativos',
            value: String(dashboardMetrics.activeSubscribers),
            hint: `${dashboardMetrics.pausedSubscribers} pausadas`,
          },
          {
            label: 'Moagem de hoje',
            value: `${grindTotal.toFixed(1).replace('.', ',')} kg`,
            hint: dashboardMetrics.grindToday.map((item) => `${item.type}: ${item.kg} kg`).join(' · '),
          },
        ]}
      />

      <section className="free-content-panel" aria-label="Área de conteúdo">
        <div className="free-content-heading">
          <h2>Conteúdo livre</h2>
          <p>Espaço para anotações, destaques da semana ou próximos envios.</p>
        </div>
        {search.trim() ? (
          <p className="catalog-empty">Busca por “{search.trim()}” — conecte a busca aos módulos quando as APIs estiverem prontas.</p>
        ) : (
          <div className="grind-breakdown">
            {dashboardMetrics.grindToday.map((item) => (
              <div className="grind-row" key={item.type}>
                <span>{item.type}</span>
                <strong>{item.kg.toFixed(1).replace('.', ',')} kg</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export default Dashboard
