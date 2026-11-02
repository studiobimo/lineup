import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { validator } from 'hono/validator'
import {
  keyInputSchema,
  newPostSchema,
  postChangesSchema,
  type Problem,
  uploadRequestSchema
} from 'lineup-contract'
import type { z } from 'zod'

import { type ApiEnv, ProblemError } from '../problem'
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

const json = <Schema extends z.ZodType>(schema: Schema) =>
  validator('json', (value): z.output<Schema> => {
    const parsed = schema.safeParse(value)
    if (parsed.success) return parsed.data
    throw invalid(
      parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message }))
    )
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
    .put('/key', json(keyInputSchema), async (c) => {
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
    })
    .get('/key', async (c) => {
      const sealed = await sealedKey(getCookie(c, COOKIE, 'host'), c.env)
      if (!sealed) {
        throw new ProblemError({ status: 404, code: 'not_found', title: 'There is no key here' })
      }
      return c.json({ last4: sealed.last4, expiresAt: sealed.expiresAt })
    })
    .delete('/key', (c) => {
      deleteCookie(c, COOKIE, cookieOptions)
      return c.body(null, 204)
    })
    .get('/accounts', withKey, async (c) =>
      c.json({ items: await c.var.provider.accounts(c.var.sealed.profileId) })
    )
    .get('/connect-url', withKey, async (c) => {
      const returnTo = `${new URL(c.req.url).origin}/`
      return c.json({ url: await c.var.provider.connectUrl(c.var.sealed.profileId, returnTo) })
    })
    .get('/accounts/:id/posts', withKey, async (c) =>
      c.json({ items: await c.var.provider.publishedPosts(c.req.param('id')) })
    )
    .post('/uploads', withKey, json(uploadRequestSchema), async (c) =>
      c.json(await c.var.provider.upload(c.req.valid('json')), 201)
    )
    .get('/scheduled-posts', withKey, async (c) => {
      const accountId = c.req.query('accountId')
      if (!accountId) throw invalid([{ path: 'accountId', message: 'Required' }])
      return c.json({ items: await c.var.provider.scheduledPosts(accountId) })
    })
    .post('/scheduled-posts', withKey, json(newPostSchema), async (c) => {
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
    })
    .patch('/scheduled-posts/:id', withKey, json(postChangesSchema), async (c) => {
      const changes = c.req.valid('json')
      notInThePast(changes.scheduledFor)
      return c.json(await c.var.provider.update(c.req.param('id'), changes))
    })
    .delete('/scheduled-posts/:id', withKey, async (c) => {
      await c.var.provider.cancel(c.req.param('id'))
      return c.body(null, 204)
    })
}
