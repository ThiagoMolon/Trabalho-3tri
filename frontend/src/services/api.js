// src/services/api.js
import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8787',
  withCredentials: true, // necessário para enviar/receber cookies de sessão
})

// Rotas específicas (com joins no Worker) — retornam { count, rows }
async function fetchEndpoint(endpoint) {
  const res = await API.get(endpoint)
  return res.data.rows || res.data || []
}

// ── Clientes ──────────────────────────────────────────────
export const getCustomers = async () => fetchEndpoint('/customers')

// ── Pagamentos / Pedidos ───────────────────────────────────
export const getPayments = async () => fetchEndpoint('/payments')

// ── Produtos ──────────────────────────────────────────────
export const getProducts = async () => fetchEndpoint('/products')

// ── Listas genéricas (tabelas simples) ────────────────────
async function fetchTable(table) {
  const res = await API.get(`/data/${table}`)
  return res.data.rows || res.data || []
}

export const getSubscribers = async () => fetchTable('customer_subscriptions')
export const getStockItems = async () => fetchTable('products')

// ── Métricas (placeholder) ────────────────────────────────
export const getDashboardMetrics = async () => {
  return {}
}
export const getMrrHistory = async () => {
  return { labels: [], revenue: [], churnRate: [], newSubs: 0, cancellations: 0 }
}

// ── Escrita (requer rotas POST/PUT/DELETE no Worker) ──────
export const createCustomer = (data) => API.post('/customers', data).then((r) => r.data)
export const updateCustomer = (id, data) => API.put(`/customers/${id}`, data).then((r) => r.data)
export const deleteCustomer = (id) => API.delete(`/customers/${id}`).then((r) => r.data)

export default API
