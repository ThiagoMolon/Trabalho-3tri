import { MetricCards, PageHeading, ExportButton, StatusBadge, formatDate } from './shared'
import { subscribers } from './mockData'

const frequencyLabels = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
}

const statusLabels = {
  ativa: 'Ativa',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
}

function Subscribers() {
  const active = subscribers.filter((item) => item.status === 'ativa').length
  const paused = subscribers.filter((item) => item.status === 'pausada').length
  const canceled = subscribers.filter((item) => item.status === 'cancelada').length

  return (
    <>
      <PageHeading
        eyebrow="ASSINATURAS"
        title="Assinantes"
        description="Resumo e lista das assinaturas por plano, moagem e ciclo."
        actions={<ExportButton onClick={() => window.alert('Exportação de assinantes em breve.')} />}
      />

      <MetricCards
        items={[
          { label: 'Ativas', value: String(active) },
          { label: 'Pausadas', value: String(paused) },
          { label: 'Canceladas no mês', value: String(canceled) },
        ]}
      />

      <section className="catalog-panel" aria-label="Lista de assinantes">
        <div className="table-scroll">
          <table className="product-table admin-wide-table">
            <thead>
              <tr>
                <th>Assinante</th>
                <th>Plano</th>
                <th>Moagem</th>
                <th>Frequência</th>
                <th>Próxima renovação</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((item) => (
                <tr key={item.id}>
                  <td className="product-name-cell"><strong>{item.name}</strong></td>
                  <td>{item.plan}</td>
                  <td>{item.grind}</td>
                  <td>{frequencyLabels[item.frequency]}</td>
                  <td>{formatDate(item.nextRenewal)}</td>
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

export default Subscribers
