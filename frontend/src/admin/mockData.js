export const dashboardMetrics = {
  mrr: 18450,
  mrrDelta: 8.4,
  churn: 3.2,
  churnCount: 4,
  activeSubscribers: 126,
  pausedSubscribers: 9,
  grindToday: [
    { type: 'Grãos inteiros', kg: 12.5 },
    { type: 'Espresso', kg: 8.2 },
    { type: 'Filtro', kg: 6.4 },
  ],
}

export const mrrHistory = {
  labels: ['Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov'],
  revenue: [14200, 14850, 15100, 15640, 16020, 16480, 16890, 17210, 17540, 17890, 18120, 18450],
  churnRate: [4.8, 4.5, 4.1, 3.9, 4.2, 3.8, 3.6, 3.5, 3.4, 3.1, 3.3, 3.2],
  newSubs: 18,
  cancellations: 4,
}

export const subscribers = [
  { id: 1, name: 'Ana Souza', plan: 'Autoral', grind: 'Filtro', frequency: 'semanal', nextRenewal: '2026-11-08', status: 'ativa' },
  { id: 2, name: 'Bruno Lima', plan: 'Origem', grind: 'Espresso', frequency: 'mensal', nextRenewal: '2026-11-15', status: 'ativa' },
  { id: 3, name: 'Carla Mendes', plan: 'Reserva', grind: 'Grãos inteiros', frequency: 'quinzenal', nextRenewal: '2026-11-12', status: 'pausada' },
  { id: 4, name: 'Diego Alves', plan: 'Origem', grind: 'Filtro', frequency: 'mensal', nextRenewal: '2026-11-20', status: 'ativa' },
  { id: 5, name: 'Elena Costa', plan: 'Autoral', grind: 'Espresso', frequency: 'semanal', nextRenewal: null, status: 'cancelada' },
  { id: 6, name: 'Felipe Rocha', plan: 'Reserva', grind: 'Grãos inteiros', frequency: 'mensal', nextRenewal: '2026-12-01', status: 'ativa' },
]

export const customers = [
  { id: 1, name: 'Ana Souza', email: 'ana@email.com', city: 'São Paulo', cep: '01310-100', orders: 14, taste: 'doce/ácido', createdAt: '2025-03-12' },
  { id: 2, name: 'Bruno Lima', email: 'bruno@email.com', city: 'Curitiba', cep: '80010-000', orders: 8, taste: 'amargo/doce', createdAt: '2025-06-02' },
  { id: 3, name: 'Carla Mendes', email: 'carla@email.com', city: 'Belo Horizonte', cep: '30130-000', orders: 5, taste: 'ácido', createdAt: '2025-08-19' },
  { id: 4, name: 'Diego Alves', email: 'diego@email.com', city: 'Porto Alegre', cep: '90010-150', orders: 11, taste: 'doce', createdAt: '2025-01-28' },
  { id: 5, name: 'Elena Costa', email: 'elena@email.com', city: 'Florianópolis', cep: '88010-400', orders: 3, taste: 'amargo/ácido', createdAt: '2026-02-14' },
]

export const payments = [
  { id: 1, date: '2026-11-02', reference: 'Assinatura #4821', customer: 'Ana Souza', method: 'cartão', amount: 89.9, status: 'aprovado' },
  { id: 2, date: '2026-11-02', reference: 'Pedido #1093', customer: 'Bruno Lima', method: 'pix', amount: 64.5, status: 'aprovado' },
  { id: 3, date: '2026-11-01', reference: 'Assinatura #4790', customer: 'Carla Mendes', method: 'cartão', amount: 129.9, status: 'pendente' },
  { id: 4, date: '2026-10-31', reference: 'Pedido #1088', customer: 'Diego Alves', method: 'pix', amount: 42, status: 'recusado' },
  { id: 5, date: '2026-10-30', reference: 'Assinatura #4702', customer: 'Elena Costa', method: 'cartão', amount: 89.9, status: 'aprovado' },
  { id: 6, date: '2026-10-29', reference: 'Pedido #1075', customer: 'Felipe Rocha', method: 'pix', amount: 158, status: 'pendente' },
]

export const roastBatches = [
  { id: 1, code: 'LT-2411-A', coffee: 'Serra do Caparaó', roastDate: '2026-11-01', roastedKg: 25, availableKg: 18.4, status: 'disponivel' },
  { id: 2, code: 'LT-2410-C', coffee: 'Mantiqueira de Minas', roastDate: '2026-10-28', roastedKg: 20, availableKg: 4.2, status: 'baixo' },
  { id: 3, code: 'LT-2410-B', coffee: 'Chapada Diamantina', roastDate: '2026-10-22', roastedKg: 15, availableKg: 0, status: 'esgotado' },
  { id: 4, code: 'LT-2410-A', coffee: 'Cerrado Mineiro', roastDate: '2026-10-18', roastedKg: 30, availableKg: 12.8, status: 'disponivel' },
]

export const stockItems = [
  { id: 1, coffee: 'Serra do Caparaó', grind: 'grãos inteiros', batch: 'LT-2411-A', quantity: 8.5, minimum: 3, status: 'ok' },
  { id: 2, coffee: 'Serra do Caparaó', grind: 'espresso', batch: 'LT-2411-A', quantity: 5.2, minimum: 2, status: 'ok' },
  { id: 3, coffee: 'Mantiqueira de Minas', grind: 'filtro', batch: 'LT-2410-C', quantity: 1.4, minimum: 2, status: 'baixo' },
  { id: 4, coffee: 'Chapada Diamantina', grind: 'grãos inteiros', batch: 'LT-2410-B', quantity: 0, minimum: 2, status: 'esgotado' },
  { id: 5, coffee: 'Cerrado Mineiro', grind: 'espresso', batch: 'LT-2410-A', quantity: 6.1, minimum: 3, status: 'ok' },
  { id: 6, coffee: 'Cerrado Mineiro', grind: 'filtro', batch: 'LT-2410-A', quantity: 2.2, minimum: 3, status: 'baixo' },
]

export const defaultSettings = {
  store: { name: 'Origin Beans', email: 'contato@originbeans.com.br', phone: '(11) 4000-1234' },
  shipping: { originCep: '01310-100', pac: true, sedex: true },
  payments: { provider: 'stripe', apiKey: '' },
  team: [
    { id: 1, name: 'Thiago Admin', email: 'admin@originbeans.com.br', role: 'ADM' },
    { id: 2, name: 'Marina Operação', email: 'marina@originbeans.com.br', role: 'Operação' },
  ],
}
