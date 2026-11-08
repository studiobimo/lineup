import { z } from 'zod'

const id = z.string().min(1)

export const profileSchema = z.object({ id, name: z.string() })
export type Profile = z.infer<typeof profileSchema>

export const keyInputSchema = z.object({
  key: z.string().trim().min(8).max(512),
  /** Sent once a key that sees several profiles has been answered with the choice. */
  profileId: id.optional()
})
export type KeyInput = z.infer<typeof keyInputSchema>

export const keyStatusSchema = z.object({
  last4: z.string(),
  expiresAt: z.iso.datetime(),
  /** False for a read-only key, which still reads the account's posts. */
  canPost: z.boolean()
})
export type KeyStatus = z.infer<typeof keyStatusSchema>

export const accountSchema = z.object({
  id,
  username: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.url().optional(),
  /** Only where the provider's plan includes it. */
  followers: z.number().optional(),
  needsReconnection: z.boolean()
})
export type Account = z.infer<typeof accountSchema>

export const connectUrlSchema = z.object({ url: z.url() })

export const publishedPostSchema = z.object({
  id,
  url: z.url().optional(),
  /** A picture only: a video's own file is `videoUrl`. */
  thumbnailUrl: z.url().optional(),
  /** Only on a video, for its first frame where the provider has no thumbnail. */
  videoUrl: z.url().optional(),
  caption: z.string().optional(),
  publishedAt: z.iso.datetime({ offset: true }).optional()
})
export type PublishedPost = z.infer<typeof publishedPostSchema>

export const mediaTypeSchema = z.enum(['image', 'video'])
export type MediaType = z.infer<typeof mediaTypeSchema>

export const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  size: z.number().int().positive()
})
export type UploadRequest = z.infer<typeof uploadRequestSchema>

export const uploadSchema = z.object({ uploadUrl: z.url(), mediaUrl: z.url() })
export type Upload = z.infer<typeof uploadSchema>

export const postStatusSchema = z.enum([
  'scheduled',
  'publishing',
  'published',
  'failed',
  'cancelled'
])
export type PostStatus = z.infer<typeof postStatusSchema>

export const scheduledPostSchema = z.object({
  id,
  status: postStatusSchema,
  scheduledFor: z.iso.datetime({ offset: true }).optional(),
  timeZone: z.string().optional(),
  caption: z.string().optional(),
  url: z.url().optional(),
  /** Why it failed, in the provider's words, for a post with that status. */
  failure: z.string().optional()
})
export type ScheduledPost = z.infer<typeof scheduledPostSchema>

const when = { scheduledFor: z.iso.datetime(), timeZone: z.string().min(1) }

export const newPostSchema = z.object({
  ...when,
  accountId: id,
  caption: z.string(),
  mediaUrls: z.array(z.url()).min(1),
  /** What each of `mediaUrls` is, in the same order. Without it, every one is an image. */
  mediaTypes: z.array(mediaTypeSchema).optional()
})
export type NewPost = z.infer<typeof newPostSchema>

export const postChangesSchema = z.object({ ...when, caption: z.string().optional() })
export type PostChanges = z.infer<typeof postChangesSchema>

/** Every list is in an envelope, as docs/API.md says. */
export const listOf = <Item extends z.ZodType>(item: Item) => z.object({ items: z.array(item) })
