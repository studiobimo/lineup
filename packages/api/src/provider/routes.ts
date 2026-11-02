import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { validator } from 'hono-openapi'
import {
  accountSchema,
  connectUrlSchema,
  keyInputSchema,
  keyStatusSchema,
  listOf,
  newPostSchema,
  postChangesSchema,
  type Problem,
  publishedPostSchema,
  scheduledPostSchema,
  uploadRequestSchema,
  uploadSchema
} from 'lineup-contract'
import { z } from 'zod'

import { type ApiEnv, ProblemError } from '../problem'
import { documented } from '../route-docs'
import type { Provider, ProviderFor } from './provider'
import { seal, type SealedKey, type SecretEnv, unseal } from './sealed-key'

const COOKIE = 'provider-key'
const KEY_DAYS = 30
const DAY_SECONDS = 86_400
// The limiter counts in minutes (wrangler.jsonc), so this is the longest a caller has to wait.
const LIMIT_PERIOD_SECONDS = 60
// A time this close has passed by the time the post arrives, and the provider publishes those at once.
const SOONEST_MS = 60_000

const cookieOptions = {
  prefix: 'host',
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'Strict'
} as const

export interface ProviderBindings extends SecretEnv {
  KEY_RATE_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

interface ProviderEnv extends ApiEnv {
  Variables: ApiEnv['Variables'] & { sealed: SealedKey; provider: Provider }
}

const invalid = (errors: Problem['errors']) =>
  new ProblemError({ status: 400, code: 'validation', title: 'The request is not valid', errors })

type Segment = PropertyKey | { key: PropertyKey }

const pathOf = (path: readonly Segment[] = []) =>
  path.map((part) => String(typeof part === 'object' ? part.key : part)).join('.')

/** Its schema goes in the reference too, and what it refuses stays a problem document. */
const valid = <Target extends 'json' | 'query', Schema extends z.ZodType>(
  target: Target,
  schema: Schema
) =>
  validator(target, schema, (result) => {
    if (result.success) return
    throw invalid(result.error.map(({ path, message }) => ({ path: pathOf(path), message })))
  })

function notInThePast(scheduledFor: string) {
  if (Date.parse(scheduledFor) >= Date.now() + SOONEST_MS) return
  throw new ProblemError({
    status: 422,
    code: 'time_in_past',
    title: 'Pick a time later than now'
  })
}

export function providerRoutes(providerFor: ProviderFor) {
  const sameOrigin = createMiddleware<ProviderEnv>(async (c, next) => {
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

  const sealedKey = async (cookie: string | undefined, env: ProviderBindings) =>
    cookie ? unseal(cookie, env) : undefined

  const withKey = createMiddleware<ProviderEnv>(async (c, next) => {
    const sealed = await sealedKey(getCookie(c, COOKIE, 'host'), c.env)
    if (!sealed) {
      throw new ProblemError({ status: 401, code: 'key_missing', title: 'Add your key again' })
    }
    c.set('sealed', sealed)
    c.set('provider', providerFor(sealed.key))
    await next()
  })

  return new Hono<ProviderEnv>()
    .use(sameOrigin)
    .put(
      '/key',
      documented({
        description: 'Check a key with the provider, narrow it and seal it in a cookie',
        answer: keyStatusSchema,
        refuses: [400, 401, 403, 409, 429, 502],
        needsKey: false
      }),
      valid('json', keyInputSchema),
      async (c) => {
        const { key, profileId } = c.req.valid('json')
        // By address, so that this route cannot be used to try stolen keys in bulk.
        const caller = c.req.header('cf-connecting-ip') ?? 'unknown'
        if (!(await c.env.KEY_RATE_LIMIT.limit({ key: caller })).success) {
          throw new ProblemError({
            status: 429,
            code: 'rate_limited',
            title: 'Too many tries. Wait a minute',
            retryAfter: LIMIT_PERIOD_SECONDS
          })
        }

        const provider = providerFor(key)
        const profiles = await provider.profiles()
        const profile = profileId
          ? profiles.find(({ id }) => id === profileId)
          : profiles.length === 1
            ? profiles[0]
            : undefined
        if (!profile) {
          throw new ProblemError({
            status: 409,
            code: 'profile_required',
            title: 'Choose a profile for this key',
            profiles
          })
        }

        const narrowed = await provider.narrowed(profile.id, KEY_DAYS)
        const maxAge = KEY_DAYS * DAY_SECONDS
        const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString()
        const last4 = key.slice(-4)
        const sealed = { key: narrowed ?? key, last4, expiresAt, profileId: profile.id }
        setCookie(c, COOKIE, await seal(sealed, c.env), { ...cookieOptions, maxAge })
        return c.json({ last4, expiresAt })
      }
    )
    .get(
      '/key',
      documented({
        description: 'What may be shown of the key: its last four characters and its expiry',
        answer: keyStatusSchema,
        refuses: [404],
        needsKey: false
      }),
      async (c) => {
        const sealed = await sealedKey(getCookie(c, COOKIE, 'host'), c.env)
        if (!sealed) {
          throw new ProblemError({ status: 404, code: 'not_found', title: 'There is no key here' })
        }
        return c.json({ last4: sealed.last4, expiresAt: sealed.expiresAt })
      }
    )
    .delete(
      '/key',
      documented({
        description: 'Forget the key in this browser. It stays valid at the provider',
        status: 204,
        needsKey: false
      }),
      (c) => {
        deleteCookie(c, COOKIE, cookieOptions)
        return c.body(null, 204)
      }
    )
    .get(
      '/accounts',
      documented({
        description: 'The Instagram accounts this key can reach',
        answer: listOf(accountSchema)
      }),
      withKey,
      async (c) => c.json({ items: await c.var.provider.accounts(c.var.sealed.profileId) })
    )
    .get(
      '/connect-url',
      documented({
        description: 'Where to connect an account, for a key with none',
        answer: connectUrlSchema
      }),
      withKey,
      async (c) => {
        const returnTo = `${new URL(c.req.url).origin}/`
        return c.json({ url: await c.var.provider.connectUrl(c.var.sealed.profileId, returnTo) })
      }
    )
    .get(
      '/accounts/:id/posts',
      documented({
        description: 'What is already live, newest first',
        answer: listOf(publishedPostSchema),
        refuses: [404]
      }),
      withKey,
      async (c) => c.json({ items: await c.var.provider.publishedPosts(c.req.param('id')) })
    )
    .post(
      '/uploads',
      documented({
        description: 'An upload URL. The browser sends the image straight to it',
        status: 201,
        answer: uploadSchema,
        refuses: [400]
      }),
      valid('json', uploadRequestSchema),
      withKey,
      async (c) => c.json(await c.var.provider.upload(c.req.valid('json')), 201)
    )
    .get(
      '/scheduled-posts',
      documented({
        description: 'Posts made through Lineup, with their status',
        answer: listOf(scheduledPostSchema),
        refuses: [400]
      }),
      valid('query', z.object({ accountId: z.string().min(1) })),
      withKey,
      async (c) => {
        const { accountId } = c.req.valid('query')
        return c.json({ items: await c.var.provider.scheduledPosts(accountId) })
      }
    )
    .post(
      '/scheduled-posts',
      documented({
        description: 'Schedule. Needs `Idempotency-Key`, and refuses a time in the past',
        status: 201,
        answer: scheduledPostSchema,
        refuses: [400, 409, 422]
      }),
      valid('json', newPostSchema),
      withKey,
      async (c) => {
        const idempotencyKey = c.req.header('Idempotency-Key')
        if (!idempotencyKey) {
          throw new ProblemError({
            status: 400,
            code: 'idempotency_required',
            title: 'A schedule request needs an Idempotency-Key'
          })
        }
        const post = c.req.valid('json')
        notInThePast(post.scheduledFor)
        return c.json(await c.var.provider.schedule(post, idempotencyKey), 201)
      }
    )
    .patch(
      '/scheduled-posts/:id',
      documented({
        description: 'Change the time or the caption until it is published',
        answer: scheduledPostSchema,
        refuses: [400, 404, 409, 422]
      }),
      valid('json', postChangesSchema),
      withKey,
      async (c) => {
        const changes = c.req.valid('json')
        notInThePast(changes.scheduledFor)
        return c.json(await c.var.provider.update(c.req.param('id'), changes))
      }
    )
    .delete(
      '/scheduled-posts/:id',
      documented({
        description: 'Cancel. Refused once it is published',
        status: 204,
        refuses: [404, 409, 422]
      }),
      withKey,
      async (c) => {
        await c.var.provider.cancel(c.req.param('id'))
        return c.body(null, 204)
      }
    )
}
