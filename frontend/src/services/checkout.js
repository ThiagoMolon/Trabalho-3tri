const DELIVERY_STORAGE_KEY = 'origin-beans-delivery'

const shippingOptions = {
  pac: { label: 'PAC', price: 18.9 },
  sedex: { label: 'SEDEX', price: 32.4 },
}

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
    && Object.hasOwn(shippingOptions, value.shippingMethod)
}

export function getShippingOptions() {
  return shippingOptions
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
