import { z } from 'zod'

import { profileSchema } from './provider'

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

export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.enum(problemCodes),
  requestId: z.string(),
  detail: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  profiles: z.array(profileSchema).optional()
})

export type Problem = z.infer<typeof problemSchema>
export type ProblemCode = Problem['code']
