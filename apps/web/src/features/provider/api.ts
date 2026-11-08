import { hc } from 'hono/client'
import type { ApiRoutes } from 'lineup-api'
import { type Problem, problemSchema } from 'lineup-contract'

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

export const worthRetrying = (failures: number, error: Error) => {
  const status = error instanceof ProviderRequestError ? error.problem?.status : undefined
  return failures < 2 && (status === undefined || status >= 500)
}
