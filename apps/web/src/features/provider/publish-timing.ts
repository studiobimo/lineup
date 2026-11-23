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

// ~keep
// A stretch of time that would sit too near another post, for the picker to mark. `start` is the
// first such time and `end` the first that is clear again. A time before the post is held to the
// gap of the post being scheduled, a time after it to the gap of that post.
export interface GapWindow {
  start: number
  end: number
  side: 'before' | 'after'
  position: number
  gap: number
}

interface GapInput {
  board: Board
  images: Record<string, ImageRecord | undefined>
  sizes: Record<string, number | undefined>
  cell: string
}

export function gapWindows({ board, images, sizes, cell }: GapInput): GapWindow[] {
  const own = slotOf(board, images, sizes, cell, 0)
  return scheduledSlots(board, images, sizes, cell).flatMap((slot) => {
    const position = board.grid.indexOf(slot.cell) + 1
    return [
      { start: slot.at - own.gap + MINUTE_MS, end: slot.at, side: 'after', position, gap: own.gap },
      { start: slot.at, end: slot.at + slot.gap, side: 'before', position, gap: slot.gap }
    ] as const
  })
}

interface DefaultInput extends GapInput {
  from: number
  soonest: number
}

// ~keep
// Where a new post starts out: after every post older on the grid has had its gap, and before the
// newer ones need theirs, so the order of the grid is the order of the times. With no room
// between them it falls back to the time that suits the older ones, and the warning says why.
export function defaultTime({ from, soonest, ...input }: DefaultInput) {
  const { board, images, sizes, cell } = input
  const place = board.grid.indexOf(cell)
  const own = slotOf(board, images, sizes, cell, 0)
  const others = place < 0 ? [] : scheduledSlots(board, images, sizes, cell)
  const whole = (time: number) => Math.ceil(time / MINUTE_MS) * MINUTE_MS
  const older = others.filter((slot) => board.grid.indexOf(slot.cell) > place)
  const newer = others.filter((slot) => board.grid.indexOf(slot.cell) < place)
  const lowest = Math.max(whole(soonest), ...older.map((slot) => whole(slot.at + slot.gap)))
  const preferred = Math.max(lowest, whole(from))
  const highest = Math.min(...newer.map((slot) => slot.at - own.gap))
  if (preferred <= highest || lowest > highest) return new Date(preferred)
  return new Date(highest)
}
