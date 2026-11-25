import { z } from 'zod'

const id = z.string().min(1)

export const profileSchema = z.object({ id, name: z.string() })
export type Profile = z.infer<typeof profileSchema>

export const keyInputSchema = z.object({
  key: z.string().trim().min(8).max(512),
  profileId: id.optional()
})
export type KeyInput = z.infer<typeof keyInputSchema>

export const keyStatusSchema = z.object({
  last4: z.string(),
  expiresAt: z.iso.datetime(),
  canPost: z.boolean()
})
export type KeyStatus = z.infer<typeof keyStatusSchema>

export const accountSchema = z.object({
  id,
  username: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.url().optional(),
  followers: z.number().optional(),
  needsReconnection: z.boolean()
})
export type Account = z.infer<typeof accountSchema>

export const connectUrlSchema = z.object({ url: z.url() })

export const publishedPostSchema = z.object({
  id,
  url: z.url().optional(),
  thumbnailUrl: z.url().optional(),
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

export const droppedCollaboratorSchema = z.object({ username: z.string(), reason: z.string() })
export type DroppedCollaborator = z.infer<typeof droppedCollaboratorSchema>

export const scheduledPostSchema = z.object({
  id,
  status: postStatusSchema,
  scheduledFor: z.iso.datetime({ offset: true }).optional(),
  timeZone: z.string().optional(),
  caption: z.string().optional(),
  url: z.url().optional(),
  failure: z.string().optional(),
  publishedAt: z.iso.datetime({ offset: true }).optional(),
  collaborators: z.array(z.string()).optional(),
  droppedCollaborators: z.array(droppedCollaboratorSchema).optional(),
  commentsEnabled: z.boolean().optional(),
  firstComment: z.string().optional()
})
export type ScheduledPost = z.infer<typeof scheduledPostSchema>

// ~keep Both sides need it: the API refuses a post nearer than this, and the web app blocks the
// same times before they are sent.
export const SOONEST_MINUTES = 20
export const SOONEST_MS = SOONEST_MINUTES * 60_000

// ~keep The earliest time worth offering, on a whole minute so it matches a picker column.
export const soonestSchedule = (now = Date.now()) =>
  new Date(Math.ceil((now + SOONEST_MS) / 60_000) * 60_000)

const when = { scheduledFor: z.iso.datetime(), timeZone: z.string().min(1) }

// Instagram allows 20 people to be tagged on one post; Zernio documents no limit. ~keep
export const TAGS_PER_POST = 20

export const POST = { limit: { altText: 1000, collaborators: 3, firstComment: 2200 } } as const

export const usernameSchema = z.string().regex(/^[A-Za-z0-9._]{1,30}$/)

export const cleanUsername = (typed: string) => typed.trim().replace(/^@+/, '').toLowerCase()

export const userTagSchema = z.object({
  username: usernameSchema,
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  mediaIndex: z.number().int().min(0).optional()
})
export type UserTag = z.infer<typeof userTagSchema>

export const newPostSchema = z
  .object({
    ...when,
    accountId: id,
    caption: z.string(),
    mediaUrls: z.array(z.url()).min(1),
    mediaTypes: z.array(mediaTypeSchema).optional(),
    userTags: z.array(userTagSchema).max(TAGS_PER_POST).optional(),
    altTexts: z.array(z.string().max(POST.limit.altText)).optional(),
    collaborators: z.array(usernameSchema).max(POST.limit.collaborators).optional(),
    commentsEnabled: z.boolean().optional(),
    firstComment: z.string().max(POST.limit.firstComment).optional()
  })
  .superRefine(({ userTags, mediaUrls, mediaTypes, altTexts, collaborators }, context) => {
    if (
      new Set(collaborators?.map((name) => name.toLowerCase())).size < (collaborators?.length ?? 0)
    ) {
      context.addIssue({ code: 'custom', path: ['collaborators'], message: 'Each one once' })
    }
    if ((altTexts?.length ?? 0) > mediaUrls.length) {
      context.addIssue({ code: 'custom', path: ['altTexts'], message: 'No such slide' })
    }
    for (const [index, { mediaIndex = 0, x, y }] of (userTags ?? []).entries()) {
      if (mediaIndex >= mediaUrls.length) {
        context.addIssue({
          code: 'custom',
          path: ['userTags', index, 'mediaIndex'],
          message: 'No such slide'
        })
      } else if (
        (mediaTypes?.[mediaIndex] ?? 'image') === 'image' &&
        (x === undefined || y === undefined)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['userTags', index, 'x'],
          message: 'A tag on an image needs a point'
        })
      }
    }
  })
export type NewPost = z.infer<typeof newPostSchema>

export const postChangesSchema = z.object({ ...when, caption: z.string().optional() })
export type PostChanges = z.infer<typeof postChangesSchema>

export const listOf = <Item extends z.ZodType>(item: Item) => z.object({ items: z.array(item) })
