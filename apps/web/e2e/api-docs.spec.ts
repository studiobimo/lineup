import { expect, test } from '@playwright/test'

test('the API reference is served, with a policy of its own', async ({ request }) => {
  const document = await request.get('/api-docs/openapi.json')
  expect(document.ok()).toBe(true)
  expect(await document.json()).toMatchObject({ openapi: '3.1.0', info: { title: 'Lineup API' } })

  const page = await request.get('/api-docs/index.html')
  expect(page.ok()).toBe(true)
  const policy = page.headers()['content-security-policy']
  expect(policy).toContain('https://cdn.jsdelivr.net')
  expect(policy).not.toContain("img-src 'self' https://media.zernio.com")
})
