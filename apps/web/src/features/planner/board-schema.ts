import { z } from 'zod'

// What is read back from a file a person can reach, so none of it is taken on trust.
const oklch = z.object({ lightness: z.number(), chroma: z.number(), hue: z.number() })

export const boardSchema = z.object({
  tray: z.array(z.string()),
  grid: z.array(z.string()),
  locked: z.array(z.string()).optional(),
  albums: z.record(z.string(), z.array(z.string())).optional()
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
  place: z.string().optional()
})
