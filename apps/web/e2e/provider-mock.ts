import type { Page, Route } from '@playwright/test'

interface MockAccount {
  id: string
  username: string
  displayName?: string
  followers?: number
  needsReconnection?: boolean
  avatarUrl?: string
}

export interface MockProvider {
  accounts: MockAccount[]
  profiles?: { id: string; name: string }[]
  published: object[]
  scheduled: Record<string, unknown>[]
  failures: Map<string, { status: number; code: string; detail?: string; once?: boolean }>
  requests: string[]
  bodies: Record<string, unknown>[]
  headers: Record<string, string>[]
  loseNextAnswer?: boolean
  readOnly?: boolean
  storageFails?: boolean
}

const LAST4 = 'abcd'
const DAY_MS = 86_400_000

const problem = (route: Route, status: number, code: string, extra: object = {}) =>
  route.fulfill({
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: code, status, code, requestId: 'test', ...extra }
  })

export async function mockProvider(page: Page, seed: Partial<MockProvider> = {}) {
  const state: MockProvider = {
    accounts: [{ id: 'account-1', username: 'studio' }],
    published: [],
    scheduled: [],
    failures: new Map(),
    requests: [],
    bodies: [],
    headers: [],
    ...seed
  }
  let hasKey = false
  const answered = new Map<string, object>()
  const status = () => ({
    last4: LAST4,
    expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    canPost: !state.readOnly
  })

  await page.route('**/api/v1/provider/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname.replace('/api/v1/provider', '')
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>
    state.requests.push(`${method} ${path}`)
    state.bodies.push(body)
    state.headers.push(request.headers())

    const failure = [...state.failures].find(([end]) => path.endsWith(end))
    if (failure) {
      const { status: code, once, ...rest } = failure[1]
      if (once) state.failures.delete(failure[0])
      return problem(route, code, rest.code, rest)
    }

    if (path === '/key') {
      if (method === 'PUT') {
        if (String(body.key).includes('bad')) return problem(route, 401, 'key_rejected')
        if (state.profiles && !body.profileId) {
          return problem(route, 409, 'profile_required', { profiles: state.profiles })
        }
        hasKey = true
        return route.fulfill({ json: status() })
      }
      if (method === 'DELETE') {
        hasKey = false
        return route.fulfill({ status: 204 })
      }
      return hasKey ? route.fulfill({ json: status() }) : problem(route, 404, 'not_found')
    }
    if (path === '/accounts') return route.fulfill({ json: { items: state.accounts } })
    if (path === '/connect-url') {
      return route.fulfill({ json: { url: `${new URL(request.url()).origin}/connected` } })
    }
    if (path.endsWith('/posts')) return route.fulfill({ json: { items: state.published } })
    if (path === '/uploads') {
      return route.fulfill({
        status: 201,
        json: {
          uploadUrl: `https://lineup-test.r2.cloudflarestorage.com/${state.requests.length}`,
          mediaUrl: `https://media.example.com/${state.requests.length}.jpg`
        }
      })
    }
    if (path === '/scheduled-posts') {
      if (method === 'GET') return route.fulfill({ json: { items: state.scheduled } })
      const key = request.headers()['idempotency-key']
      const original = answered.get(key)
      if (original) return route.fulfill({ status: 201, json: original })
      const post = {
        id: `post-${state.scheduled.length + 1}`,
        status: 'scheduled',
        scheduledFor: body.scheduledFor,
        timeZone: body.timeZone,
        caption: body.caption
      }
      state.scheduled.push(post)
      answered.set(key, post)
      if (state.loseNextAnswer) {
        state.loseNextAnswer = false
        return route.abort()
      }
      return route.fulfill({ status: 201, json: post })
    }
    const id = path.split('/').pop()
    const index = state.scheduled.findIndex((post) => post.id === id)
    if (method === 'DELETE') {
      if (index >= 0) state.scheduled.splice(index, 1)
      return route.fulfill({ status: 204 })
    }
    state.scheduled[index] = {
      ...state.scheduled[index],
      ...body,
      status: 'scheduled',
      failure: undefined
    }
    return route.fulfill({ json: state.scheduled[index] })
  })

  // The real storage host, so that the content security policy is under test too.
  await page.route('https://*.r2.cloudflarestorage.com/**', (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'PUT'
    }
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    state.requests.push('PUT storage')
    state.bodies.push({})
    state.headers.push(request.headers())
    return route.fulfill({ status: state.storageFails ? 503 : 200, headers })
  })

  return state
}
