import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { publishDelaySchema } from 'lineup-contract'

import { allowTry, type Limiter, sameOrigin, valid } from '../guards'
import type { ApiEnv } from '../problem'
import { documented } from '../route-docs'

export interface TelemetryBindings {
  TELEMETRY_RATE_LIMIT: Limiter
  // ~keep A secret. Without it no account tag is logged.
  TELEMETRY_SALT?: string
}

const TAG_LENGTH = 12
const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

// ~keep HMAC-SHA-256 of the handle, keyed with the salt, cut to 12 hex characters. The handle is
// only a parameter here, so nothing keeps it, and .devtools/scripts/telemetry-tag.mjs makes the
// same tag to look a customer up.
export async function accountTag(handle: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(handle))
  return toHex(signed).slice(0, TAG_LENGTH)
}

// ~keep Before validation, so a flood of bad bodies is limited too.
const limited = createMiddleware<ApiEnv>(async (c, next) => {
  await allowTry(c.env.TELEMETRY_RATE_LIMIT, c.req.header('cf-connecting-ip') ?? 'unknown')
  await next()
})

// ~keep ADR-0026. The attributes are OpenTelemetry-style so the line can be exported as it is. It is built field by field from the validated body, so a key the
// schema gains later is a deliberate choice here, and the request itself is never logged.
export const telemetryRoutes = () =>
  new Hono<ApiEnv>().use(sameOrigin).post(
    '/publish-delay',
    documented({
      description: 'Log how long one post took to publish, anonymously. Stores nothing',
      status: 204,
      refuses: [400, 403, 429],
      needsKey: false
    }),
    limited,
    valid('json', publishDelaySchema),
    async (c) => {
      const event = c.req.valid('json')
      const { account } = event
      const salt = c.env.TELEMETRY_SALT
      const tag =
        account && salt ? await accountTag(account, salt).catch(() => undefined) : undefined
      console.log(
        JSON.stringify({
          'event.name': 'lineup.publish_delay',
          'lineup.post.id': event.eventId,
          'lineup.post.scheduled_for': event.scheduledFor,
          'lineup.post.published_at': event.publishedAt,
          'lineup.post.delay_seconds': event.delaySeconds,
          'lineup.post.media_kind': event.kind,
          'lineup.post.image_count': event.images,
          'lineup.post.video_count': event.videos,
          'lineup.post.total_bytes': event.totalBytes,
          'lineup.post.largest_video_bytes': event.largestVideoBytes,
          'lineup.post.largest_video_seconds': event.largestVideoSeconds,
          'lineup.account.tag': tag,
          'service.version': event.appVersion
        })
      )
      return c.body(null, 204)
    }
  )
