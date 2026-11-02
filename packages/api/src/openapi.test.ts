import { generateSpecs } from 'hono-openapi'
import { describe, expect, it } from 'vitest'

import { createApi } from './app'

const DOCUMENT = '../../../apps/web/public/api-docs/openapi.json'

const api = createApi()

const document = await generateSpecs(api, {
  documentation: {
    info: {
      title: 'Lineup API',
      version: '1',
      description: 'The conventions are in docs/API.md. Every failure is a problem+json document.'
    },
    components: {
      securitySchemes: {
        providerKey: { type: 'apiKey', in: 'cookie', name: '__Host-provider-key' }
      }
    }
  }
})

describe('the API reference', () => {
  it('is what the routes say, so that it can never disagree with them', async () => {
    await expect(`${JSON.stringify(document, null, 2)}\n`).toMatchFileSnapshot(DOCUMENT)
  })

  it('describes every route', () => {
    const routes = api.routes.filter(({ method }) => method !== 'ALL')
    expect(routes.length).toBeGreaterThan(0)
    for (const { method, path } of routes) {
      const template = path.replace(/:(\w+)/g, '{$1}')
      const operation = document.paths?.[template]?.[method.toLowerCase() as 'get']
      expect(operation?.description, `${method} ${path}`).toBeTruthy()
    }
  })
})
