import { z } from 'zod'

export const postKindSchema = z.enum(['image', 'carousel', 'reel'])
export type PostKind = z.infer<typeof postKindSchema>

const MEDIA_PER_POST = 20
const MAX_DELAY_SECONDS = 30 * 86_400
const count = z.number().int().min(0).max(MEDIA_PER_POST)
const bytes = z.number().int().nonnegative()

// ~keep The shape of a post, kept with it when it is scheduled because the sizes are not kept once
// the images are uploaded. Only counts and sizes: nothing that says what the post is.
export const postShapeSchema = z.object({
  kind: postKindSchema,
  images: count,
  videos: count,
  totalBytes: bytes,
  largestVideoBytes: bytes.optional(),
  largestVideoSeconds: z.number().nonnegative().optional()
})
export type PostShape = z.infer<typeof postShapeSchema>

// ~keep Trimmed and lowercased, so the same account always gives the same tag.
export const accountHandleSchema = z.string().regex(/^[a-z0-9._]{1,30}$/)

// ~keep ADR-0026. Strict, so a field added to the client by mistake is refused and never logged.
export const publishDelaySchema = postShapeSchema
  .extend({
    eventId: z.uuid(),
    scheduledFor: z.iso.datetime({ offset: true }),
    publishedAt: z.iso.datetime({ offset: true }),
    delaySeconds: z.number().int().min(0).max(MAX_DELAY_SECONDS),
    appVersion: z.string().min(1).max(40),
    // ~keep The connected account's handle, trimmed and lowercased, as the provider returns it. The
    // Worker only ever logs a salted hash of it, never this value.
    account: accountHandleSchema.optional()
  })
  .strict()
export type PublishDelay = z.infer<typeof publishDelaySchema>
