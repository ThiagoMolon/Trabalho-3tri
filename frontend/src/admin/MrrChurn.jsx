import { MetricCards, LineChart, PageHeading, ExportButton, currencyFormatter } from './shared'
import { mrrHistory, dashboardMetrics } from './mockData'

function MrrChurn() {
  return (
    <>
      <PageHeading
        eyebrow="RELATÓRIO FINANCEIRO"
        title="MRR e Churn"
        description="Acompanhe a receita recorrente e a taxa de cancelamento das assinaturas."
        actions={(
          <>
            <label className="filter-select">
              <span className="visually-hidden">Período</span>
              <select defaultValue="12">
                <option value="12">Últimos 12 meses</option>
                <option value="6">Últimos 6 meses</option>
                <option value="3">Últimos 3 meses</option>
              </select>
            </label>
            <ExportButton onClick={() => window.alert('Exportação de MRR/Churn em breve.')} />
          </>
        )}
      />

      <MetricCards
        items={[
          { label: 'MRR', value: currencyFormatter.format(dashboardMetrics.mrr), hint: `+${dashboardMetrics.mrrDelta}% vs. mês anterior`, hintTone: 'metric-hint-up' },
          { label: 'Churn', value: `${dashboardMetrics.churn.toFixed(1).replace('.', ',')}%`, hint: 'Taxa no mês atual' },
          { label: 'Novas assinaturas', value: String(mrrHistory.newSubs), hint: 'No mês' },
          { label: 'Cancelamentos', value: String(mrrHistory.cancellations), hint: 'No mês' },
        ]}
      />

      <div className="charts-grid">
        <LineChart
          title="Receita recorrente mensal"
          labels={mrrHistory.labels}
          values={mrrHistory.revenue}
          valueFormatter={(value) => currencyFormatter.format(value).replace(/\s/g, '\u00a0')}
        />
        <LineChart
          title="Taxa de cancelamento"
          labels={mrrHistory.labels}
          values={mrrHistory.churnRate}
          valueFormatter={(value) => `${value.toFixed(1).replace('.', ',')}%`}
          color="#9b7041"
        />
      </div>
    </>
  )
}

export default MrrChurn
