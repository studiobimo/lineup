import { problemSchema } from 'lineup-contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApi } from '../app'
import { type Provider, ProviderError } from './provider'

const KEY = 'sk_pasted_full_key_abcd'
const NARROW = 'zrk_narrow_key_wxyz'
const ORIGIN = 'http://localhost'
const PATH = '/api/v1/provider'
const later = () => new Date(Date.now() + 3_600_000).toISOString()
const newPost = () => ({
  accountId: 'account',
  caption: 'Hello',
  scheduledFor: later(),
  timeZone: 'Europe/Madrid',
  mediaUrls: ['https://media.example.com/a.jpg']
})

function stubProvider(): Provider {
  return {
    profiles: vi.fn(async () => [{ id: 'profile', name: 'Main' }]),
    narrowed: vi.fn(async () => NARROW),
    canPost: vi.fn(async () => true),
    accounts: vi.fn(async () => [{ id: 'account', username: 'me', needsReconnection: false }]),
    connectUrl: vi.fn(async () => 'https://zernio.com/connect'),
    publishedPosts: vi.fn(async () => [{ id: 'live' }]),
    upload: vi.fn(async () => ({
      uploadUrl: 'https://upload.example.com/a',
      mediaUrl: 'https://media.example.com/a.jpg'
    })),
    scheduledPosts: vi.fn(async () => [{ id: 'post', status: 'scheduled' as const }]),
    schedule: vi.fn(async () => ({ id: 'post', status: 'scheduled' as const })),
    update: vi.fn(async () => ({ id: 'post', status: 'scheduled' as const })),
    cancel: vi.fn(async () => undefined)
  }
}

describe('provider routes', () => {
  let provider: ReturnType<typeof stubProvider>
  let providerFor: ReturnType<typeof vi.fn<(key: string) => Provider>>
  let limit: ReturnType<typeof vi.fn>
  let env: Record<string, unknown>
  let log: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    provider = stubProvider()
    providerFor = vi.fn(() => provider)
    limit = vi.fn(async () => ({ success: true }))
    env = {
      PROVIDER_KEY_SECRET_V1: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),
      KEY_RATE_LIMIT: { limit }
    }
    log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => vi.restoreAllMocks())

  const send = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (init.method && !headers.has('Origin')) headers.set('Origin', ORIGIN)
    if (init.body) headers.set('Content-Type', 'application/json')
    return createApi(providerFor).request(`${PATH}${path}`, { ...init, headers }, env)
  }

  const putKey = (body: object = { key: KEY }) =>
    send('/key', { method: 'PUT', body: JSON.stringify(body) })

  async function signedIn() {
    const cookie = (await putKey()).headers.get('Set-Cookie') ?? ''
    return { Cookie: cookie.split(';')[0] }
  }

  const code = async (response: Response) => problemSchema.parse(await response.clone().json()).code

  describe('the key', () => {
    it('narrows the key, seals it, and answers with its last four characters', async () => {
      const response = await putKey()
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ last4: 'abcd' })
      expect(provider.narrowed).toHaveBeenCalledWith('profile', 30)
    })

    it('sets a cookie no script can read and no other subdomain can see', async () => {
      const cookie = (await putKey()).headers.get('Set-Cookie') ?? ''
      expect(cookie).toMatch(/^__Host-provider-key=/)
      expect(cookie).toMatch(/HttpOnly/)
      expect(cookie).toMatch(/Secure/)
      expect(cookie).toMatch(/SameSite=Strict/)
      expect(cookie).toMatch(/Path=\//)
      expect(cookie).not.toMatch(/Domain=/)
      expect(cookie).toMatch(/Max-Age=2592000/)
    })

    it('keeps the key out of every response, cookie and log line', async () => {
      const put = await putKey()
      const headers = { Cookie: (put.headers.get('Set-Cookie') ?? '').split(';')[0] }
      const got = await send('/key', { headers })
      const everything = [
        await put.text(),
        await got.text(),
        JSON.stringify([...put.headers]),
        JSON.stringify([...got.headers]),
        JSON.stringify(log.mock.calls)
      ].join()
      for (const secret of [KEY, NARROW]) expect(everything).not.toContain(secret)
    })

    it('uses the narrow key from then on, not the pasted one', async () => {
      const headers = await signedIn()
      await send('/accounts', { headers })
      expect(providerFor).toHaveBeenLastCalledWith(NARROW)
    })

    it('says what the key can do, and asks it of the key that will be used', async () => {
      vi.mocked(provider.canPost).mockResolvedValue(false)
      const saved = await putKey()
      expect(await saved.clone().json()).toMatchObject({ canPost: false })
      expect(providerFor).toHaveBeenLastCalledWith(NARROW)

      const cookie = saved.headers.get('Set-Cookie') ?? ''
      const read = await send('/key', { headers: { Cookie: cookie.split(';')[0] } })
      expect(await read.json()).toMatchObject({ canPost: false })
    })

    it('seals the key as given when it cannot be narrowed', async () => {
      vi.mocked(provider.narrowed).mockResolvedValue(undefined)
      const headers = await signedIn()
      await send('/accounts', { headers })
      expect(providerFor).toHaveBeenLastCalledWith(KEY)
    })

    it('asks which profile for a key that sees several, then takes the answer', async () => {
      vi.mocked(provider.profiles).mockResolvedValue([
        { id: 'one', name: 'One' },
        { id: 'two', name: 'Two' }
      ])
      const asked = await putKey()
      expect(asked.status).toBe(409)
      expect(asked.headers.get('Set-Cookie')).toBeNull()
      const body = problemSchema.parse(await asked.json())
      expect(body).toMatchObject({ code: 'profile_required' })
      expect(body.profiles).toHaveLength(2)

      expect((await putKey({ key: KEY, profileId: 'two' })).status).toBe(200)
      expect(provider.narrowed).toHaveBeenCalledWith('two', 30)
    })

    it('rejects a key the provider refuses, and keeps nothing', async () => {
      vi.mocked(provider.profiles).mockRejectedValue(new ProviderError('key'))
      const response = await putKey()
      expect(response.status).toBe(401)
      expect(await code(response)).toBe('key_rejected')
      expect(response.headers.get('Set-Cookie')).toBeNull()
    })

    it('limits how often a key can be tried, by address', async () => {
      limit.mockResolvedValue({ success: false })
      const response = await send('/key', {
        method: 'PUT',
        body: JSON.stringify({ key: KEY }),
        headers: { 'cf-connecting-ip': '203.0.113.9' }
      })
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('60')
      expect(limit).toHaveBeenCalledWith({ key: '203.0.113.9' })
      expect(provider.profiles).not.toHaveBeenCalled()
    })

    it('reports the key that is there, and 404 when there is none', async () => {
      const headers = await signedIn()
      expect(await (await send('/key', { headers })).json()).toMatchObject({ last4: 'abcd' })
      expect((await send('/key')).status).toBe(404)
    })

    it('clears the cookie when the key is forgotten', async () => {
      const response = await send('/key', { method: 'DELETE' })
      expect(response.status).toBe(204)
      expect(response.headers.get('Set-Cookie')).toMatch(/Max-Age=0/)
    })

    it('refuses an altered cookie', async () => {
      const { Cookie } = await signedIn()
      providerFor.mockClear()
      const altered = `${Cookie.slice(0, -2)}${Cookie.endsWith('AA') ? 'BB' : 'AA'}`
      const response = await send('/accounts', { headers: { Cookie: altered } })
      expect(response.status).toBe(401)
      expect(await code(response)).toBe('key_missing')
      expect(providerFor).not.toHaveBeenCalled()
    })

    it('refuses an expired key', async () => {
      const { Cookie } = await signedIn()
      vi.useFakeTimers({ now: Date.now() + 31 * 86_400_000 })
      try {
        expect((await send('/accounts', { headers: { Cookie } })).status).toBe(401)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('requests from elsewhere', () => {
    it.each(['https://evil.example', undefined])('refuses origin %s', async (origin) => {
      const headers = new Headers(origin ? { Origin: origin } : {})
      const app = createApi(providerFor)
      const response = await app.request(`${PATH}/key`, { method: 'DELETE', headers }, env)
      expect(response.status).toBe(403)
      expect(await code(response)).toBe('origin')
    })
  })

  describe('with a key', () => {
    it('needs one for every route', async () => {
      const routes: [string, RequestInit?][] = [
        ['/accounts'],
        ['/connect-url'],
        ['/accounts/account/posts'],
        ['/scheduled-posts?accountId=account'],
        ['/scheduled-posts/post', { method: 'DELETE' }]
      ]
      for (const [path, init] of routes) {
        expect((await send(path, init)).status).toBe(401)
      }
    })

    it('lists the accounts of the profile the key was narrowed to', async () => {
      const headers = await signedIn()
      const response = await send('/accounts', { headers })
      expect(await response.json()).toEqual({
        items: [{ id: 'account', username: 'me', needsReconnection: false }]
      })
      expect(provider.accounts).toHaveBeenCalledWith('profile')
    })

    it('sends the user back here after connecting an account', async () => {
      const headers = await signedIn()
      await send('/connect-url', { headers })
      expect(provider.connectUrl).toHaveBeenCalledWith('profile', `${ORIGIN}/`)
    })

    it('lists what is already live', async () => {
      const headers = await signedIn()
      const response = await send('/accounts/account/posts', { headers })
      expect(await response.json()).toEqual({ items: [{ id: 'live' }] })
      expect(provider.publishedPosts).toHaveBeenCalledWith('account')
    })

    it('gets an upload URL, and refuses a type Instagram would not take', async () => {
      const headers = await signedIn()
      const upload = (contentType: string) =>
        send('/uploads', {
          method: 'POST',
          headers,
          body: JSON.stringify({ fileName: 'a.jpg', contentType, size: 10 })
        })
      expect((await upload('image/jpeg')).status).toBe(201)
      expect((await upload('text/html')).status).toBe(400)
    })

    it('schedules with the idempotency key it was given', async () => {
      const headers = { ...(await signedIn()), 'Idempotency-Key': 'once' }
      const post = newPost()
      const response = await send('/scheduled-posts', {
        method: 'POST',
        headers,
        body: JSON.stringify(post)
      })
      expect(response.status).toBe(201)
      expect(provider.schedule).toHaveBeenCalledWith(post, 'once')
    })

    it('refuses to schedule without an idempotency key', async () => {
      const headers = await signedIn()
      const response = await send('/scheduled-posts', {
        method: 'POST',
        headers,
        body: JSON.stringify(newPost())
      })
      expect(await code(response)).toBe('idempotency_required')
      expect(provider.schedule).not.toHaveBeenCalled()
    })

    it('refuses a time in the past, which the provider would publish at once', async () => {
      const headers = { ...(await signedIn()), 'Idempotency-Key': 'once' }
      const past = new Date(Date.now() - 1000).toISOString()
      const scheduled = await send('/scheduled-posts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...newPost(), scheduledFor: past })
      })
      expect(scheduled.status).toBe(422)
      expect(await code(scheduled)).toBe('time_in_past')
      expect(provider.schedule).not.toHaveBeenCalled()

      const moved = await send('/scheduled-posts/post', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ scheduledFor: past, timeZone: 'UTC' })
      })
      expect(moved.status).toBe(422)
      expect(provider.update).not.toHaveBeenCalled()
    })

    it('needs an account to list scheduled posts, and reschedules and cancels', async () => {
      const headers = await signedIn()
      expect((await send('/scheduled-posts', { headers })).status).toBe(400)
      const listed = await send('/scheduled-posts?accountId=account', { headers })
      expect(await listed.json()).toMatchObject({ items: [{ id: 'post' }] })

      const changes = { scheduledFor: later(), timeZone: 'UTC' }
      await send('/scheduled-posts/post', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(changes)
      })
      expect(provider.update).toHaveBeenCalledWith('post', changes)

      const cancelled = await send('/scheduled-posts/post', { method: 'DELETE', headers })
      expect(cancelled.status).toBe(204)
      expect(provider.cancel).toHaveBeenCalledWith('post')
    })

    it('answers bad input with the fields that are wrong', async () => {
      const headers = { ...(await signedIn()), 'Idempotency-Key': 'once' }
      const response = await send('/scheduled-posts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...newPost(), mediaUrls: [] })
      })
      expect(response.status).toBe(400)
      const { errors } = problemSchema.parse(await response.json())
      expect(errors?.map(({ path }) => path)).toEqual(['mediaUrls'])
    })
  })

  describe('when the provider fails', () => {
    it.each([
      ['key', 401, 'key_rejected'],
      ['forbidden', 403, 'key_not_allowed'],
      ['missing', 404, 'not_found'],
      ['limited', 429, 'rate_limited'],
      ['refused', 422, 'provider_refused'],
      ['busy', 409, 'provider_busy'],
      ['down', 502, 'provider_failed']
    ] as const)('turns %s into %i %s', async (failure, status, expected) => {
      const headers = await signedIn()
      vi.mocked(provider.accounts).mockRejectedValue(new ProviderError(failure))
      const response = await send('/accounts', { headers })
      expect(response.status).toBe(status)
      expect(await code(response)).toBe(expected)
    })

    it('passes on a refusal in the provider’s words, and nothing else of theirs', async () => {
      const headers = await signedIn()
      const refused = new ProviderError('refused', { detail: 'Caption too long' })
      vi.mocked(provider.accounts).mockRejectedValueOnce(refused)
      const shown = problemSchema.parse(await (await send('/accounts', { headers })).json())
      expect(shown.detail).toBe('Caption too long')

      const down = new ProviderError('down', { detail: 'stack trace at db-01' })
      vi.mocked(provider.accounts).mockRejectedValueOnce(down)
      const hidden = await (await send('/accounts', { headers })).text()
      expect(hidden).not.toContain('db-01')
    })

    it('passes on how long to wait', async () => {
      const headers = await signedIn()
      const limited = new ProviderError('limited', { retryAfter: 30 })
      vi.mocked(provider.accounts).mockRejectedValue(limited)
      const response = await send('/accounts', { headers })
      expect(response.headers.get('Retry-After')).toBe('30')
    })
  })
})
