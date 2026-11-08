import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Problem } from 'lineup-contract'

import type { ProviderBindings } from './provider/routes'

export interface ApiEnv {
  Bindings: ProviderBindings
  Variables: { requestId: string }
}

type ProblemFields = Pick<Problem, 'code' | 'title' | 'detail' | 'errors' | 'profiles'> & {
  status: ContentfulStatusCode
  retryAfter?: number
}

export class ProblemError extends Error {
  readonly fields: ProblemFields

  constructor(fields: ProblemFields) {
    super(fields.code)
    this.name = 'ProblemError'
    this.fields = fields
  }
}

export function problem(
  c: Context<ApiEnv>,
  { status, retryAfter, code, title, ...rest }: ProblemFields
) {
  const body: Problem = {
    type: `https://lineup.bimo.dev/problems/${code}`,
    title,
    status,
    code,
    requestId: c.get('requestId'),
    ...rest
  }
  if (retryAfter) c.header('Retry-After', String(retryAfter))
  return c.body(JSON.stringify(body), status, { 'Content-Type': 'application/problem+json' })
}
