import { droppedCollaboratorSchema, postShapeSchema, postStatusSchema } from 'lineup-contract'
import { z } from 'zod'

export const videoTypeSchema = z.enum(['video/mp4', 'video/quicktime'])

const oklch = z.object({ lightness: z.number(), chroma: z.number(), hue: z.number() })

const cellPostSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  scheduledFor: z.string(),
  timeZone: z.string(),
  caption: z.string(),
  status: postStatusSchema,
  url: z.string().optional(),
  failure: z.string().optional(),
  collaborators: z.array(z.string()).optional(),
  droppedCollaborators: z.array(droppedCollaboratorSchema).optional(),
  // ~keep ADR-0026. All three are optional, so a board saved before them opens as it was: a post
  // without a shape or a time is never measured.
  media: postShapeSchema.optional(),
  publishedAt: z.string().optional(),
  reported: z.literal(true).optional()
})
export type CellPost = z.infer<typeof cellPostSchema>

export const boardSchema = z.object({
  tray: z.array(z.string()),
  grid: z.array(z.string()),
  locked: z.array(z.string()).optional(),
  albums: z.record(z.string(), z.array(z.string())).optional(),
  posts: z.record(z.string(), cellPostSchema).optional()
})

export const historySchema = z.object({
  past: z.array(boardSchema),
  future: z.array(boardSchema)
})

export const imageRecordSchema = z.object({
  id: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  createdAt: z.string(),
  colour: z
    .object({
      dominant: oklch,
      palette: z.array(oklch),
      tone: z.number(),
      vivid: z.number()
    })
    .optional(),
  takenAt: z.string().optional(),
  place: z.string().optional(),
  video: z.object({ type: videoTypeSchema, duration: z.number().nonnegative() }).optional()
})
