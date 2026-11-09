import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { currencyFormatter } from './formatters'

const tabs = [
  { id: 'todos', label: 'Todos' },
  { id: 'graos', label: 'Grãos' },
  { id: 'moidos', label: 'Moídos' },
  { id: 'assinatura', label: 'Assinatura' },
  { id: 'planos', label: 'Planos' },
]

const categoryLabels = {
  graos: 'Grãos',
  moidos: 'Moídos',
  acessorios: 'Acessórios',
  kits: 'Kits',
  assinatura: 'Assinatura',
  plano: 'Plano',
}

const frequencyLabels = {
  semanal: 'Semanal',
  mensal: 'Mensal',
  bimestral: 'A cada 2 meses',
}

function productStatus(item) {
  if (item.active === false) return { label: 'Inativo', tone: 'inativo' }
  if (item.draft) return { label: 'Rascunho', tone: 'rascunho' }
  return { label: 'Ativo', tone: 'ativo' }
}

function Catalog({ onNewProduct, onEditProduct, onOpenSubscriptions }) {
  const [tab, setTab] = useState('todos')
  const [products, setProducts] = useState([])
  const [plans, setPlans] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingKey, setDeletingKey] = useState('')

  async function loadCatalog() {
    return Promise.all([
      api.get('/produtos'),
      api.get('/planos'),
      api.get('/assinaturas'),
    ])
  }

  useEffect(() => {
    let isCurrent = true
    loadCatalog()
      .then(([productsResponse, plansResponse, subscriptionsResponse]) => {
        if (!isCurrent) return
        setProducts(productsResponse.data)
        setPlans(plansResponse.data)
        setSubscriptions(subscriptionsResponse.data)
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(requestError.response?.data?.message || 'Não foi possível carregar o catálogo.')
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })
    return () => {
      isCurrent = false
    }
  }, [])

  const rows = useMemo(() => {
    const productRows = products.map((item) => {
      const status = productStatus(item)
      return {
        key: `product-${item.id}`,
        kind: 'product',
        id: item.id,
        name: item.name,
        category: item.category,
        categoryLabel: categoryLabels[item.category] || item.category,
        origin: item.origin || '—',
        score: item.score == null ? '—' : String(item.score).replace('.', ','),
        price: currencyFormatter.format(Number(item.price)),
        statusLabel: status.label,
        statusTone: status.tone,
        raw: item,
      }
    })

    const planRows = plans.map((item) => ({
      key: `plan-${item.id}`,
      kind: 'plan',
      id: item.id,
      name: item.name,
      category: 'plano',
      categoryLabel: 'Plano',
      origin: '—',
      score: '—',
      price: currencyFormatter.format(Number(item.price)),
      statusLabel: item.active ? 'Ativo' : 'Inativo',
      statusTone: item.active ? 'ativo' : 'inativo',
      raw: item,
    }))

    const subscriptionRows = subscriptions.map((item) => ({
      key: `subscription-${item.id}`,
      kind: 'subscription',
      id: item.id,
      name: item.customer_name,
      category: 'assinatura',
      categoryLabel: 'Assinatura',
      origin: '—',
      score: '—',
      price: item.plan_name
        ? `${item.plan_name} · ${frequencyLabels[item.plan_frequency] || item.plan_frequency}`
        : '—',
      statusLabel: item.status === 'ativa' ? 'Ativo' : item.status === 'pausada' ? 'Rascunho' : 'Inativo',
      statusTone: item.status === 'ativa' ? 'ativo' : item.status === 'pausada' ? 'rascunho' : 'inativo',
      raw: item,
    }))

    const all = [...productRows, ...planRows, ...subscriptionRows]
    if (tab === 'todos') return all
    if (tab === 'graos' || tab === 'moidos') return productRows.filter((row) => row.category === tab)
    if (tab === 'assinatura') return subscriptionRows
    if (tab === 'planos') return planRows
    return all
  }, [products, plans, subscriptions, tab])

  async function handleDelete(row) {
    const label = row.kind === 'product' ? 'produto' : row.kind === 'plan' ? 'plano' : 'assinatura'
    if (!window.confirm(`Excluir ${label} "${row.name}"? Esta ação não pode ser desfeita.`)) return

    setDeletingKey(row.key)
    setError('')
    setNotice('')
    try {
      const path = row.kind === 'product' ? `/produtos/${row.id}` : row.kind === 'plan' ? `/planos/${row.id}` : `/assinaturas/${row.id}`
      await api.delete(path)
      await loadCatalog()
      setNotice(`${label.charAt(0).toUpperCase()}${label.slice(1)} excluído com sucesso.`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Não foi possível excluir ${label}.`)
    } finally {
      setDeletingKey('')
    }
  }

  function handleEdit(row) {
    if (row.kind === 'product') {
      onEditProduct(row.raw)
      return
    }
    onOpenSubscriptions(row.kind === 'plan' ? 'plans' : 'subscriptions')
  }

  return (
    <>
      <div className="page-heading catalog-heading">
        <div>
          <p className="eyebrow">CATÁLOGO DA LOJA</p>
          <h1>Produtos</h1>
          <p className="page-description">Visão geral do catálogo, assinaturas e planos.</p>
        </div>
        <div className="page-actions">
          <button className="ghost-button" type="button" onClick={() => onOpenSubscriptions('plans')}>
            Nova Assinatura/Plano
          </button>
          <button className="submit-button submit-button-gold" type="button" onClick={onNewProduct}>
            Novo produto
          </button>
        </div>
      </div>

      <div className="subscription-tabs" role="tablist" aria-label="Filtrar catálogo">
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

      <section className="catalog-panel" aria-label="Lista do catálogo">
        {notice && <p className="catalog-feedback feedback-success" role="status">{notice}</p>}
        {error && <p className="catalog-feedback feedback-error" role="alert">{error}</p>}
        {loading ? (
          <p className="catalog-empty">Carregando catálogo...</p>
        ) : rows.length === 0 ? (
          <p className="catalog-empty">Nenhum item neste filtro.</p>
        ) : (
          <div className="table-scroll">
            <table className="product-table admin-wide-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Origem</th>
                  <th>Pontuação</th>
                  <th>Preço</th>
                  <th>Status</th>
                  <th><span className="visually-hidden">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="product-name-cell">
                      <strong>{row.name}</strong>
                      <span>#{row.id}</span>
                    </td>
                    <td>{row.categoryLabel}</td>
                    <td>{row.origin}</td>
                    <td>{row.score}</td>
                    <td>{row.price}</td>
                    <td>
                      <span className={`status-label status-tone-${row.statusTone}`}>{row.statusLabel}</span>
                    </td>
                    <td className="row-actions">
                      <button className="text-action" type="button" onClick={() => handleEdit(row)}>Editar</button>
                      <button
                        className="text-action text-action-delete"
                        type="button"
                        disabled={deletingKey === row.key}
                        onClick={() => handleDelete(row)}
                      >
                        {deletingKey === row.key ? 'Removendo...' : 'Remover'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export default Catalog
