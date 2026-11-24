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
  // ~keep The anonymous publish-delay events the app sent (ADR-0026)
  telemetry: Record<string, unknown>[]
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

interface Mock {
  state: MockProvider
  session: { hasKey: boolean }
  answered: Map<string, object>
}

interface Call {
  route: Route
  method: string
  path: string
  body: Record<string, unknown>
  headers: Record<string, string>
  origin: string
}

const keyStatus = ({ state }: Mock) => ({
  last4: LAST4,
  expiresAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
  canPost: !state.readOnly
})

function failureFor({ route, path }: Call, { state }: Mock) {
  const failure = [...state.failures].find(([end]) => path.endsWith(end))
  if (!failure) return undefined
  const { status: code, once, ...rest } = failure[1]
  if (once) state.failures.delete(failure[0])
  return problem(route, code, rest.code, rest)
}

function keyRoute(call: Call, mock: Mock) {
  const { route, method, body } = call
  if (method === 'PUT') {
    if (String(body.key).includes('bad')) return problem(route, 401, 'key_rejected')
    if (mock.state.profiles && !body.profileId) {
      return problem(route, 409, 'profile_required', { profiles: mock.state.profiles })
    }
    mock.session.hasKey = true
    return route.fulfill({ json: keyStatus(mock) })
  }
  if (method === 'DELETE') {
    mock.session.hasKey = false
    return route.fulfill({ status: 204 })
  }
  if (mock.session.hasKey) return route.fulfill({ json: keyStatus(mock) })
  return problem(route, 404, 'not_found')
}

function uploadRoute({ route }: Call, { state }: Mock) {
  return route.fulfill({
    status: 201,
    json: {
      uploadUrl: `https://lineup-test.r2.cloudflarestorage.com/${state.requests.length}`,
      mediaUrl: `https://media.example.com/${state.requests.length}.jpg`
    }
  })
}

function scheduleRoute({ route, method, body, headers }: Call, { state, answered }: Mock) {
  if (method === 'GET') return route.fulfill({ json: { items: state.scheduled } })
  const key = headers['idempotency-key']
  const original = answered.get(key)
  if (original) return route.fulfill({ status: 201, json: original })
  const post = {
    id: `post-${state.scheduled.length + 1}`,
    status: 'scheduled',
    scheduledFor: body.scheduledFor,
    timeZone: body.timeZone,
    caption: body.caption,
    collaborators: body.collaborators
  }
  state.scheduled.push(post)
  answered.set(key, post)
  if (state.loseNextAnswer) {
    state.loseNextAnswer = false
    return route.abort()
  }
  return route.fulfill({ status: 201, json: post })
}

function scheduledPostRoute({ route, method, path, body }: Call, { state }: Mock) {
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
}

function answer(call: Call, mock: Mock) {
  const { route, path, origin } = call
  const failure = failureFor(call, mock)
  if (failure) return failure
  if (path === '/key') return keyRoute(call, mock)
  if (path === '/accounts') return route.fulfill({ json: { items: mock.state.accounts } })
  if (path === '/connect-url') return route.fulfill({ json: { url: `${origin}/connected` } })
  if (path.endsWith('/posts')) return route.fulfill({ json: { items: mock.state.published } })
  if (path === '/uploads') return uploadRoute(call, mock)
  if (path === '/scheduled-posts') return scheduleRoute(call, mock)
  return scheduledPostRoute(call, mock)
}

function callOf(route: Route, { state }: Mock): Call {
  const request = route.request()
  const url = new URL(request.url())
  const call = {
    route,
    method: request.method(),
    path: url.pathname.replace('/api/v1/provider', ''),
    body: (request.postDataJSON() ?? {}) as Record<string, unknown>,
    headers: request.headers(),
    origin: url.origin
  }
  state.requests.push(`${call.method} ${call.path}`)
  state.bodies.push(call.body)
  state.headers.push(call.headers)
  return call
}

function storageRoute(route: Route, { state }: Mock) {
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
}

export async function mockProvider(page: Page, seed: Partial<MockProvider> = {}) {
  const state: MockProvider = {
    accounts: [{ id: 'account-1', username: 'studio' }],
    published: [],
    scheduled: [],
    failures: new Map(),
    requests: [],
    bodies: [],
    headers: [],
    telemetry: [],
    ...seed
  }
  const mock: Mock = { state, session: { hasKey: false }, answered: new Map() }
  await page.route('**/api/v1/provider/**', (route) => answer(callOf(route, mock), mock))
  await page.route('**/api/v1/telemetry/publish-delay', (route) => {
    state.telemetry.push(route.request().postDataJSON() as Record<string, unknown>)
    return route.fulfill({ status: 204 })
  })
  await page.route('https://*.r2.cloudflarestorage.com/**', (route) => storageRoute(route, mock))
  return state
}
