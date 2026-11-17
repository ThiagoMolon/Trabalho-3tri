const crypto = require('node:crypto')

const apiOrigin = 'https://api.mercadopago.com'

function configurationError(message) {
  const error = new Error(message)
  error.statusCode = 503
  return error
}

function publicUrl(value, label) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw configurationError(`Configure ${label} com uma URL pública HTTPS.`)
  }
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw configurationError(`Configure ${label} com uma URL pública HTTPS.`)
  }
  return url
}

function getFrontendUrl(environment = process.env) {
  const configuredUrl = environment.FRONTEND_URL?.trim()
  if (!configuredUrl) throw configurationError('Configure FRONTEND_URL antes de habilitar o Mercado Pago.')
  return publicUrl(configuredUrl, 'FRONTEND_URL').origin
}

function getWebhookUrl(environment = process.env) {
  const frontendUrl = getFrontendUrl(environment)
  const configuredUrl = environment.MP_WEBHOOK_URL?.trim()
  return configuredUrl
    ? publicUrl(configuredUrl, 'MP_WEBHOOK_URL').toString()
    : new URL('/webhooks/mercadopago', frontendUrl).toString()
}

function getAccessToken(environment = process.env) {
  const token = environment.MP_ACCESS_TOKEN?.trim()
  if (!token) throw configurationError('Configure MP_ACCESS_TOKEN no ambiente do backend.')
  return token
}

function frequencySettings(frequency) {
  const settings = {
    semanal: { frequency: 7, frequency_type: 'days' },
    quinzenal: { frequency: 14, frequency_type: 'days' },
    mensal: { frequency: 1, frequency_type: 'months' },
    bimestral: { frequency: 2, frequency_type: 'months' },
  }[frequency]
  if (!settings) {
    const error = new Error('Selecione uma frequência válida.')
    error.statusCode = 400
    throw error
  }
  return settings
}

async function requestMercadoPago(path, { method = 'GET', body } = {}, {
  environment = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const response = await fetchImpl(`${apiOrigin}${path}`, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${getAccessToken(environment)}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok) {
    const error = new Error('A solicitação ao Mercado Pago falhou.')
    error.statusCode = 502
    error.providerStatus = response.status
    throw error
  }
  return response.json()
}

function buildOrderItems(order) {
  const items = order.items.map((item) => ({
    id: String(item.product_id || item.plan_id || item.id),
    title: item.name,
    quantity: Number(item.quantity),
    unit_price: Number(Number(item.unit_price).toFixed(2)),
    currency_id: 'BRL',
  }))
  const shippingCost = Number(order.shipping_cost)
  if (shippingCost > 0) {
    items.push({
      id: `shipping-${order.id}`,
      title: 'Frete',
      quantity: 1,
      unit_price: Number(shippingCost.toFixed(2)),
      currency_id: 'BRL',
    })
  }
  return items
}

async function createOrderPreference(order, payerEmail, subscriptionId, options = {}) {
  const environment = options.environment || process.env
  const frontendUrl = getFrontendUrl(environment)
  const backUrl = new URL(`/confirmacao/${order.id}`, frontendUrl)
  if (subscriptionId) backUrl.searchParams.set('subscription_id', String(subscriptionId))

  const preference = await requestMercadoPago('/checkout/preferences', {
    method: 'POST',
    body: {
      items: buildOrderItems(order),
      payer: { email: payerEmail },
      external_reference: String(order.id),
      metadata: { order_id: order.id },
      notification_url: getWebhookUrl(environment),
      back_urls: {
        success: backUrl.toString(),
        pending: backUrl.toString(),
        failure: backUrl.toString(),
      },
      auto_return: 'approved',
    },
  }, options)

  const isTestToken = getAccessToken(environment).startsWith('TEST-')
  const initPoint = isTestToken
    ? preference.sandbox_init_point || preference.init_point
    : preference.init_point || preference.sandbox_init_point
  if (!initPoint) {
    const error = new Error('O Mercado Pago não retornou o link de pagamento.')
    error.statusCode = 502
    throw error
  }
  if (!preference.id) {
    const error = new Error('O Mercado Pago não retornou o identificador da preferência.')
    error.statusCode = 502
    throw error
  }
  return { id: String(preference.id), initPoint }
}

async function createSubscriptionPlan({ name, frequency, amount, backUrl }, options = {}) {
  const plan = await requestMercadoPago('/preapproval_plan', {
    method: 'POST',
    body: {
      reason: name.slice(0, 200),
      auto_recurring: {
        ...frequencySettings(frequency),
        transaction_amount: Number(Number(amount).toFixed(2)),
        currency_id: 'BRL',
      },
      back_url: backUrl,
    },
  }, options)
  if (!plan.id || !plan.init_point) {
    const error = new Error('O Mercado Pago não retornou os dados da assinatura.')
    error.statusCode = 502
    throw error
  }
  return { id: String(plan.id), initPoint: plan.init_point }
}

function verifyWebhookSignature({ signature, requestId, dataId, secret }) {
  if (!signature || !requestId || !dataId || !secret) return false
  const parts = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, value] = part.trim().split('=')
      return [key, value]
    }),
  )
  if (!parts.ts || !/^[a-f\d]{64}$/i.test(parts.v1 || '')) return false

  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest()
  const received = Buffer.from(parts.v1, 'hex')
  return received.length === expected.length && crypto.timingSafeEqual(received, expected)
}

async function getPayment(paymentId, options = {}) {
  if (!/^\d+$/.test(String(paymentId))) {
    const error = new Error('Identificador de pagamento inválido.')
    error.statusCode = 400
    throw error
  }
  return requestMercadoPago(`/v1/payments/${encodeURIComponent(paymentId)}`, {}, options)
}

async function getPreapproval(preapprovalId, options = {}) {
  if (typeof preapprovalId !== 'string' || !preapprovalId.trim()) {
    const error = new Error('Identificador de assinatura inválido.')
    error.statusCode = 400
    throw error
  }
  return requestMercadoPago(`/preapproval/${encodeURIComponent(preapprovalId)}`, {}, options)
}

async function updatePreapproval(preapprovalId, body, options = {}) {
  return requestMercadoPago(`/preapproval/${encodeURIComponent(preapprovalId)}`, {
    method: 'PUT',
    body,
  }, options)
}

module.exports = {
  createOrderPreference,
  createSubscriptionPlan,
  frequencySettings,
  getFrontendUrl,
  getPayment,
  getPreapproval,
  getWebhookUrl,
  updatePreapproval,
  verifyWebhookSignature,
}
