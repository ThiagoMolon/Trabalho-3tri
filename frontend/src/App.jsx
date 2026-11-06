import { useEffect, useState } from 'react'
import api from './services/api'
import SubscriptionManager from './admin/Subscription'
import QuizManager from './admin/Quiz'
import TasteFinder from './TasteFinder'
import AuthPage, { AccountPage, PasswordResetPage, PasswordResetRequestPage } from './AuthPages'
import Dashboard from './admin/Dashboard'
import MrrChurn from './admin/MrrChurn'
import Subscribers from './admin/Subscribers'
import Customers from './admin/Customers'
import Payments from './admin/Payments'
import RoastBatches from './admin/RoastBatches'
import Stock from './admin/Stock'
import Settings from './admin/Settings'
import Catalog from './admin/Catalog'
import ProductForm, { initialProduct, productToForm } from './admin/ProductForm'
import './App.scss'

const navSections = [
  {
    label: 'VISÃO GERAL',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'mrr-churn', label: 'MRR e Churn' },
    ],
  },
  {
    label: 'CATÁLOGO',
    items: [
      { id: 'products', label: 'Produtos' },
      { id: 'product-form', label: 'Novo produto' },
      { id: 'plans', label: 'Planos' },
      { id: 'subscriptions', label: 'Assinaturas' },
    ],
  },
  {
    label: 'ASSINATURAS',
    items: [
      { id: 'subscribers', label: 'Assinantes' },
      { id: 'customers', label: 'Clientes' },
      { id: 'payments', label: 'Pagamentos' },
    ],
  },
  {
    label: 'OPERAÇÃO',
    items: [
      { id: 'roast-batches', label: 'Lotes de torra' },
      { id: 'stock', label: 'Estoque' },
    ],
  },
  {
    label: 'TASTE FINDER',
    items: [{ id: 'quiz', label: 'Quiz' }],
  },
  {
    label: 'SISTEMA',
    items: [{ id: 'settings', label: 'Configurações' }],
  },
]

const topbarLabels = {
  dashboard: 'Dashboard',
  'mrr-churn': 'MRR e Churn',
  products: 'Produtos',
  'product-form': 'Novo produto',
  plans: 'Planos',
  subscriptions: 'Assinaturas',
  subscribers: 'Assinantes',
  customers: 'Clientes',
  payments: 'Pagamentos',
  'roast-batches': 'Lotes de torra',
  stock: 'Estoque',
  quiz: 'Taste Finder',
  settings: 'Configurações',
}

function AdminApp({ user }) {
  const [view, setView] = useState('dashboard')
  const [subscriptionTab, setSubscriptionTab] = useState('plans')
  const [editingProductId, setEditingProductId] = useState(null)
  const [productFormValues, setProductFormValues] = useState(initialProduct)
  const [catalogNotice, setCatalogNotice] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  function openProducts(notice = '') {
    setCatalogNotice(notice)
    setEditingProductId(null)
    setProductFormValues(initialProduct)
    setView('products')
  }

  function openNewProduct() {
    setEditingProductId(null)
    setProductFormValues(initialProduct)
    setCatalogNotice('')
    setView('product-form')
  }

  function openEditProduct(item) {
    setEditingProductId(item.id)
    setProductFormValues(productToForm(item))
    setCatalogNotice('')
    setView('product-form')
  }

  function openSubscriptions(tab = 'plans') {
    setSubscriptionTab(tab)
    setView(tab === 'plans' ? 'plans' : 'subscriptions')
  }

  function handleNavClick(itemId) {
    if (itemId === 'product-form') {
      openNewProduct()
      return
    }
    if (itemId === 'plans') {
      openSubscriptions('plans')
      return
    }
    if (itemId === 'subscriptions') {
      openSubscriptions('subscriptions')
      return
    }
    if (itemId === 'products') {
      openProducts()
      return
    }
    setView(itemId)
  }

  function isNavActive(itemId) {
    if (itemId === 'product-form') return view === 'product-form'
    if (itemId === 'plans') return view === 'plans' || (view === 'subscriptions' && subscriptionTab === 'plans')
    if (itemId === 'subscriptions') return view === 'subscriptions' && subscriptionTab === 'subscriptions'
    return view === itemId
  }

  async function handleLogout() {
    setSigningOut(true)
    setLogoutError('')
    try {
      await api.post('/auth/logout')
      window.location.replace('/login')
    } catch (error) {
      setLogoutError(error.response?.data?.message || 'Não foi possível encerrar sua sessão.')
      setSigningOut(false)
    }
  }

  const topbarLabel = view === 'product-form'
    ? (editingProductId ? 'Editar produto' : 'Novo produto')
    : topbarLabels[view]

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Origin Beans, início">
          <span className="brand-mark">OB</span>
          <span>origin<span className="brand-light">beans</span></span>
        </a>

        <nav className="sidebar-nav" aria-label="Navegação administrativa">
          {navSections.map((section, index) => (
            <section className="sidebar-nav-section" key={section.label} aria-label={section.label}>
              <h2 className={`sidebar-label ${index > 0 ? 'sidebar-section-label' : ''}`}>{section.label}</h2>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${isNavActive(item.id) ? 'nav-item-active' : ''}`}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isNavActive(item.id) ? 'page' : undefined}
                >
                  <span className="nav-indicator" /> {item.label}
                </button>
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" /> Painel administrativo
        </div>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <span>Loja / {topbarLabel}</span>
          <div className="topbar-user">
            <span className="topbar-account">{user.name}</span>
            <button className="topbar-logout" type="button" onClick={handleLogout} disabled={signingOut}>
              {signingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </header>

        <div className="page-content page-content-wide">
          {logoutError && <p className="catalog-feedback feedback-error" role="alert">{logoutError}</p>}
          {view === 'dashboard' && <Dashboard />}
          {view === 'mrr-churn' && <MrrChurn />}
          {view === 'products' && (
            <>
              {catalogNotice && <p className="catalog-feedback feedback-success" role="status">{catalogNotice}</p>}
              <Catalog
                onNewProduct={openNewProduct}
                onEditProduct={openEditProduct}
                onOpenSubscriptions={openSubscriptions}
              />
            </>
          )}
          {view === 'product-form' && (
            <ProductForm
              key={editingProductId || 'new'}
              editingId={editingProductId}
              initialValues={productFormValues}
              onCancel={() => openProducts()}
              onSaved={(message) => openProducts(message)}
            />
          )}
          {(view === 'plans' || view === 'subscriptions') && (
            <SubscriptionManager
              activeTab={subscriptionTab}
              onTabChange={(tab) => {
                setSubscriptionTab(tab)
                setView(tab === 'plans' ? 'plans' : 'subscriptions')
              }}
            />
          )}
          {view === 'subscribers' && <Subscribers />}
          {view === 'customers' && <Customers />}
          {view === 'payments' && <Payments />}
          {view === 'roast-batches' && <RoastBatches />}
          {view === 'stock' && <Stock />}
          {view === 'quiz' && <QuizManager />}
          {view === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  )
}

function AdminGate() {
  const [status, setStatus] = useState('checking')
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    api.get('/auth/me')
      .then(({ data }) => {
        if (!isCurrent) return
        if (data.user.role !== 'admin') {
          window.location.replace('/conta')
          return
        }
        setUser(data.user)
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isCurrent) return
        if (requestError.response?.status === 401) {
          window.location.replace('/login')
          return
        }
        setError(requestError.response?.data?.message || 'Não foi possível validar o acesso administrativo.')
        setStatus('error')
      })

    return () => {
      isCurrent = false
    }
  }, [])

  if (status === 'checking') {
    return <main className="auth-page"><p className="catalog-empty">Verificando acesso...</p></main>
  }
  if (status === 'error') {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="auth-feedback feedback-error" role="alert">{error}</p>
          <a className="submit-button auth-submit" href="/login">Voltar ao login</a>
        </section>
      </main>
    )
  }
  return <AdminApp user={user} />
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/quiz') return <TasteFinder />
  if (path === '/login') return <AuthPage mode="login" />
  if (path === '/cadastro') return <AuthPage mode="register" />
  if (path === '/conta') return <AccountPage />
  if (path === '/esqueci-senha') return <PasswordResetRequestPage />
  if (path === '/redefinir-senha') return <PasswordResetPage />
  return <AdminGate />
}

export default App
