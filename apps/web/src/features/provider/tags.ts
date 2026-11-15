import { TAGS_PER_POST, type UserTag, usernameSchema } from 'lineup-contract'

const NUDGE = 0.01
const BIG_NUDGE = 0.1

export interface TagDraft extends UserTag {
  key: string
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

const round = (value: number) => Math.round(value * 1000) / 1000

export const pointIn = (
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  x: number,
  y: number
) =>
  rect.width > 0 && rect.height > 0
    ? {
        x: round(clamp((x - rect.left) / rect.width)),
        y: round(clamp((y - rect.top) / rect.height))
      }
    : { x: 0.5, y: 0.5 }

const MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

export function nudged(tag: TagDraft, key: string, big: boolean) {
  const move = MOVES[key]
  if (!move) return undefined
  const step = big ? BIG_NUDGE : NUDGE
  return {
    x: round(clamp((tag.x ?? 0.5) + move[0] * step)),
    y: round(clamp((tag.y ?? 0.5) + move[1] * step))
  }
}

export const mayAddTag = (tags: TagDraft[]) => tags.length < TAGS_PER_POST

export const isValidName = (username: string) => usernameSchema.safeParse(username).success

export const allNamed = (tags: TagDraft[]) => tags.every(({ username }) => isValidName(username))

export const toUserTags = (tags: TagDraft[]): UserTag[] =>
  tags.map(({ username, x, y, mediaIndex }) =>
    x === undefined ? { username, mediaIndex } : { username, x, y, mediaIndex }
  )

export class InvalidTagError extends Error {}
