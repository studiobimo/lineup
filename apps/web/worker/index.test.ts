import { afterAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import app from './index'

// wrangler.jsonc's bindings and .dev.vars, run locally as vite dev runs them.
const platform = await getPlatformProxy<Env>()
afterAll(() => platform.dispose())

describe('worker', () => {
  it('answers /api/health', async () => {
    const response = await app.request('/api/health', {}, platform.env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('answers an unknown /api path with a JSON 404', async () => {
    const response = await app.request('/api/nothing-here', {}, platform.env)
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'not_found', status: 404 })
  })
})
