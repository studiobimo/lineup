import { describeRoute, resolver } from 'hono-openapi'
import { problemSchema } from 'lineup-contract'
import type { z } from 'zod'

const refusals = {
  400: 'The request is not valid',
  401: 'There is no key, or the provider refused it',
  403: 'Another site sent this, or the key may not do it',
  404: 'There is no such thing',
  409: 'It needs a choice first, or the provider is still on it',
  422: 'The provider refused this, or the time has passed',
  429: 'Too many requests. `Retry-After` says how long to wait',
  502: 'The provider did not answer'
} as const

type Refusal = keyof typeof refusals

// Whatever a route asks of the provider, the provider can answer in any of these ways.
const providerRefusals: Refusal[] = [401, 403, 429, 502]

interface RouteDoc {
  description: string
  status?: 200 | 201 | 204
  answer?: z.ZodType
  refuses?: Refusal[]
  /** Whether it needs the sealed key, which is the only credential the API has. */
  needsKey?: boolean
}

/** What the generated reference says of a route. It changes nothing about how the route runs. */
export const documented = ({
  description,
  status = 200,
  answer,
  refuses = [],
  needsKey = true
}: RouteDoc) =>
  describeRoute({
    description,
    security: needsKey ? [{ providerKey: [] }] : [],
    responses: {
      [status]: {
        description: 'It worked',
        ...(answer && { content: { 'application/json': { schema: resolver(answer) } } })
      },
      ...Object.fromEntries(
        [...refuses, ...(needsKey ? providerRefusals : [])].map((code) => [
          code,
          {
            description: refusals[code],
            content: { 'application/problem+json': { schema: resolver(problemSchema) } }
          }
        ])
      )
    }
  })
