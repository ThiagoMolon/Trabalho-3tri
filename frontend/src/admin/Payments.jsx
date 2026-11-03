import { useMemo, useState } from 'react'
import { MetricCards, PageHeading, ExportButton, StatusBadge, formatDate, currencyFormatter } from './shared'
import { payments } from './mockData'

const tabs = [
  { id: 'todos', label: 'Todos' },
  { id: 'aprovado', label: 'Aprovados' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'recusado', label: 'Recusados' },
]

const statusLabels = {
  aprovado: 'Aprovado',
  pendente: 'Pendente',
  recusado: 'Recusado',
}

const methodLabels = {
  cartão: 'Cartão',
  pix: 'Pix',
}

function Payments() {
  const [tab, setTab] = useState('todos')

  const received = payments.filter((item) => item.status === 'aprovado').reduce((sum, item) => sum + item.amount, 0)
  const pending = payments.filter((item) => item.status === 'pendente').length
  const refused = payments.filter((item) => item.status === 'recusado').length

  const rows = useMemo(
    () => (tab === 'todos' ? payments : payments.filter((item) => item.status === tab)),
    [tab],
  )

  return (
    <>
      <PageHeading
        eyebrow="FINANCEIRO"
        title="Pagamentos"
        description="Recebimentos, pendências e recusas do mês."
        actions={<ExportButton onClick={() => window.alert('Exportação de pagamentos em breve.')} />}
      />

      <MetricCards
        items={[
          { label: 'Recebidos no mês', value: currencyFormatter.format(received) },
          { label: 'Pendentes', value: String(pending) },
          { label: 'Recusados', value: String(refused) },
        ]}
      />

      <div className="subscription-tabs" role="tablist" aria-label="Filtrar pagamentos">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={`subscription-tab ${tab === item.id ? 'subscription-tab-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="catalog-panel" aria-label="Lista de pagamentos">
        <div className="table-scroll">
          <table className="product-table admin-wide-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Referência</th>
                <th>Cliente</th>
                <th>Método</th>
                <th>Valor</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="6"><p className="catalog-empty">Nenhum pagamento nesta situação.</p></td>
                </tr>
              ) : rows.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.date)}</td>
                  <td>{item.reference}</td>
                  <td>{item.customer}</td>
                  <td>{methodLabels[item.method]}</td>
                  <td>{currencyFormatter.format(item.amount)}</td>
                  <td>
                    <StatusBadge tone={item.status}>{statusLabels[item.status]}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default Payments
