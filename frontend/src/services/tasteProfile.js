export const tasteDimensions = ['acidity', 'bitterness', 'sweetness']
export const tasteMatchTolerance = 1

function readScore(value) {
  if (value === null || value === undefined || value === '') return null
  const score = Number(value)
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score : null
}

export function readTasteProfile(search) {
  const params = new URLSearchParams(search)
  const scores = tasteDimensions.map((dimension) => readScore(params.get(dimension)))
  if (scores.some((score) => score === null)) return null
  return Object.fromEntries(tasteDimensions.map((dimension, index) => [dimension, scores[index]]))
}

export function buildTasteStoreUrl(profile) {
  const params = new URLSearchParams()
  for (const dimension of tasteDimensions) {
    params.set(dimension, String(profile[dimension]))
  }
  return `/loja?${params.toString()}`
}

export function hasSensoryProfile(product) {
  return tasteDimensions.every((dimension) => readScore(product?.[dimension]) !== null)
}

export function filterProductsForTaste(products, profile) {
  if (!profile) return products
  return products.filter((product) => {
    if (!['graos', 'moidos'].includes(product.category)) return false
    if (!hasSensoryProfile(product)) return true
    return tasteDimensions.every((dimension) => (
      Math.abs(Number(product[dimension]) - Number(profile[dimension])) <= tasteMatchTolerance
    ))
  })
}
