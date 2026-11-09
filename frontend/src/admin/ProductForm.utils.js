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
  stock: '0',
  active: true,
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
    sensory_notes: (item.sensory_notes || []).join(', '),
    stock: String(item.stock),
    active: item.active,
  }
}
