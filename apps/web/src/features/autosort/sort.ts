import type { ImageRecord } from '@/features/planner/board-store'

import { instagram } from '@/features/planner/network-profile'

import { arrangeBands } from './arrange-bands'
import type { BandCell } from './bands'
import { fromRed, type ImageColour, NEUTRAL_CHROMA, type Oklch } from './colour'

const keyedStrategies = ['rainbow', 'lightToDark', 'grouped'] as const

export const sortStrategies = [...keyedStrategies, 'bands2', 'bands4'] as const

export type SortStrategy = (typeof sortStrategies)[number]

export const bandRows = { bands2: 2, bands4: 4 } as const

type Cell = Pick<ImageRecord, 'id' | 'colour' | 'takenAt' | 'place'>

type SortKey = [rank: number, ...rest: number[]]

const NEUTRALS = 1
const NO_COLOUR = 2

const FAMILY_SPAN = 60
const MUTED = 0.05

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

export function toBandCell(
  { id, takenAt, place }: Cell,
  { dominant, tone, vivid }: ImageColour
): BandCell {
  const neutral = dominant.chroma < NEUTRAL_CHROMA || vivid < MUTED
  return {
    id,
    tone,
    vivid,
    hue: neutral ? null : fromRed(dominant.hue),
    takenAt: takenAt === undefined ? undefined : Date.parse(takenAt),
    place
  }
}

function compare(one: SortKey, other: SortKey) {
  for (let index = 0; index < Math.max(one.length, other.length); index += 1) {
    const difference = (one[index] ?? 0) - (other[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export async function sortByColour(
  cells: Cell[],
  strategy: SortStrategy,
  neighbours: BandCell[] = []
) {
  if (strategy === 'bands2' || strategy === 'bands4') {
    console.info('[magic sort]', `sorting with ${neighbours.length} neighbour colours`)
    const order = await arrangeBands({
      cells: cells.flatMap((cell) => (cell.colour ? [toBandCell(cell, cell.colour)] : [])),
      rowsPerBand: bandRows[strategy],
      columns: instagram.columns,
      neighbours
    })
    const waiting = cells.filter(({ colour }) => !colour).map(({ id }) => id)
    return [...order, ...waiting.sort()]
  }
  return cells
    .map(({ id, colour }) => ({
      id,
      key: colour ? keys[strategy](colour.dominant) : ([NO_COLOUR] satisfies SortKey)
    }))
    .sort((one, other) => compare(one.key, other.key) || (one.id < other.id ? -1 : 1))
    .map(({ id }) => id)
}
