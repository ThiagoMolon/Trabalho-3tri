import { useState } from 'react'
import { PageHeading, StatusBadge, formatDate } from './shared'
import { roastBatches as initialBatches } from './mockData'

const statusLabels = {
  disponivel: 'Disponível',
  baixo: 'Baixo',
  esgotado: 'Esgotado',
}

const emptyBatch = {
  code: '',
  coffee: '',
  roastDate: '',
  roastedKg: '',
  availableKg: '',
}

function resolveStatus(availableKg) {
  if (availableKg <= 0) return 'esgotado'
  if (availableKg < 5) return 'baixo'
  return 'disponivel'
}

function RoastBatches() {
  const [batches, setBatches] = useState(initialBatches)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyBatch)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const roastedKg = Number(form.roastedKg)
    const availableKg = Number(form.availableKg)
    setBatches((current) => [
      {
        id: Date.now(),
        code: form.code.trim(),
        coffee: form.coffee.trim(),
        roastDate: form.roastDate,
        roastedKg,
        availableKg,
        status: resolveStatus(availableKg),
      },
      ...current,
    ])
    setForm(emptyBatch)
    setCreating(false)
  }

  return (
    <>
      <PageHeading
        eyebrow="PRODUÇÃO"
        title="Lotes de torra"
        description="Controle dos lotes torrados, disponibilidade e status."
        actions={(
          <button className="submit-button" type="button" onClick={() => setCreating(true)}>
            Novo lote
          </button>
        )}
      />

      {creating && (
        <form className="inline-create-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Lote <b>*</b></span>
              <input name="code" value={form.code} onChange={updateField} required placeholder="Ex.: LT-2411-B" />
            </label>
            <label className="field">
              <span>Café <b>*</b></span>
              <input name="coffee" value={form.coffee} onChange={updateField} required placeholder="Nome do café" />
            </label>
            <label className="field">
              <span>Data da torra <b>*</b></span>
              <input name="roastDate" type="date" value={form.roastDate} onChange={updateField} required />
            </label>
            <label className="field">
              <span>Qtd. torrada (kg) <b>*</b></span>
              <input name="roastedKg" type="number" min="0" step="0.1" value={form.roastedKg} onChange={updateField} required />
            </label>
            <label className="field">
              <span>Qtd. disponível (kg) <b>*</b></span>
              <input name="availableKg" type="number" min="0" step="0.1" value={form.availableKg} onChange={updateField} required />
            </label>
          </div>
          <footer className="form-footer inline-form-footer">
            <button className="text-action cancel-edit-button" type="button" onClick={() => { setCreating(false); setForm(emptyBatch) }}>Cancelar</button>
            <button className="submit-button" type="submit">Salvar lote</button>
          </footer>
        </form>
      )}

      <section className="catalog-panel" aria-label="Lista de lotes de torra">
        <div className="table-scroll">
          <table className="product-table admin-wide-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Café</th>
                <th>Data da torra</th>
                <th>Qtd. torrada</th>
                <th>Qtd. disponível</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((item) => (
                <tr key={item.id}>
                  <td className="product-name-cell"><strong>{item.code}</strong></td>
                  <td>{item.coffee}</td>
                  <td>{formatDate(item.roastDate)}</td>
                  <td>{item.roastedKg.toFixed(1).replace('.', ',')} kg</td>
                  <td>{item.availableKg.toFixed(1).replace('.', ',')} kg</td>
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

export default RoastBatches
