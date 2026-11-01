import type { ImageRecord } from '@/features/planner/board-store'

import { instagram } from '@/features/planner/network-profile'

import { bands } from './bands'
import { fromRed, NEUTRAL_CHROMA, type Oklch } from './colour'

const keyedStrategies = ['rainbow', 'lightToDark', 'grouped'] as const

export const sortStrategies = [...keyedStrategies, 'bands2', 'bands4'] as const

export type SortStrategy = (typeof sortStrategies)[number]

const bandRows = { bands2: 2, bands4: 4 } as const

type Cell = Pick<ImageRecord, 'id' | 'colour'>

/** Compared in order, the first difference deciding. */
type SortKey = [rank: number, ...rest: number[]]

const NEUTRALS = 1
const NO_COLOUR = 2

const FAMILY_SPAN = 60

const keys: Record<(typeof keyedStrategies)[number], (colour: Oklch) => SortKey> = {
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
  if (strategy === 'bands2' || strategy === 'bands4') {
    const coloured = cells.flatMap(({ id, colour }) => (colour ? [{ id, colour }] : []))
    const waiting = cells.filter(({ colour }) => !colour).map(({ id }) => id)
    return [...bands(coloured, bandRows[strategy], instagram.columns), ...waiting.sort()]
  }
  return cells
    .map(({ id, colour }) => ({
      id,
      key: colour ? keys[strategy](colour.dominant) : ([NO_COLOUR] satisfies SortKey)
    }))
    .sort((one, other) => compare(one.key, other.key) || (one.id < other.id ? -1 : 1))
    .map(({ id }) => id)
}
