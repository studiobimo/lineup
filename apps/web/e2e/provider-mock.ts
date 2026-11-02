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
  /** Answers requests to a path ending like this with a problem, until it is taken out. */
  failures: Map<string, { status: number; code: string; detail?: string; once?: boolean }>
  /** Every request, in order, as `METHOD /path`. */
  requests: string[]
  bodies: Record<string, unknown>[]
  headers: Record<string, string>[]
}

const LAST4 = 'abcd'
const DAY_MS = 86_400_000

const problem = (route: Route, status: number, code: string, extra: object = {}) =>
  route.fulfill({
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: code, status, code, requestId: 'test', ...extra }
  })

/** The Worker's provider routes, held in memory, so a test never reaches a real provider. */
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
  const status = () => ({
    last4: LAST4,
    expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString()
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
      const { origin } = new URL(request.url())
      return route.fulfill({
        status: 201,
        json: {
          uploadUrl: `${origin}/mock-upload/${state.requests.length}`,
          mediaUrl: `https://media.example.com/${state.requests.length}.jpg`
        }
      })
    }
    if (path === '/scheduled-posts') {
      if (method === 'GET') return route.fulfill({ json: { items: state.scheduled } })
      const post = {
        id: `post-${state.scheduled.length + 1}`,
        status: 'scheduled',
        scheduledFor: body.scheduledFor,
        timeZone: body.timeZone,
        caption: body.caption
      }
      state.scheduled.push(post)
      return route.fulfill({ status: 201, json: post })
    }
    const id = path.split('/').pop()
    const index = state.scheduled.findIndex((post) => post.id === id)
    if (method === 'DELETE') {
      if (index >= 0) state.scheduled.splice(index, 1)
      return route.fulfill({ status: 204 })
    }
    state.scheduled[index] = { ...state.scheduled[index], ...body }
    return route.fulfill({ json: state.scheduled[index] })
  })

  // The presigned host in production, on this origin here so the policy has no reason to differ.
  await page.route('**/mock-upload/**', (route) => {
    state.requests.push(`PUT ${new URL(route.request().url()).pathname}`)
    state.bodies.push({})
    state.headers.push(route.request().headers())
    return route.fulfill({ status: 200 })
  })

  return state
}
