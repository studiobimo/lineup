import { hc } from 'hono/client'
import type { ApiRoutes } from 'lineup-api'
import { type Problem, problemSchema } from 'lineup-contract'

/** A refused request has a problem to read. One that never arrived has none: it is offline. */
export class ProviderRequestError extends Error {
  readonly problem?: Problem

  constructor(problem?: Problem) {
    super(problem?.code ?? 'offline')
    this.name = 'ProviderRequestError'
    this.problem = problem
  }
}

export const providerApi = hc<ApiRoutes>('/').api.v1.provider

interface Answer<Body> {
  ok: boolean
  status: number
  json(): Promise<Body>
}

const NO_CONTENT = 204

/** The body of what came back, or the failure as a ProviderRequestError. */
export async function answer<Body>(request: Promise<Answer<Body>>) {
  const response = await request.catch(() => {
    throw new ProviderRequestError()
  })
  if (response.ok) {
    return response.status === NO_CONTENT ? (undefined as Body) : response.json()
  }
  const { data } = problemSchema.safeParse(await response.json().catch(() => undefined))
  throw new ProviderRequestError(data)
}

/** The same request again helps only when it never arrived or the provider had a bad moment. */
export const worthRetrying = (failures: number, error: Error) => {
  const status = error instanceof ProviderRequestError ? error.problem?.status : undefined
  return failures < 2 && (status === undefined || status >= 500)
}
