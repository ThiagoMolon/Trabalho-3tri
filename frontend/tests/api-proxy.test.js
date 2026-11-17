import assert from 'node:assert/strict'
import { test } from 'node:test'
import { onRequest } from '../functions/_middleware.js'

test('proxies API requests to the configured origin with cookies and query string', async () => {
  const originalFetch = globalThis.fetch
  let forwardedRequest
  globalThis.fetch = async (request) => {
    forwardedRequest = request
    return new Response('proxied')
  }

  try {
    const response = await onRequest({
      request: new Request('https://originbeans.shop/auth/me?from=login', {
        headers: { cookie: 'origin_beans_session=test-token' },
      }),
      env: { API_ORIGIN: 'https://api.example.test/' },
      next: () => {
        throw new Error('API requests should not use the static-asset fallback.')
      },
    })

    assert.equal(forwardedRequest.url, 'https://api.example.test/auth/me?from=login')
    assert.equal(forwardedRequest.headers.get('cookie'), 'origin_beans_session=test-token')
    assert.equal(await response.text(), 'proxied')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('leaves the customer quiz page to the static frontend', async () => {
  const response = new Response('static page')
  let fallbackCalled = false

  const result = await onRequest({
    request: new Request('https://originbeans.shop/quiz'),
    next: async () => {
      fallbackCalled = true
      return response
    },
  })

  assert.equal(fallbackCalled, true)
  assert.equal(result, response)
})

test('proxies transactional commerce endpoints to the API', async () => {
  const originalFetch = globalThis.fetch
  const forwardedUrls = []
  globalThis.fetch = async (request) => {
    forwardedUrls.push(request.url)
    return new Response('proxied')
  }

  try {
    for (const path of [
      '/addresses',
      '/shipping/calculate',
      '/orders',
      '/orders/me',
      '/subscriptions/me',
      '/webhooks/mercadopago?data.id=123&type=payment',
    ]) {
      await onRequest({
        request: new Request(`https://originbeans.shop${path}`, {
          method: path.includes('calculate') || path.startsWith('/webhooks/') ? 'POST' : 'GET',
        }),
        env: { API_ORIGIN: 'https://api.example.test' },
        next: () => { throw new Error(`${path} should be proxied to the API`) },
      })
    }

    assert.deepEqual(forwardedUrls, [
      'https://api.example.test/addresses',
      'https://api.example.test/shipping/calculate',
      'https://api.example.test/orders',
      'https://api.example.test/orders/me',
      'https://api.example.test/subscriptions/me',
      'https://api.example.test/webhooks/mercadopago?data.id=123&type=payment',
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})
