import { useEffect, useState } from 'react'
import api from './services/api'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const frequencyLabels = {
  semanal: 'Semanal',
  mensal: 'Mensal',
  bimestral: 'A cada 2 meses',
}

const statusLabels = {
  ativa: 'Ativa',
  pausada: 'Pausada',
  cancelada: 'Cancelada',
}

const categoryLabels = {
  graos: 'Grãos',
  moidos: 'Moídos',
  acessorios: 'Acessórios',
  kits: 'Kits',
}

const emptyPlan = {
  name: '',
  description: '',
  price: '',
  frequency: 'mensal',
  product_ids: [],
  active: true,
}

function todayAsInputValue() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function createEmptySubscription() {
  return {
    customer_name: '',
    customer_email: '',
    plan_id: '',
    status: 'ativa',
    started_at: todayAsInputValue(),
    next_renewal: '',
  }
}

function formatDate(value) {
  if (!value) return 'Não definida'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function SubscriptionManager({ activeTab, onTabChange }) {
  const [plans, setPlans] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [formKind, setFormKind] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [deletingKey, setDeletingKey] = useState('')
  const [planForm, setPlanForm] = useState(emptyPlan)
  const [subscriptionForm, setSubscriptionForm] = useState(createEmptySubscription)

  useEffect(() => {
    let isCurrent = true
    const listRequest = activeTab === 'plans' ? api.get('/produtos') : api.get('/assinaturas')

    Promise.all([api.get('/planos'), listRequest])
      .then(([plansResponse, listResponse]) => {
        if (!isCurrent) return
        setPlans(plansResponse.data)
        if (activeTab === 'plans') setProducts(listResponse.data)
        else setSubscriptions(listResponse.data)
      })
      .catch((error) => {
        if (isCurrent) {
          setFailure(error.response?.data?.message || 'Não foi possível carregar os dados de assinatura.')
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [activeTab])

  const rows = (activeTab === 'plans' ? plans : subscriptions).filter((item) => {
    const searchable = activeTab === 'plans'
      ? `${item.name} ${item.description || ''} ${item.frequency}`
      : `${item.customer_name} ${item.customer_email} ${item.plan_name} ${item.status}`
    return searchable.toLowerCase().includes(search.trim().toLowerCase())
  })

  async function reloadData() {
    const [plansResponse, listResponse] = await Promise.all([
      api.get('/planos'),
      activeTab === 'plans' ? api.get('/produtos') : api.get('/assinaturas'),
    ])
    setPlans(plansResponse.data)
    if (activeTab === 'plans') setProducts(listResponse.data)
    else setSubscriptions(listResponse.data)
    setLoading(false)
  }

  function changeTab(tab) {
    if (tab === activeTab) return
    setLoading(true)
    setFailure('')
    setNotice('')
    setSearch('')
    onTabChange(tab)
  }

  function updatePlanField(event) {
    const { name, value, type, checked } = event.target
    setPlanForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function togglePlanProduct(productId, checked) {
    setPlanForm((current) => ({
      ...current,
      product_ids: checked
        ? [...current.product_ids, productId]
        : current.product_ids.filter((id) => id !== productId),
    }))
  }

  function startNewPlan() {
    setPlanForm(emptyPlan)
    setFormKind('plan')
    setEditingId(null)
    setFailure('')
    setNotice('')
  }

  function startEditingPlan(plan) {
    setPlanForm({
      name: plan.name,
      description: plan.description || '',
      price: String(plan.price),
      frequency: plan.frequency,
      product_ids: plan.product_ids || [],
      active: plan.active,
    })
    setFormKind('plan')
    setEditingId(plan.id)
    setFailure('')
    setNotice('')
  }

  function startNewSubscription() {
    setSubscriptionForm({ ...createEmptySubscription(), plan_id: String(plans.find((plan) => plan.active)?.id || '') })
    setFormKind('subscription')
    setEditingId(null)
    setFailure('')
    setNotice('')
  }

  function startEditingSubscription(subscription) {
    setSubscriptionForm({
      customer_name: subscription.customer_name,
      customer_email: subscription.customer_email,
      plan_id: String(subscription.plan_id),
      status: subscription.status,
      started_at: String(subscription.started_at).slice(0, 10),
      next_renewal: subscription.next_renewal ? String(subscription.next_renewal).slice(0, 10) : '',
    })
    setFormKind('subscription')
    setEditingId(subscription.id)
    setFailure('')
    setNotice('')
  }

  async function handlePlanSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setFailure('')
    try {
      const payload = { ...planForm, price: Number(planForm.price) }
      if (editingId) await api.put(`/planos/${editingId}`, payload)
      else await api.post('/planos', payload)
      await reloadData()
      setFormKind(null)
      setEditingId(null)
      setNotice(editingId ? 'Plano atualizado com sucesso.' : 'Plano criado com sucesso.')
    } catch (error) {
      setFailure(error.response?.data?.message || 'Não foi possível salvar o plano.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubscriptionSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setFailure('')
    try {
      const payload = {
        ...subscriptionForm,
        plan_id: Number(subscriptionForm.plan_id),
        next_renewal: subscriptionForm.next_renewal || null,
      }
      if (editingId) await api.put(`/assinaturas/${editingId}`, payload)
      else await api.post('/assinaturas', payload)
      await reloadData()
      setFormKind(null)
      setEditingId(null)
      setNotice(editingId ? 'Assinatura atualizada com sucesso.' : 'Assinatura criada com sucesso.')
    } catch (error) {
      setFailure(error.response?.data?.message || 'Não foi possível salvar a assinatura.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(item) {
    const isPlan = activeTab === 'plans'
    const kind = isPlan ? 'plano' : 'assinatura'
    if (!window.confirm(`Excluir ${kind} "${isPlan ? item.name : item.customer_name}"? Esta ação não pode ser desfeita.`)) return

    const key = `${kind}-${item.id}`
    setDeletingKey(key)
    setFailure('')
    setNotice('')
    try {
      await api.delete(`/${isPlan ? 'planos' : 'assinaturas'}/${item.id}`)
      await reloadData()
      setNotice(`${isPlan ? 'Plano' : 'Assinatura'} excluído com sucesso.`)
    } catch (error) {
      setFailure(error.response?.data?.message || `Não foi possível excluir ${kind}.`)
    } finally {
      setDeletingKey('')
    }
  }

  function cancelForm() {
    setFormKind(null)
    setEditingId(null)
    setFailure('')
  }

  const title = formKind
    ? `${formKind === 'plan' ? (editingId ? 'Editar plano' : 'Novo plano') : (editingId ? 'Editar assinatura' : 'Nova assinatura')}`
    : activeTab === 'plans' ? 'Planos' : 'Assinaturas'

  return (
    <>
      <div className="page-heading subscription-heading">
        <div>
          <p className="eyebrow">GESTÃO RECORRENTE</p>
          <h1>{title}</h1>
          <p className="page-description">
            {formKind === 'plan'
              ? 'Defina preço, frequência e produtos incluídos.'
              : formKind === 'subscription'
                ? 'Mantenha os dados e o ciclo da assinatura do cliente.'
                : activeTab === 'plans'
                  ? 'Organize as ofertas de assinatura da loja.'
                  : 'Acompanhe clientes, planos e próximas renovações.'}
          </p>
        </div>
        {!formKind && (
          <button
            className="submit-button subscription-new-button"
            type="button"
            onClick={activeTab === 'plans' ? startNewPlan : startNewSubscription}
            disabled={activeTab === 'subscriptions' && !plans.some((plan) => plan.active)}
          >
            {activeTab === 'plans' ? 'Novo plano' : 'Nova assinatura'}
          </button>
        )}
      </div>

      <div className="subscription-tabs" role="tablist" aria-label="Gestão de assinaturas">
        <button className={`subscription-tab ${activeTab === 'subscriptions' ? 'subscription-tab-active' : ''}`} type="button" role="tab" aria-selected={activeTab === 'subscriptions'} onClick={() => changeTab('subscriptions')}>Assinaturas</button>
        <button className={`subscription-tab ${activeTab === 'plans' ? 'subscription-tab-active' : ''}`} type="button" role="tab" aria-selected={activeTab === 'plans'} onClick={() => changeTab('plans')}>Planos</button>
      </div>

      {failure && formKind && <p className="catalog-feedback feedback-error" role="alert">{failure}</p>}

      {formKind === 'plan' ? (
        <form className="subscription-form" onSubmit={handlePlanSubmit}>
          <section className="form-section subscription-form-section">
            <div className="section-heading">
              <span className="section-number">01</span>
              <div><h2>Detalhes do plano</h2><p>Nome, frequência e valor recorrente</p></div>
            </div>
            <div className="form-grid">
              <label className="field field-wide">
                <span>Nome do plano <b>*</b></span>
                <input name="name" value={planForm.name} onChange={updatePlanField} maxLength="150" required placeholder="Ex.: Clube Origem" />
              </label>
              <label className="field">
                <span>Preço por ciclo (R$) <b>*</b></span>
                <input name="price" type="number" value={planForm.price} onChange={updatePlanField} min="0" step="0.01" required placeholder="0,00" />
              </label>
              <label className="field">
                <span>Frequência <b>*</b></span>
                <select name="frequency" value={planForm.frequency} onChange={updatePlanField} required>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="bimestral">A cada 2 meses</option>
                </select>
              </label>
              <label className="field field-wide">
                <span>Descrição</span>
                <textarea name="description" value={planForm.description} onChange={updatePlanField} rows="3" placeholder="Descreva o que está incluído neste plano" />
              </label>
              <label className="active-toggle">
                <input name="active" type="checkbox" checked={planForm.active} onChange={updatePlanField} />
                <span className="toggle-copy"><strong>Plano ativo</strong><small>Disponível para novas assinaturas</small></span>
              </label>
            </div>
          </section>

          <section className="form-section subscription-form-section subscription-form-last">
            <div className="section-heading">
              <span className="section-number">02</span>
              <div><h2>Produtos incluídos</h2><p>Selecione os itens enviados neste plano</p></div>
            </div>
            <div className="plan-product-list">
              {products.length === 0 ? <p className="catalog-empty">Cadastre produtos antes de associá-los a um plano.</p> : products.map((product) => (
                <label className="plan-product-choice" key={product.id}>
                  <input
                    type="checkbox"
                    checked={planForm.product_ids.includes(product.id)}
                    onChange={(event) => togglePlanProduct(product.id, event.target.checked)}
                  />
                  <span><strong>{product.name}</strong><small>{product.active ? 'Ativo' : 'Inativo'} · {categoryLabels[product.category] || product.category}</small></span>
                </label>
              ))}
            </div>
          </section>

          <footer className="form-footer">
            <button className="text-action cancel-edit-button" type="button" onClick={cancelForm}>Cancelar</button>
            <button className="submit-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar plano'}</button>
          </footer>
        </form>
      ) : formKind === 'subscription' ? (
        <form className="subscription-form" onSubmit={handleSubscriptionSubmit}>
          <section className="form-section subscription-form-section">
            <div className="section-heading">
              <span className="section-number">01</span>
              <div><h2>Dados do cliente</h2><p>Identificação vinculada à assinatura</p></div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Nome do cliente <b>*</b></span>
                <input name="customer_name" value={subscriptionForm.customer_name} onChange={(event) => setSubscriptionForm((current) => ({ ...current, customer_name: event.target.value }))} maxLength="200" required />
              </label>
              <label className="field">
                <span>E-mail <b>*</b></span>
                <input name="customer_email" type="email" value={subscriptionForm.customer_email} onChange={(event) => setSubscriptionForm((current) => ({ ...current, customer_email: event.target.value }))} maxLength="254" required />
              </label>
            </div>
          </section>

          <section className="form-section subscription-form-section subscription-form-last">
            <div className="section-heading">
              <span className="section-number">02</span>
              <div><h2>Plano e ciclo</h2><p>Status e datas da assinatura</p></div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Plano <b>*</b></span>
                <select name="plan_id" value={subscriptionForm.plan_id} onChange={(event) => setSubscriptionForm((current) => ({ ...current, plan_id: event.target.value }))} required>
                  <option value="" disabled>Selecione um plano</option>
                  {plans.filter((plan) => plan.active || String(plan.id) === subscriptionForm.plan_id).map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name} · {currencyFormatter.format(Number(plan.price))} / {frequencyLabels[plan.frequency].toLowerCase()}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status <b>*</b></span>
                <select name="status" value={subscriptionForm.status} onChange={(event) => setSubscriptionForm((current) => ({ ...current, status: event.target.value }))} required>
                  <option value="ativa">Ativa</option>
                  <option value="pausada">Pausada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </label>
              <label className="field">
                <span>Início <b>*</b></span>
                <input name="started_at" type="date" value={subscriptionForm.started_at} onChange={(event) => setSubscriptionForm((current) => ({ ...current, started_at: event.target.value }))} required />
              </label>
              <label className="field">
                <span>Próxima renovação</span>
                <input name="next_renewal" type="date" value={subscriptionForm.next_renewal} onChange={(event) => setSubscriptionForm((current) => ({ ...current, next_renewal: event.target.value }))} />
              </label>
            </div>
          </section>

          <footer className="form-footer">
            <button className="text-action cancel-edit-button" type="button" onClick={cancelForm}>Cancelar</button>
            <button className="submit-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar assinatura'}</button>
          </footer>
        </form>
      ) : (
        <section className="catalog-panel" aria-label={activeTab === 'plans' ? 'Lista de planos' : 'Lista de assinaturas'}>
          <div className="catalog-toolbar">
            <label className="search-field">
              <span className="visually-hidden">Buscar {activeTab === 'plans' ? 'plano' : 'assinatura'}</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={activeTab === 'plans' ? 'Buscar plano' : 'Buscar cliente, e-mail ou plano'} />
            </label>
            <span className="product-count">{rows.length} {rows.length === 1 ? (activeTab === 'plans' ? 'plano' : 'assinatura') : (activeTab === 'plans' ? 'planos' : 'assinaturas')}</span>
          </div>
          {failure && <p className="catalog-feedback feedback-error" role="alert">{failure}</p>}
          {notice && <p className="catalog-feedback feedback-success" role="status">{notice}</p>}
          {activeTab === 'subscriptions' && plans.length === 0 && !loading && (
            <div className="catalog-empty subscription-empty-plans">
              <p>Crie um plano antes de cadastrar assinaturas.</p>
              <button className="text-action" type="button" onClick={() => onTabChange('plans')}>Ir para planos</button>
            </div>
          )}
          {loading ? <p className="catalog-empty">Carregando...</p> : rows.length === 0 ? (
            <p className="catalog-empty">{search ? 'Nenhum resultado para esta busca.' : activeTab === 'plans' ? 'Nenhum plano cadastrado ainda.' : 'Nenhuma assinatura cadastrada ainda.'}</p>
          ) : (
            <div className="table-scroll">
              {activeTab === 'plans' ? (
                <table className="product-table subscription-table">
                  <thead><tr><th>Plano</th><th>Frequência</th><th>Preço</th><th>Produtos</th><th>Status</th><th><span className="visually-hidden">Ações</span></th></tr></thead>
                  <tbody>{rows.map((plan) => (
                    <tr key={plan.id}>
                      <td className="product-name-cell"><strong>{plan.name}</strong><span>#{plan.id}</span></td>
                      <td>{frequencyLabels[plan.frequency]}</td>
                      <td>{currencyFormatter.format(Number(plan.price))}</td>
                      <td className="plan-products-cell">{(plan.products || []).map((product) => product.name).join(', ') || 'Sem produtos'}</td>
                      <td><span className={`status-label ${plan.active ? 'status-active' : 'status-inactive'}`}>{plan.active ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="row-actions">
                        <button className="text-action" type="button" onClick={() => startEditingPlan(plan)}>Editar</button>
                        <button className="text-action text-action-delete" type="button" disabled={deletingKey === `plano-${plan.id}`} onClick={() => handleDelete(plan)}>{deletingKey === `plano-${plan.id}` ? 'Excluindo...' : 'Excluir'}</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : (
                <table className="product-table subscription-table">
                  <thead><tr><th>Cliente</th><th>Plano</th><th>Início</th><th>Próxima renovação</th><th>Status</th><th><span className="visually-hidden">Ações</span></th></tr></thead>
                  <tbody>{rows.map((subscription) => (
                    <tr key={subscription.id}>
                      <td className="product-name-cell"><strong>{subscription.customer_name}</strong><span>{subscription.customer_email}</span></td>
                      <td>{subscription.plan_name} · {frequencyLabels[subscription.plan_frequency].toLowerCase()}</td>
                      <td>{formatDate(subscription.started_at)}</td>
                      <td>{formatDate(subscription.next_renewal)}</td>
                      <td><span className={`status-label subscription-status-${subscription.status}`}>{statusLabels[subscription.status]}</span></td>
                      <td className="row-actions">
                        <button className="text-action" type="button" onClick={() => startEditingSubscription(subscription)}>Editar</button>
                        <button className="text-action text-action-delete" type="button" disabled={deletingKey === `assinatura-${subscription.id}`} onClick={() => handleDelete(subscription)}>{deletingKey === `assinatura-${subscription.id}` ? 'Excluindo...' : 'Excluir'}</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}
    </>
  )
}

export default SubscriptionManager