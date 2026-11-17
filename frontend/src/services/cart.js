const CART_STORAGE_KEY = 'origin-beans-cart'
const SHIPPING_STORAGE_KEY = 'origin-beans-shipping'

function isCartItem(item) {
  if (item?.item_type === 'subscription') {
    return Number.isInteger(item.plan_id)
      && item.plan_id > 0
      && typeof item.name === 'string'
      && Number.isFinite(Number(item.price))
      && Number.isInteger(item.quantity)
      && item.quantity > 0
      && typeof item.grind === 'string'
      && typeof item.frequency === 'string'
  }
  return item
    && (item.item_type === undefined || item.item_type === 'product')
    && Number.isInteger(item.product_id)
    && item.product_id > 0
    && typeof item.name === 'string'
    && Number.isFinite(Number(item.price))
    && Number.isInteger(item.quantity)
    && item.quantity > 0
    && typeof item.grind === 'string'
}

export function readCart() {
  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY)
    const items = stored ? JSON.parse(stored) : []
    if (!Array.isArray(items) || items.some((item) => !isCartItem(item))) {
      throw new Error('O conteúdo salvo não corresponde ao formato do carrinho.')
    }
    return { items, error: '' }
  } catch (error) {
    console.error('Could not read the local cart:', error)
    return { items: [], error: 'Não foi possível carregar o carrinho salvo neste navegador.' }
  }
}

function writeCart(items) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    window.localStorage.removeItem(SHIPPING_STORAGE_KEY)
    window.dispatchEvent(new Event('origin-cart-updated'))
    return ''
  } catch (error) {
    console.error('Could not save the local cart:', error)
    return 'Não foi possível salvar o carrinho neste navegador.'
  }
}

export function addCartItem(product, quantity = 1, grind = 'Grãos inteiros') {
  const current = readCart()
  if (current.error) return current.error

  const itemIndex = current.items.findIndex((item) => item.item_type !== 'subscription' && item.product_id === product.id && item.grind === grind)
  const items = [...current.items]
  if (itemIndex >= 0) {
    items[itemIndex] = { ...items[itemIndex], quantity: items[itemIndex].quantity + quantity }
  } else {
    items.push({
      item_type: 'product',
      product_id: product.id,
      name: product.name,
      price: Number(product.price),
      weight_grams: product.weight_grams,
      image_url: product.image_url,
      in_stock: product.in_stock,
      quantity,
      grind,
    })
  }
  return writeCart(items)
}

export function addSubscriptionCartItem(plan, quantity = 1, grind = 'Grãos inteiros', frequency = 'mensal') {
  const current = readCart()
  if (current.error) return current.error
  const itemIndex = current.items.findIndex((item) => (
    item.item_type === 'subscription'
    && item.plan_id === plan.id
    && item.grind === grind
    && item.frequency === frequency
  ))
  const items = [...current.items]
  if (itemIndex >= 0) {
    items[itemIndex] = { ...items[itemIndex], quantity: items[itemIndex].quantity + quantity }
  } else {
    items.push({
      item_type: 'subscription',
      plan_id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      quantity,
      grind,
      frequency,
    })
  }
  return writeCart(items)
}

function sameCartItem(left, right) {
  if (left.item_type === 'subscription') {
    return right.item_type === 'subscription'
      && left.plan_id === right.plan_id
      && left.grind === right.grind
      && left.frequency === right.frequency
  }
  return right.item_type !== 'subscription'
    && left.product_id === right.product_id
    && left.grind === right.grind
}

export function updateCartItem(targetItem, quantity) {
  const current = readCart()
  if (current.error) return current.error
  const items = current.items
    .map((item) => sameCartItem(targetItem, item) ? { ...item, quantity } : item)
    .filter((item) => item.quantity > 0)
  return writeCart(items)
}

export function removeCartItem(targetItem) {
  const current = readCart()
  if (current.error) return current.error
  return writeCart(current.items.filter((item) => !sameCartItem(targetItem, item)))
}

export function clearCart() {
  return writeCart([])
}

export function serializeCartItems(items) {
  return items.map((item) => item.item_type === 'subscription'
    ? {
      item_type: 'subscription',
      plan_id: item.plan_id,
      quantity: item.quantity,
      grind: item.grind,
      frequency: item.frequency,
    }
    : {
      item_type: 'product',
      product_id: item.product_id,
      quantity: item.quantity,
      grind: item.grind,
    })
}
