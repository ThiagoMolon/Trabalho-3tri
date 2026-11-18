export const initialProduct = {
  name: '',
  category: 'graos',
  description: '',
  price: '',
  weight_grams: '',
  image_url: '',
  origin: '',
  producer: '',
  altitude: '',
  variety: '',
  score: '',
  sensory_notes: '',
  acidity: '',
  bitterness: '',
  sweetness: '',
  stock: '0',
  active: true,
}

function formatSensoryNotes(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value !== 'string' || !value) return ''

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.join(', ')
  } catch {
    // Older product records may store notes as comma-separated text.
  }

  return value
}

export function productToForm(item) {
  return {
    name: item.name,
    category: item.category,
    description: item.description || '',
    price: String(item.price),
    weight_grams: item.weight_grams == null ? '' : String(item.weight_grams),
    image_url: item.image_url || '',
    origin: item.origin || '',
    producer: item.producer || '',
    altitude: item.altitude == null ? '' : String(item.altitude),
    variety: item.variety || '',
    score: item.score == null ? '' : String(item.score),
    sensory_notes: formatSensoryNotes(item.sensory_notes),
    acidity: item.acidity == null ? '' : String(item.acidity),
    bitterness: item.bitterness == null ? '' : String(item.bitterness),
    sweetness: item.sweetness == null ? '' : String(item.sweetness),
    stock: String(item.stock),
    active: item.active,
  }
}
