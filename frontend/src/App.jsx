import { useEffect, useState } from 'react'
import api from './services/api'
import SubscriptionManager from './SubscriptionManager'
import './App.scss'

const initialProduct = {
  name: '',
  category: 'graos',
  description: '',
  price: '',
  weight_grams: '',
  image_url: '',
  origin: '',
  producer: '',
  altitude: '',
  variety: '',
  score: '',
  sensory_notes: '',
  stock: '0',
  active: true,
}

const categoryLabels = {
  graos: 'Grãos',
  moidos: 'Moídos',
  acessorios: 'Acessórios',
  kits: 'Kits',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function App() {
  const [product, setProduct] = useState(initialProduct)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [view, setView] = useState('create')
  const [subscriptionTab, setSubscriptionTab] = useState('subscriptions')
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [productsFeedback, setProductsFeedback] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const isCoffee = product.category === 'graos' || product.category === 'moidos'
  const filteredProducts = products.filter((item) =>
    `${item.name} ${categoryLabels[item.category] || item.category}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )

  useEffect(() => {
    if (view !== 'list') return undefined

    let isCurrent = true

    api.get('/produtos')
      .then(({ data }) => {
        if (isCurrent) setProducts(data)
      })
      .catch((error) => {
        if (isCurrent) {
          setProductsError(error.response?.data?.message || 'Não foi possível carregar os produtos.')
        }
      })
      .finally(() => {
        if (isCurrent) setLoadingProducts(false)
      })

    return () => {
      isCurrent = false
    }
  }, [view])

  function updateField(event) {
    const { name, value, type, checked } = event.target
    setProduct((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)

    const payload = {
      ...product,
      price: Number(product.price),
      weight_grams: product.weight_grams ? Number(product.weight_grams) : null,
      altitude: isCoffee && product.altitude ? Number(product.altitude) : null,
      score: isCoffee && product.score ? Number(product.score) : null,
      sensory_notes: isCoffee
        ? product.sensory_notes.split(',').map((note) => note.trim()).filter(Boolean)
        : [],
      origin: isCoffee ? product.origin || null : null,
      producer: isCoffee ? product.producer || null : null,
      variety: isCoffee ? product.variety || null : null,
      stock: Number(product.stock),
    }

    try {
      if (editingId) {
        await api.put(`/produtos/${editingId}`, payload)
        setEditingId(null)
        setProduct(initialProduct)
        openProducts()
        setProductsFeedback('Produto atualizado com sucesso.')
        return
      }

      await api.post('/produtos', payload)
      setProduct(initialProduct)
      setFeedback({ type: 'success', message: 'Produto cadastrado com sucesso.' })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Não foi possível cadastrar o produto.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  function startEditing(item) {
    setEditingId(item.id)
    setProduct({
      name: item.name,
      category: item.category,
      description: item.description || '',
      price: String(item.price),
      weight_grams: item.weight_grams == null ? '' : String(item.weight_grams),
      image_url: item.image_url || '',
      origin: item.origin || '',
      producer: item.producer || '',
      altitude: item.altitude == null ? '' : String(item.altitude),
      variety: item.variety || '',
      score: item.score == null ? '' : String(item.score),
      sensory_notes: (item.sensory_notes || []).join(', '),
      stock: String(item.stock),
      active: item.active,
    })
    setFeedback(null)
    setView('create')
  }

  function startNewProduct() {
    setEditingId(null)
    setProduct(initialProduct)
    setFeedback(null)
    setView('create')
  }

  function openProducts() {
    if (view === 'list') return
    setLoadingProducts(true)
    setProductsError('')
    setProductsFeedback('')
    setView('list')
  }

  async function handleDelete(item) {
    if (!window.confirm(`Excluir o produto "${item.name}"? Esta ação não pode ser desfeita.`)) return

    setDeletingId(item.id)
    setProductsError('')
    setProductsFeedback('')
    try {
      await api.delete(`/produtos/${item.id}`)
      setProducts((current) => current.filter((productItem) => productItem.id !== item.id))
      setProductsFeedback('Produto excluído com sucesso.')
    } catch (error) {
      setProductsError(error.response?.data?.message || 'Não foi possível excluir o produto.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Origin Beans, início">
          <span className="brand-mark">OB</span>
          <span>origin<span className="brand-light">beans</span></span>
        </a>
        <div className="sidebar-label">CATÁLOGO</div>
        <button className={`nav-item ${view === 'create' ? 'nav-item-active' : ''}`} type="button" onClick={startNewProduct} aria-current={view === 'create' ? 'page' : undefined}>
          <span className="nav-indicator" /> Novo produto
        </button>
        <button className={`nav-item ${view === 'list' ? 'nav-item-active' : ''}`} type="button" onClick={openProducts} aria-current={view === 'list' ? 'page' : undefined}>
          <span className="nav-indicator" /> Produtos
        </button>
        <div className="sidebar-label sidebar-section-label">ASSINATURAS</div>
        <button className={`nav-item ${view === 'subscriptions' && subscriptionTab === 'subscriptions' ? 'nav-item-active' : ''}`} type="button" onClick={() => { setSubscriptionTab('subscriptions'); setView('subscriptions') }} aria-current={view === 'subscriptions' && subscriptionTab === 'subscriptions' ? 'page' : undefined}>
          <span className="nav-indicator" /> Clientes
        </button>
        <button className={`nav-item ${view === 'subscriptions' && subscriptionTab === 'plans' ? 'nav-item-active' : ''}`} type="button" onClick={() => { setSubscriptionTab('plans'); setView('subscriptions') }} aria-current={view === 'subscriptions' && subscriptionTab === 'plans' ? 'page' : undefined}>
          <span className="nav-indicator" /> Planos
        </button>
        <div className="sidebar-footer">
          <span className="status-dot" /> Painel administrativo
        </div>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <span>Loja / {view === 'subscriptions' ? 'Assinaturas' : view === 'list' ? 'Produtos' : editingId ? 'Editar produto' : 'Novo produto'}</span>
          <span className="topbar-account">Administração</span>
        </header>

        <div className="page-content">
          {view === 'subscriptions' ? (
            <SubscriptionManager activeTab={subscriptionTab} onTabChange={setSubscriptionTab} />
          ) : view === 'list' ? (
            <>
              <div className="page-heading catalog-heading">
                <div>
                  <p className="eyebrow">CATÁLOGO DA LOJA</p>
                  <h1>Produtos</h1>
                  <p className="page-description">Consulte e atualize os itens cadastrados.</p>
                </div>
                <button className="submit-button new-product-button" type="button" onClick={startNewProduct}>Novo produto</button>
              </div>

              <section className="catalog-panel" aria-label="Lista de produtos">
                <div className="catalog-toolbar">
                  <label className="search-field">
                    <span className="visually-hidden">Buscar produto</span>
                    <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou categoria" />
                  </label>
                  <span className="product-count">{products.length} {products.length === 1 ? 'produto' : 'produtos'}</span>
                </div>

                {productsFeedback && <p className="catalog-feedback feedback-success" role="status">{productsFeedback}</p>}
                {productsError && <p className="catalog-feedback feedback-error" role="alert">{productsError}</p>}
                {loadingProducts ? (
                  <p className="catalog-empty">Carregando produtos...</p>
                ) : filteredProducts.length === 0 ? (
                  <p className="catalog-empty">{search ? 'Nenhum produto corresponde à busca.' : 'Nenhum produto cadastrado ainda.'}</p>
                ) : (
                  <div className="table-scroll">
                    <table className="product-table">
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Categoria</th>
                          <th>Preço</th>
                          <th>Estoque</th>
                          <th>Status</th>
                          <th><span className="visually-hidden">Ações</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((item) => (
                          <tr key={item.id}>
                            <td className="product-name-cell">
                              <strong>{item.name}</strong>
                              <span>#{item.id}</span>
                            </td>
                            <td>{categoryLabels[item.category] || item.category}</td>
                            <td>{currencyFormatter.format(Number(item.price))}</td>
                            <td>{item.stock}</td>
                            <td><span className={`status-label ${item.active ? 'status-active' : 'status-inactive'}`}>{item.active ? 'Ativo' : 'Inativo'}</span></td>
                            <td className="row-actions">
                              <button className="text-action" type="button" onClick={() => startEditing(item)}>Editar</button>
                              <button className="text-action text-action-delete" type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.id}>
                                {deletingId === item.id ? 'Excluindo...' : 'Excluir'}
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
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">CATÁLOGO DA LOJA</p>
                  <h1>{editingId ? 'Editar produto' : 'Novo produto'}</h1>
                  <p className="page-description">{editingId ? 'Atualize os dados deste item do catálogo.' : 'Preencha os dados para adicionar um item ao catálogo.'}</p>
                </div>
                <span className="required-note"><span>*</span> Campos obrigatórios</span>
              </div>

              <form className="product-form" onSubmit={handleSubmit}>
            <section className="form-section">
              <div className="section-heading">
                <span className="section-number">01</span>
                <div>
                  <h2>Informações do produto</h2>
                  <p>Identificação e apresentação do item</p>
                </div>
              </div>
              <div className="form-grid">
                <label className="field field-wide">
                  <span>Nome do produto <b>*</b></span>
                  <input name="name" value={product.name} onChange={updateField} maxLength="200" required placeholder="Ex.: Café Serra do Caparaó" />
                </label>
                <label className="field">
                  <span>Categoria <b>*</b></span>
                  <select name="category" value={product.category} onChange={updateField} required>
                    <option value="graos">Grãos</option>
                    <option value="moidos">Moídos</option>
                    <option value="acessorios">Acessórios</option>
                    <option value="kits">Kits</option>
                  </select>
                </label>
                <label className="field">
                  <span>Preço (R$) <b>*</b></span>
                  <input name="price" type="number" value={product.price} onChange={updateField} min="0" step="0.01" required placeholder="0,00" />
                </label>
                <label className="field field-wide">
                  <span>Descrição</span>
                  <textarea name="description" value={product.description} onChange={updateField} rows="3" placeholder="Conte um pouco sobre este produto" />
                </label>
                <label className="field">
                  <span>Peso (gramas)</span>
                  <input name="weight_grams" type="number" value={product.weight_grams} onChange={updateField} min="0" step="1" placeholder="Ex.: 250" />
                </label>
                <label className="field">
                  <span>URL da imagem</span>
                  <input name="image_url" type="url" value={product.image_url} onChange={updateField} maxLength="500" placeholder="https://..." />
                </label>
              </div>
            </section>

            {isCoffee && (
              <section className="form-section">
                <div className="section-heading">
                  <span className="section-number">02</span>
                  <div>
                    <h2>Origem e perfil</h2>
                    <p>Detalhes para apresentar este café</p>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Origem</span>
                    <input name="origin" value={product.origin} onChange={updateField} maxLength="150" placeholder="Ex.: Mantiqueira de Minas" />
                  </label>
                  <label className="field">
                    <span>Produtor</span>
                    <input name="producer" value={product.producer} onChange={updateField} maxLength="150" placeholder="Nome do produtor" />
                  </label>
                  <label className="field">
                    <span>Altitude (m)</span>
                    <input name="altitude" type="number" value={product.altitude} onChange={updateField} min="0" step="1" placeholder="Ex.: 1200" />
                  </label>
                  <label className="field">
                    <span>Variedade</span>
                    <input name="variety" value={product.variety} onChange={updateField} maxLength="100" placeholder="Ex.: Catuaí Vermelho" />
                  </label>
                  <label className="field">
                    <span>Nota (SCA)</span>
                    <input name="score" type="number" value={product.score} onChange={updateField} min="0" max="999.9" step="0.1" placeholder="Ex.: 86,5" />
                  </label>
                  <label className="field">
                    <span>Notas sensoriais</span>
                    <input name="sensory_notes" value={product.sensory_notes} onChange={updateField} placeholder="Chocolate, caramelo, cítrico" />
                    <small>Separe cada nota com vírgula.</small>
                  </label>
                </div>
              </section>
            )}

            <section className="form-section form-section-last">
              <div className="section-heading">
                <span className="section-number">{isCoffee ? '03' : '02'}</span>
                <div>
                  <h2>Estoque e disponibilidade</h2>
                  <p>Controle a quantidade e a exibição na loja</p>
                </div>
              </div>
              <div className="form-grid form-grid-stock">
                <label className="field">
                  <span>Quantidade em estoque <b>*</b></span>
                  <input name="stock" type="number" value={product.stock} onChange={updateField} min="0" step="1" required />
                </label>
                <label className="active-toggle">
                  <input name="active" type="checkbox" checked={product.active} onChange={updateField} />
                  <span className="toggle-copy"><strong>Produto ativo</strong><small>Disponível para venda na loja</small></span>
                </label>
              </div>
            </section>

            <footer className="form-footer">
              {feedback && <p className={`form-feedback feedback-${feedback.type}`} role="status">{feedback.message}</p>}
              {editingId && <button className="text-action cancel-edit-button" type="button" onClick={() => { setEditingId(null); setProduct(initialProduct); openProducts() }}>Cancelar edição</button>}
              <button className="submit-button" type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}
              </button>
            </footer>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
