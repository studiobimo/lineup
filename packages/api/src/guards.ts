import { createMiddleware } from 'hono/factory'
import { validator } from 'hono-openapi'
import type { Problem } from 'lineup-contract'
import type { z } from 'zod'

import { type ApiEnv, ProblemError } from './problem'

const invalid = (errors: Problem['errors']) =>
  new ProblemError({ status: 400, code: 'validation', title: 'The request is not valid', errors })

type Segment = PropertyKey | { key: PropertyKey }

const pathOf = (path: readonly Segment[] = []) =>
  path.map((part) => String(typeof part === 'object' ? part.key : part)).join('.')

export const valid = <Target extends 'json' | 'query', Schema extends z.ZodType>(
  target: Target,
  schema: Schema
) =>
  validator(target, schema, (result) => {
    if (result.success) return
    throw invalid(result.error.map(({ path, message }) => ({ path: pathOf(path), message })))
  })

export const sameOrigin = createMiddleware<ApiEnv>(async (c, next) => {
  const reading = c.req.method === 'GET' || c.req.method === 'HEAD'
  if (!reading && c.req.header('Origin') !== new URL(c.req.url).origin) {
    throw new ProblemError({
      status: 403,
      code: 'origin',
      title: 'This request came from another site'
    })
  }
  await next()
})

export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

const LIMIT_PERIOD_SECONDS = 60

export async function allowTry(limiter: Limiter, caller: string) {
  if ((await limiter.limit({ key: caller })).success) return
  throw new ProblemError({
    status: 429,
    code: 'rate_limited',
    title: 'Too many tries. Wait a minute',
    retryAfter: LIMIT_PERIOD_SECONDS
  })
}
