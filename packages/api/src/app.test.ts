import { Hono } from 'hono'
import { problemSchema } from 'lineup-contract'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApi } from './app'
import type { ApiEnv } from './problem'

const api = createApi()

afterEach(() => vi.restoreAllMocks())

describe('the api', () => {
  it('answers /api/health outside any version', async () => {
    const response = await api.request('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('marks every response with its request id, and stores none of them', async () => {
    const response = await api.request('/api/health')
    expect(response.headers.get('X-Request-Id')).toMatch(/^[\da-f-]{36}$/)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'")
  })

  it('takes no request id from the caller', async () => {
    const response = await api.request('/api/health', { headers: { 'X-Request-Id': 'forged' } })
    expect(response.headers.get('X-Request-Id')).not.toBe('forged')
  })

  it('answers an unknown path with a problem, never with the web app', async () => {
    const response = await api.request('/api/v1/nothing-here')
    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toBe('application/problem+json')
    const body = problemSchema.parse(await response.json())
    expect(body).toMatchObject({ code: 'not_found', status: 404 })
    expect(body.requestId).toBe(response.headers.get('X-Request-Id'))
  })

  it('logs the path template and nothing that came with the request', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await api.request('/api/health?key=sk_secret', { headers: { Cookie: 'a=sk_secret' } })
    const [line] = log.mock.calls[0] as [string]
    expect(JSON.parse(line)).toMatchObject({ method: 'GET', path: '/api/health', status: 200 })
    expect(line).not.toContain('sk_secret')
  })

  it('hides what went wrong, and logs only its name', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const failing = new Hono<ApiEnv>()
    failing.get('/boom', () => {
      throw new TypeError('sk_secret was refused')
    })
    const app = createApi().route('/', failing)

    const response = await app.request('/api/boom')
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('sk_secret')
    expect(JSON.stringify(error.mock.calls)).not.toContain('sk_secret')
  })
})
