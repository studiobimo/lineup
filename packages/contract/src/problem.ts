import { z } from 'zod'

import { profileSchema } from './provider'

/** Stable, so a client may branch on them. See docs/API.md. */
export const problemCodes = [
  'not_found',
  'validation',
  'internal',
  'origin',
  'rate_limited',
  'key_missing',
  'key_rejected',
  'key_not_allowed',
  'profile_required',
  'idempotency_required',
  'time_in_past',
  'provider_refused',
  'provider_busy',
  'provider_failed'
] as const

/** One shape for every error: RFC 9457 problem details, as docs/API.md describes. */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.enum(problemCodes),
  requestId: z.string(),
  /** In the provider's words, for a refusal that a person has to act on. */
  detail: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  /** What to choose from, with `profile_required`. */
  profiles: z.array(profileSchema).optional()
})

export type Problem = z.infer<typeof problemSchema>
export type ProblemCode = Problem['code']
