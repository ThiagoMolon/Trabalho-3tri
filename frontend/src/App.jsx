import { useState } from 'react'
import api from './services/api'
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

function App() {
  const [product, setProduct] = useState(initialProduct)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const isCoffee = product.category === 'graos' || product.category === 'moidos'

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

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Origin Beans, início">
          <span className="brand-mark">OB</span>
          <span>origin<span className="brand-light">beans</span></span>
        </a>
        <div className="sidebar-label">CATÁLOGO</div>
        <div className="nav-item nav-item-active" aria-current="page">
          <span className="nav-indicator" /> Produtos
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" /> Painel administrativo
        </div>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <span>Loja / Produtos</span>
          <span className="topbar-account">Administração</span>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CATÁLOGO DA LOJA</p>
              <h1>Novo produto</h1>
              <p className="page-description">Preencha os dados para adicionar um item ao catálogo.</p>
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
              <button className="submit-button" type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Cadastrar produto'}
              </button>
            </footer>
          </form>
        </div>
      </main>
    </div>
  )
}

export default App
