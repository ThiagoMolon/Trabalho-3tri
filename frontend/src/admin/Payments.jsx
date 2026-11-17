import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { MetricCards, PageHeading, ExportButton, StatusBadge } from './shared'
import { formatDate, currencyFormatter } from './formatters'

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
  demonstrativo: 'Demonstrativo',
  mercado_pago: 'Mercado Pago',
  recorrente: 'Recorrente',
}

function Payments() {
  const [tab, setTab] = useState('todos')
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/orders/admin/payments')
      .then(({ data }) => {
        if (active) setPayments(data.map((item) => ({
          id: `${item.kind}-${item.id}`,
          date: item.date,
          reference: item.kind === 'subscription' ? `Assinatura #${item.id}` : `Pedido #${item.id}`,
          customer: item.customer,
          method: item.method,
          amount: Number(item.amount),
          status: item.status,
        })))
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Não foi possível carregar os pagamentos.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const received = payments.filter((item) => item.status === 'aprovado').reduce((sum, item) => sum + item.amount, 0)
  const pending = payments.filter((item) => item.status === 'pendente').length
  const refused = payments.filter((item) => item.status === 'recusado').length

  const rows = useMemo(
    () => (tab === 'todos' ? payments : payments.filter((item) => item.status === tab)),
    [tab, payments],
  )

  function exportCsv() {
    const header = ['Data', 'Referência', 'Cliente', 'Método', 'Valor', 'Situação']
    const lines = rows.map((item) => [
      formatDate(item.date),
      item.reference,
      item.customer,
      methodLabels[item.method] || item.method,
      Number(item.amount).toFixed(2).replace('.', ','),
      statusLabels[item.status],
    ])
    const csv = [header, ...lines]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'))
      .join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'pagamentos.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeading
        eyebrow="FINANCEIRO"
        title="Pagamentos"
        description="Recebimentos, pendências e recusas do mês."
        actions={<ExportButton onClick={exportCsv} />}
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
              {loading ? (
                <tr><td colSpan="6"><p className="catalog-empty">Carregando pagamentos...</p></td></tr>
              ) : error ? (
                <tr><td colSpan="6"><p className="catalog-empty">{error}</p></td></tr>
              ) : rows.length === 0 ? (
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
