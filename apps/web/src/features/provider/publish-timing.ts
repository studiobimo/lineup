import { imagesOf } from '@/features/planner/board'
import type { Board, ImageRecord } from '@/features/planner/board-store'
import { instagram } from '@/features/planner/network-profile'

const MINUTE_MS = 60_000

const { imageMs, videoMs, freeBytes, stepBytes, stepMs } = instagram.publishGap

// ~keep
// What a post needs to be live before the next one goes out. A size that is not known leaves
// only the base, which is also all a picture ever needs.
export function publishGap(video: boolean, bytes?: number) {
  if (!video) return imageMs
  const over = bytes && bytes > freeBytes ? Math.ceil((bytes - freeBytes) / stepBytes) : 0
  return videoMs + over * stepMs
}

interface Slot {
  cell: string
  at: number
  gap: number
  video: boolean
}

export interface Spacing {
  // ~keep
  // The post before, then the post after, that sit too near the chosen time.
  near: { side: 'before' | 'after'; slot: Slot; position: number }[]
  // ~keep
  // The earliest time that leaves every gap, if the neighbours leave room for one.
  suggested?: Date
}

const live = ({ status }: { status: string }) => status === 'scheduled' || status === 'publishing'

function slotOf(
  board: Board,
  images: Record<string, ImageRecord | undefined>,
  sizes: Record<string, number | undefined>,
  cell: string,
  at: number
): Slot {
  const held = imagesOf(board, cell)
  const video = held.some((image) => images[image]?.video)
  const bytes = held.reduce((total, image) => total + (sizes[image] ?? 0), 0)
  return { cell, at, gap: publishGap(video, bytes), video }
}

function scheduledSlots(
  board: Board,
  images: Record<string, ImageRecord | undefined>,
  sizes: Record<string, number | undefined>,
  except: string
) {
  return Object.entries(board.posts ?? {})
    .filter(([cell, post]) => cell !== except && live(post))
    .map(([cell, post]) => slotOf(board, images, sizes, cell, Date.parse(post.scheduledFor)))
    .sort((a, b) => a.at - b.at)
}

interface SpacingInput {
  board: Board
  images: Record<string, ImageRecord | undefined>
  sizes: Record<string, number | undefined>
  cell: string
  when: number
  soonest: number
}

export function spacingFor({
  board,
  images,
  sizes,
  cell,
  when,
  soonest
}: SpacingInput): Spacing | undefined {
  const own = slotOf(board, images, sizes, cell, when)
  const others = scheduledSlots(board, images, sizes, cell)
  const before = others.findLast((slot) => slot.at <= when)
  const after = others.find((slot) => slot.at > when)
  const position = (slot: Slot) => board.grid.indexOf(slot.cell) + 1
  const near: Spacing['near'] = []
  if (before && when < before.at + before.gap) {
    near.push({ side: 'before', slot: before, position: position(before) })
  }
  if (after && when + own.gap > after.at) {
    near.push({ side: 'after', slot: after, position: position(after) })
  }
  if (near.length === 0) return undefined
  const earliest = Math.max(soonest, before ? before.at + before.gap : 0)
  const start = Math.ceil(earliest / MINUTE_MS) * MINUTE_MS
  const latest = after ? after.at - own.gap : Infinity
  // ~keep
  // The nearest time to the one chosen that leaves every gap: the earliest one when it is the
  // post before that is too near, and just ahead of the next when it is that one. With no room
  // between them there is no time to offer, and none that runs into the post after.
  const suggested = start <= latest ? Math.max(start, Math.min(when, latest)) : undefined
  return { near, suggested: suggested === undefined ? undefined : new Date(suggested) }
}
