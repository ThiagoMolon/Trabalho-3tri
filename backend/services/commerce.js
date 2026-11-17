function validationError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeCep(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

function readItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    throw validationError('Adicione ao menos um item válido ao carrinho.')
  }

  return items.map((item) => {
    const quantity = Number(item?.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw validationError('A quantidade de cada item deve estar entre 1 e 99.')
    }

    if (item?.item_type === 'subscription' || item?.itemType === 'subscription'
      || item?.plan_id !== undefined || item?.planId !== undefined) {
      const planId = Number(item.plan_id ?? item.planId)
      if (!Number.isInteger(planId) || planId < 1) throw validationError('Selecione um plano válido.')
      return {
        itemType: 'subscription',
        planId,
        quantity,
        grind: readGrind(item.grind),
        frequency: readFrequency(item.frequency),
      }
    }

    const productId = Number(item?.product_id ?? item?.productId)
    if (!Number.isInteger(productId) || productId < 1) throw validationError('Selecione um produto válido.')
    return {
      itemType: 'product',
      productId,
      quantity,
      grind: readGrind(item.grind),
      frequency: null,
    }
  })
}

function readGrind(value) {
  const grind = typeof value === 'string' ? value.trim() : ''
  if (!grind || grind.length > 50) throw validationError('Selecione uma moagem válida.')
  return grind
}

function readFrequency(value) {
  const frequency = value || 'mensal'
  if (!['semanal', 'quinzenal', 'mensal', 'bimestral'].includes(frequency)) {
    throw validationError('Selecione uma frequência válida.')
  }
  return frequency
}

function validateAddress(address) {
  if (!address || typeof address !== 'object' || Array.isArray(address)) {
    throw validationError('Informe um endereço de entrega válido.')
  }
  const fieldLimits = { street: 200, number: 20, neighborhood: 100, city: 100, state: 2 }
  const normalized = {}
  for (const [field, maxLength] of Object.entries(fieldLimits)) {
    const value = typeof address[field] === 'string' ? address[field].trim() : ''
    if (!value || value.length > maxLength) {
      throw validationError(`Informe ${field} para o endereço de entrega.`)
    }
    normalized[field] = value
  }
  const cep = normalizeCep(address.cep || address.postalCode)
  if (!/^\d{8}$/.test(cep)) throw validationError('Informe um CEP válido com 8 números.')
  const state = normalized.state.toUpperCase()
  if (!/^[A-Z]{2}$/.test(state)) throw validationError('Informe uma sigla de estado válida.')
  normalized.cep = cep
  normalized.state = state
  normalized.complement = typeof address.complement === 'string' ? address.complement.trim().slice(0, 100) : ''
  normalized.recipient = typeof address.recipient === 'string' ? address.recipient.trim().slice(0, 150) : ''
  normalized.phone = typeof address.phone === 'string' ? address.phone.trim().slice(0, 20) : ''
  return normalized
}

function shippingZone(cep) {
  const firstDigit = Number(cep[0])
  if (firstDigit <= 3 || firstDigit >= 8) return 'south-southeast'
  return 'other'
}

async function getShippingOptions(pool, cepValue, itemsValue) {
  const cep = normalizeCep(cepValue)
  if (!/^\d{8}$/.test(cep)) throw validationError('Informe um CEP válido com 8 números.')
  const items = readItems(itemsValue)
  let totalWeight = 0

  for (const item of items) {
    if (item.itemType === 'product') {
      const result = await pool.query(
        'SELECT weight_grams FROM products WHERE id = $1 AND active = TRUE',
        [item.productId],
      )
      if (result.rowCount === 0) throw validationError('Um dos produtos não está mais disponível.')
      totalWeight += Math.max(1, Number(result.rows[0].weight_grams) || 250) * item.quantity
      continue
    }

    const result = await pool.query(
      `SELECT plan.id,
        COALESCE(SUM(COALESCE(product.weight_grams, 250)), 0)::INT AS weight_grams
       FROM subscription_plans AS plan
       LEFT JOIN subscription_plan_products AS link ON link.plan_id = plan.id
       LEFT JOIN products AS product ON product.id = link.product_id AND product.active = TRUE
       WHERE plan.id = $1 AND plan.active = TRUE
       GROUP BY plan.id`,
      [item.planId],
    )
    if (result.rowCount === 0) throw validationError('Um dos planos não está mais disponível.')
    totalWeight += Math.max(250, Number(result.rows[0].weight_grams) || 250) * item.quantity
  }

  const weightKg = Math.max(1, Math.ceil(totalWeight / 1000))
  const isNear = shippingZone(cep) === 'south-southeast'
  const pacBase = isNear ? 17.9 : 27.9
  const sedexBase = isNear ? 29.9 : 42.9
  return {
    cep,
    weight_grams: totalWeight,
    options: [
      {
        id: 'pac',
        label: 'PAC',
        cost: roundCurrency(pacBase + (weightKg - 1) * 3.5),
        min_days: 7,
        max_days: 10,
      },
      {
        id: 'sedex',
        label: 'SEDEX',
        cost: roundCurrency(sedexBase + (weightKg - 1) * 6),
        min_days: 2,
        max_days: 4,
      },
    ],
  }
}

module.exports = {
  getShippingOptions,
  normalizeCep,
  readItems,
  validateAddress,
  validationError,
}
