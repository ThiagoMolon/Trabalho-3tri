const express = require('express')
const {
  getPayment,
  getPreapproval,
  verifyWebhookSignature,
} = require('../services/mercadopago')

function cents(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : null
}

function readNotificationUrl(req) {
  return new URL(req.originalUrl, 'https://webhook.invalid')
}

async function processPayment(pool, payment) {
  const externalReference = String(payment.external_reference || '')
  const orderId = Number(externalReference)
  if (!/^\d+$/.test(externalReference) || !Number.isInteger(orderId) || orderId < 1
    || payment.status !== 'approved'
    || payment.currency_id !== 'BRL'
    || !payment.id) return

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `SELECT id, status, total, payment_gateway, gateway_payment_id
       FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    )
    if (result.rowCount === 0) {
      await client.query('ROLLBACK')
      return
    }

    const order = result.rows[0]
    if (cents(order.total) !== cents(payment.transaction_amount)
      || (order.payment_gateway && order.payment_gateway !== 'mercadopago')
      || (order.gateway_payment_id && String(order.gateway_payment_id) !== String(payment.id))) {
      await client.query('ROLLBACK')
      return
    }
    if (order.status === 'pending') {
      await client.query(
        `UPDATE orders SET status = 'paid', payment_gateway = 'mercadopago',
          gateway_payment_id = $1 WHERE id = $2`,
        [String(payment.id), orderId],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      console.error('Could not roll back Mercado Pago payment notification:', rollbackError.message)
    }
    throw error
  } finally {
    client.release()
  }
}

async function processSubscription(pool, preapproval) {
  const planId = preapproval.preapproval_plan_id
  const statusMap = {
    pending: 'pendente',
    authorized: 'ativa',
    paused: 'pausada',
    cancelled: 'cancelada',
    rejected: 'cancelada',
  }
  const status = statusMap[preapproval.status]
  if (!planId || !status) return

  const subscription = await pool.query(
    `SELECT id, customer_email, status
     FROM customer_subscriptions WHERE mercadopago_plan_id = $1`,
    [String(planId)],
  )
  if (subscription.rowCount === 0
    || subscription.rows[0].customer_email.toLowerCase() !== String(preapproval.payer_email || '').toLowerCase()) {
    return
  }

  const nextRenewal = preapproval.next_payment_date
    ? new Date(preapproval.next_payment_date).toISOString().slice(0, 10)
    : null
  await pool.query(
    `UPDATE customer_subscriptions SET
      mercadopago_preapproval_id = $1,
      status = $2,
      started_at = CASE WHEN $2 = 'ativa' AND status <> 'ativa' THEN CURRENT_DATE ELSE started_at END,
      next_renewal = $3,
      canceled_at = CASE WHEN $2 = 'cancelada' THEN COALESCE(canceled_at, NOW())
        WHEN $2 = 'ativa' OR $2 = 'pausada' THEN NULL ELSE canceled_at END
     WHERE id = $4 AND mercadopago_plan_id = $5`,
    [String(preapproval.id), status, nextRenewal, subscription.rows[0].id, String(planId)],
  )
}

function createMercadoPagoWebhooksRouter(pool, options = {}) {
  const router = express.Router()
  const environment = options.environment || process.env
  const fetchOptions = {
    environment,
    fetchImpl: options.fetchImpl || globalThis.fetch,
  }

  router.post('/', async (req, res) => {
    const url = readNotificationUrl(req)
    const dataId = url.searchParams.get('data.id')
    const type = url.searchParams.get('type') || req.body?.type
    const secret = environment.MP_WEBHOOK_SECRET?.trim()
    if (!secret) return res.status(503).json({ message: 'A validação do webhook do Mercado Pago não está configurada.' })

    if (!verifyWebhookSignature({
      signature: req.get('x-signature'),
      requestId: req.get('x-request-id'),
      dataId,
      secret,
    })) {
      return res.status(401).json({ message: 'Assinatura do webhook inválida.' })
    }

    try {
      if (type === 'payment') {
        await processPayment(pool, await getPayment(dataId, fetchOptions))
      } else if (type === 'subscription_preapproval' || type === 'preapproval') {
        await processSubscription(pool, await getPreapproval(dataId, fetchOptions))
      }
      return res.sendStatus(200)
    } catch (error) {
      console.error('Could not process Mercado Pago notification:', error.message)
      return res.status(error.statusCode || 500).json({ message: 'Não foi possível processar a notificação do Mercado Pago.' })
    }
  })

  return router
}

module.exports = createMercadoPagoWebhooksRouter
module.exports.processPayment = processPayment
module.exports.processSubscription = processSubscription
