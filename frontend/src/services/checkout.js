const DELIVERY_STORAGE_KEY = 'origin-beans-delivery'
const SHIPPING_STORAGE_KEY = 'origin-beans-shipping'

function isDelivery(value) {
  return value
    && value.address
    && typeof value.address.recipient === 'string'
    && typeof value.address.phone === 'string'
    && typeof value.address.postalCode === 'string'
    && typeof value.address.street === 'string'
    && typeof value.address.number === 'string'
    && typeof value.address.neighborhood === 'string'
    && typeof value.address.city === 'string'
    && typeof value.address.state === 'string'
    && ['pac', 'sedex'].includes(value.shippingMethod)
    && Number.isFinite(Number(value.shippingCost))
}

export function readShippingQuote() {
  try {
    const stored = window.localStorage.getItem(SHIPPING_STORAGE_KEY)
    if (!stored) return { quote: null, error: '' }
    const quote = JSON.parse(stored)
    if (!quote || !/^\d{8}$/.test(String(quote.cep)) || !Array.isArray(quote.options)
      || quote.options.some((option) => !['pac', 'sedex'].includes(option.id)
        || !Number.isFinite(Number(option.cost)))) {
      throw new Error('O conteúdo salvo não corresponde ao formato do frete.')
    }
    return { quote, error: '' }
  } catch (error) {
    console.error('Could not read the saved shipping quote:', error)
    return { quote: null, error: 'Não foi possível carregar o cálculo de frete salvo.' }
  }
}

export function saveShippingQuote(quote) {
  try {
    window.localStorage.setItem(SHIPPING_STORAGE_KEY, JSON.stringify(quote))
    return ''
  } catch (error) {
    console.error('Could not save the shipping quote:', error)
    return 'Não foi possível salvar o cálculo de frete neste navegador.'
  }
}

export function clearShippingQuote() {
  try {
    window.localStorage.removeItem(SHIPPING_STORAGE_KEY)
    return ''
  } catch (error) {
    console.error('Could not clear the shipping quote:', error)
    return 'Não foi possível remover o cálculo de frete salvo.'
  }
}

export function readDelivery() {
  try {
    const stored = window.localStorage.getItem(DELIVERY_STORAGE_KEY)
    if (!stored) return { delivery: null, error: '' }

    const delivery = JSON.parse(stored)
    if (!isDelivery(delivery)) {
      throw new Error('O conteúdo salvo não corresponde ao formato do endereço.')
    }

    return { delivery, error: '' }
  } catch (error) {
    console.error('Could not read the saved delivery details:', error)
    return { delivery: null, error: 'Não foi possível carregar o endereço salvo neste navegador.' }
  }
}

export function saveDelivery(delivery) {
  try {
    window.localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(delivery))
    return ''
  } catch (error) {
    console.error('Could not save the delivery details:', error)
    return 'Não foi possível salvar o endereço neste navegador.'
  }
}

export function clearDelivery() {
  try {
    window.localStorage.removeItem(DELIVERY_STORAGE_KEY)
    return ''
  } catch (error) {
    console.error('Could not clear the saved delivery details:', error)
    return 'Não foi possível remover o endereço salvo.'
  }
}
