export const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatDate(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

export function MetricCards({ items }) {
  return (
    <div className="metric-grid" role="list">
      {items.map((item) => (
        <article className="metric-card" key={item.label} role="listitem">
          <p className="metric-label">{item.label}</p>
          <p className="metric-value">{item.value}</p>
          {item.hint && <p className={`metric-hint ${item.hintTone || ''}`}>{item.hint}</p>}
        </article>
      ))}
    </div>
  )
}

export function LineChart({ title, labels, values, valueFormatter = (value) => value, color = '#486b53' }) {
  const width = 640
  const height = 220
  const padding = { top: 18, right: 16, bottom: 34, left: 44 }
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(max - min, 1)
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const points = values.map((value, index) => {
    const x = padding.left + (index / Math.max(values.length - 1, 1)) * plotWidth
    const y = padding.top + ((max - value) / span) * plotHeight
    return `${x},${y}`
  }).join(' ')

  const gridYs = [0, 0.5, 1].map((ratio) => padding.top + ratio * plotHeight)

  return (
    <section className="chart-panel" aria-label={title}>
      <h3>{title}</h3>
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: ${values.map(valueFormatter).join(', ')}`}>
        {gridYs.map((y) => (
          <line key={y} x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="chart-grid" />
        ))}
        <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} />
        {values.map((value, index) => {
          const x = padding.left + (index / Math.max(values.length - 1, 1)) * plotWidth
          const y = padding.top + ((max - value) / span) * plotHeight
          return <circle key={`${labels[index]}-${value}`} cx={x} cy={y} r="3.5" fill={color} />
        })}
        {labels.map((label, index) => {
          const x = padding.left + (index / Math.max(labels.length - 1, 1)) * plotWidth
          return (
            <text key={label} x={x} y={height - 10} textAnchor="middle" className="chart-label">
              {label}
            </text>
          )
        })}
        <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" className="chart-label">
          {valueFormatter(max)}
        </text>
        <text x={padding.left - 8} y={height - padding.bottom} textAnchor="end" className="chart-label">
          {valueFormatter(min)}
        </text>
      </svg>
    </section>
  )
}

export function PageHeading({ eyebrow, title, description, actions }) {
  return (
    <div className="page-heading catalog-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function ExportButton({ onClick }) {
  return (
    <button className="ghost-button" type="button" onClick={onClick}>
      Exportar
    </button>
  )
}

export function StatusBadge({ tone, children }) {
  return <span className={`status-label status-tone-${tone}`}>{children}</span>
}
