const CART_STORAGE_KEY = 'origin-beans-cart'

function isCartItem(item) {
  return item
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

  const itemIndex = current.items.findIndex((item) => item.product_id === product.id && item.grind === grind)
  const items = [...current.items]
  if (itemIndex >= 0) {
    items[itemIndex] = { ...items[itemIndex], quantity: items[itemIndex].quantity + quantity }
  } else {
    items.push({
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

export function updateCartItem(productId, grind, quantity) {
  const current = readCart()
  if (current.error) return current.error
  const items = current.items
    .map((item) => item.product_id === productId && item.grind === grind ? { ...item, quantity } : item)
    .filter((item) => item.quantity > 0)
  return writeCart(items)
}

export function removeCartItem(productId, grind) {
  const current = readCart()
  if (current.error) return current.error
  return writeCart(current.items.filter((item) => item.product_id !== productId || item.grind !== grind))
}
