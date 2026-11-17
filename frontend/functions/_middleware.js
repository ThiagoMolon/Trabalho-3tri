const defaultApiOrigin = 'https://trabalho-3tri.onrender.com'
const apiPathPrefixes = [
  '/auth/',
  '/vitrine/',
  '/produtos/',
  '/quiz/',
  '/planos/',
  '/assinaturas/',
  '/subscriptions/',
  '/addresses/',
  '/shipping/',
  '/orders/',
  '/webhooks/',
]

export async function onRequest({ request, env = {}, next }) {
  const url = new URL(request.url)
  const isApiRequest = url.pathname === '/health'
    || url.pathname === '/addresses'
    || url.pathname === '/orders'
    || apiPathPrefixes.some((prefix) => url.pathname.startsWith(prefix))

  if (!isApiRequest) return next()

  const apiOrigin = (env.API_ORIGIN || defaultApiOrigin).replace(/\/+$/, '')
  const apiUrl = `${apiOrigin}${url.pathname}${url.search}`
  return fetch(new Request(apiUrl, request))
}
