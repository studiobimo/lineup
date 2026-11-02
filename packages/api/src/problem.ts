import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Problem } from 'lineup-contract'

export interface ApiEnv {
  Variables: { requestId: string }
}

type ProblemFields = Pick<Problem, 'code' | 'title' | 'errors'> & { status: ContentfulStatusCode }

/** Thrown from anywhere below a route, so that one place turns failures into responses. */
export class ProblemError extends Error {
  readonly fields: ProblemFields

  constructor(fields: ProblemFields) {
    super(fields.code)
    this.name = 'ProblemError'
    this.fields = fields
  }
}

export function problem(c: Context<ApiEnv>, { status, code, title, errors }: ProblemFields) {
  const body: Problem = {
    type: `https://lineup.bimo.dev/problems/${code}`,
    title,
    status,
    code,
    requestId: c.get('requestId'),
    errors
  }
  return c.body(JSON.stringify(body), status, { 'Content-Type': 'application/problem+json' })
}
