import { z } from 'zod'

/** Stable, so a client may branch on them. See docs/API.md. */
export const problemCodes = ['not_found', 'validation', 'internal'] as const

/** One shape for every error: RFC 9457 problem details, as docs/API.md describes. */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.enum(problemCodes),
  requestId: z.string(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional()
})

export type Problem = z.infer<typeof problemSchema>
export type ProblemCode = Problem['code']
