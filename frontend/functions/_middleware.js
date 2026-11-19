const defaultApiOrigin = 'https://trabalho-3tri.onrender.com'
const defaultAdminApiOrigin = 'https://trabalho-3tri.origin-beans01.workers.dev'
const apiPathPrefixes = [
  '/auth/',
  '/vitrine/',
  '/produtos/',
  '/quiz/',
  '/planos/',
  '/assinaturas/',
  '/subscriptions/',
  '/customers/',
  '/payments/',
  '/products/',
  '/data/',
  '/addresses/',
  '/shipping/',
  '/orders/',
  '/webhooks/',
]
const adminApiPathPrefixes = ['/payments', '/products', '/data','/customers']

export async function onRequest({ request, env = {}, next }) {
  const url = new URL(request.url)
  const isAdminApiRequest = adminApiPathPrefixes.some((prefix) => (
    url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  ))
  const isApiRequest = url.pathname === '/health'
  
    || url.pathname === '/produtos'
    || url.pathname === '/planos'
    || url.pathname === '/assinaturas'
    || url.pathname === '/subscriptions'
    || url.pathname === '/customers'
    || url.pathname === '/payments'
    || url.pathname === '/products'
    || url.pathname === '/addresses'
    || url.pathname === '/orders'
    || apiPathPrefixes.some((prefix) => url.pathname.startsWith(prefix))

  if (!isApiRequest) return next()

  const apiOrigin = (
    isAdminApiRequest
      ? env.ADMIN_API_ORIGIN || defaultAdminApiOrigin
      : env.API_ORIGIN || defaultApiOrigin
  ).replace(/\/+$/, '')
  const apiUrl = `${apiOrigin}${url.pathname}${url.search}`
  return fetch(new Request(apiUrl, request))
}
