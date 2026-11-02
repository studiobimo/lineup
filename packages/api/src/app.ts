import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { routePath } from 'hono/route'
import { secureHeaders } from 'hono/secure-headers'

import { type ApiEnv, problem, ProblemError } from './problem'
import { ProviderError, type ProviderFailure, type ProviderFor } from './provider/provider'
import { providerRoutes } from './provider/routes'
import { zernio } from './provider/zernio'
import { documented } from './route-docs'

// JSON loads nothing, so this asks for less than the app's own policy in public/_headers.
const contentSecurityPolicy = { defaultSrc: ["'none'"], frameAncestors: ["'none'"] }

const providerProblems = {
  key: { status: 401, code: 'key_rejected', title: 'The provider refused this key' },
  forbidden: { status: 403, code: 'key_not_allowed', title: 'This key is not allowed to do that' },
  missing: { status: 404, code: 'not_found', title: 'The provider has no such thing' },
  limited: { status: 429, code: 'rate_limited', title: 'The provider asked to slow down' },
  refused: { status: 422, code: 'provider_refused', title: 'The provider refused this' },
  busy: { status: 409, code: 'provider_busy', title: 'The provider is still on this' },
  down: { status: 502, code: 'provider_failed', title: 'The provider did not answer' }
} as const satisfies Record<ProviderFailure, object>

export function createApi(providerFor: ProviderFor = zernio) {
  const api = new Hono<ApiEnv>().basePath('/api')

  // Generated here and never read from the request, so a log line cannot be forged.
  api.use(async (c, next) => {
    const requestId = crypto.randomUUID()
    const started = Date.now()
    c.set('requestId', requestId)
    await next()
    c.header('X-Request-Id', requestId)
    c.header('Cache-Control', 'no-store')
    // The path template and nothing from the request: docs/API.md lists what a log may hold.
    console.log(
      JSON.stringify({
        method: c.req.method,
        path: routePath(c, -1),
        status: c.res.status,
        duration: Date.now() - started,
        requestId
      })
    )
  })
  api.use(secureHeaders({ contentSecurityPolicy }))

  api.get('/health', documented({ description: 'Whether the API is up', needsKey: false }), (c) =>
    c.json({ ok: true })
  )

  api.notFound((c) =>
    problem(c, { status: 404, code: 'not_found', title: 'There is nothing at this path' })
  )

  api.onError((error, c) => {
    if (error instanceof ProblemError) return problem(c, error.fields)
    if (error instanceof ProviderError) {
      const { detail, retryAfter } = error.details
      const shown = error.failure === 'refused' ? detail : undefined
      return problem(c, { ...providerProblems[error.failure], detail: shown, retryAfter })
    }
    if (error instanceof HTTPException && error.status === 400) {
      return problem(c, { status: 400, code: 'validation', title: 'The request is not valid' })
    }
    // The name alone: a message can quote what it failed on, and that can be a key.
    console.error(JSON.stringify({ requestId: c.get('requestId'), error: error.name }))
    return problem(c, { status: 500, code: 'internal', title: 'Something went wrong' })
  })

  return api.route('/v1/provider', providerRoutes(providerFor))
}

export type ApiRoutes = ReturnType<typeof createApi>
