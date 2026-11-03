import { useState } from 'react'
import { MetricCards, PageHeading, StatusBadge } from './shared'
import { stockItems as initialStock } from './mockData'

const grindLabels = {
  'grãos inteiros': 'Grãos inteiros',
  espresso: 'Espresso',
  filtro: 'Filtro',
}

const statusLabels = {
  ok: 'Ok',
  baixo: 'Baixo',
  esgotado: 'Esgotado',
}

function resolveStatus(quantity, minimum) {
  if (quantity <= 0) return 'esgotado'
  if (quantity < minimum) return 'baixo'
  return 'ok'
}

function Stock() {
  const [items, setItems] = useState(initialStock)
  const [adjusting, setAdjusting] = useState(false)
  const [selectedId, setSelectedId] = useState(String(initialStock[0]?.id || ''))
  const [quantity, setQuantity] = useState('')

  const belowMinimum = items.filter((item) => item.status !== 'ok').length

  function handleAdjust(event) {
    event.preventDefault()
    const nextQuantity = Number(quantity)
    setItems((current) => current.map((item) => {
      if (String(item.id) !== selectedId) return item
      return {
        ...item,
        quantity: nextQuantity,
        status: resolveStatus(nextQuantity, item.minimum),
      }
    }))
    setQuantity('')
    setAdjusting(false)
  }

  return (
    <>
      <PageHeading
        eyebrow="OPERAÇÃO"
        title="Estoque"
        description="Quantidades por café, moagem e lote, com alerta de mínimo."
        actions={(
          <button className="submit-button" type="button" onClick={() => setAdjusting(true)}>
            Ajustar estoque
          </button>
        )}
      />

      <MetricCards
        items={[
          { label: 'Itens em estoque', value: String(items.length) },
          { label: 'Abaixo do mínimo', value: String(belowMinimum), hintTone: belowMinimum ? 'metric-hint-down' : undefined },
        ]}
      />

      {adjusting && (
        <form className="inline-create-form" onSubmit={handleAdjust}>
          <div className="form-grid">
            <label className="field">
              <span>Item <b>*</b></span>
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.coffee} · {grindLabels[item.grind]} · {item.batch}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Nova quantidade (kg) <b>*</b></span>
              <input type="number" min="0" step="0.1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
            </label>
          </div>
          <footer className="form-footer inline-form-footer">
            <button className="text-action cancel-edit-button" type="button" onClick={() => { setAdjusting(false); setQuantity('') }}>Cancelar</button>
            <button className="submit-button" type="submit">Salvar ajuste</button>
          </footer>
        </form>
      )}

      <section className="catalog-panel" aria-label="Lista de estoque">
        <div className="table-scroll">
          <table className="product-table admin-wide-table">
            <thead>
              <tr>
                <th>Café</th>
                <th>Moagem</th>
                <th>Lote</th>
                <th>Em estoque</th>
                <th>Mínimo</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="product-name-cell"><strong>{item.coffee}</strong></td>
                  <td>{grindLabels[item.grind]}</td>
                  <td>{item.batch}</td>
                  <td>{item.quantity.toFixed(1).replace('.', ',')} kg</td>
                  <td>{item.minimum.toFixed(1).replace('.', ',')} kg</td>
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

export default Stock
