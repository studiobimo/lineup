import type { ImageRecord } from '@/features/planner/board-store'

import type { Oklch } from './colour'

export const sortStrategies = ['rainbow', 'lightToDark', 'grouped'] as const

export type SortStrategy = (typeof sortStrategies)[number]

type Cell = Pick<ImageRecord, 'id' | 'colour'>

/** Compared in order, the first difference deciding. */
type SortKey = [rank: number, ...rest: number[]]

const NEUTRALS = 1
const NO_COLOUR = 2

// Below this a photo reads as black, white or grey, and its hue is noise.
const NEUTRAL_CHROMA = 0.04
// The hue the rainbow opens on, so that the reds are not split between its two ends.
const RAINBOW_START = 10
const FAMILY_SPAN = 60

const fromRed = (hue: number) => (hue - RAINBOW_START + 360) % 360

const keys: Record<SortStrategy, (colour: Oklch) => SortKey> = {
  rainbow({ chroma, hue, lightness }) {
    if (chroma < NEUTRAL_CHROMA) return [NEUTRALS, -lightness]
    return [0, fromRed(hue), -lightness]
  },
  lightToDark: ({ lightness }) => [0, -lightness],
  grouped({ chroma, hue, lightness }) {
    if (chroma < NEUTRAL_CHROMA) return [NEUTRALS, -lightness]
    return [0, Math.floor(fromRed(hue) / FAMILY_SPAN), -lightness]
  }
}

function compare(one: SortKey, other: SortKey) {
  for (let index = 0; index < Math.max(one.length, other.length); index += 1) {
    const difference = (one[index] ?? 0) - (other[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/** The new order of `cells`. An image with no colour yet goes last, so it is never lost in the rest. */
export function sortByColour(cells: Cell[], strategy: SortStrategy) {
  return cells
    .map(({ id, colour }) => ({
      id,
      key: colour ? keys[strategy](colour.dominant) : ([NO_COLOUR] satisfies SortKey)
    }))
    .sort((one, other) => compare(one.key, other.key) || (one.id < other.id ? -1 : 1))
    .map(({ id }) => id)
}
