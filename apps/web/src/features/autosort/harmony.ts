import type { BandCell } from './bands'

const HARMONY = {
  hue: { turn: 360, neutralGap: 0.5 },
  seam: { weight: 0.25 }
} as const

export function hueGap(one: number | null, other: number | null) {
  if (one === null || other === null) return one === other ? 0 : HARMONY.hue.neutralGap
  const arc = Math.abs(one - other) % HARMONY.hue.turn
  return (2 * Math.min(arc, HARMONY.hue.turn - arc)) / HARMONY.hue.turn
}

const pairGap = (one: BandCell, other: BandCell) =>
  hueGap(one.hue, other.hue) + Math.abs(one.vivid - other.vivid) + Math.abs(one.tone - other.tone)

const sameRow = (one: number, other: number, columns: number) =>
  Math.floor(one / columns) === Math.floor(other / columns)

function costAt(grid: BandCell[], position: number, columns: number) {
  const right = position + 1
  const below = position + columns
  const beside = right < grid.length && sameRow(position, right, columns)
  return (
    (beside ? pairGap(grid[position], grid[right]) : 0) +
    (below < grid.length ? pairGap(grid[position], grid[below]) : 0)
  )
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  return items.flatMap((item, index) =>
    permutations(items.filter((_, other) => other !== index)).map((rest) => [item, ...rest])
  )
}

function settleRow(
  grid: BandCell[],
  positions: number[],
  { columns, isFixed }: { columns: number; isFixed: (cell: BandCell) => boolean }
) {
  const free = positions.filter((position) => !isFixed(grid[position]))
  const cost = () => positions.reduce((sum, position) => sum + costAt(grid, position, columns), 0)
  let best = free.map((position) => grid[position])
  let lowest = cost()
  for (const option of permutations(best).slice(1)) {
    free.forEach((position, index) => (grid[position] = option[index]))
    const score = cost()
    if (score < lowest) [best, lowest] = [option, score]
  }
  free.forEach((position, index) => (grid[position] = best[index]))
}

interface HarmoniseOptions {
  columns: number
  neighbours: BandCell[]
  isFixed: (cell: BandCell) => boolean
}

export function harmonise(
  order: BandCell[],
  { columns, neighbours, isFixed }: HarmoniseOptions
): BandCell[] {
  const grid = [...order, ...neighbours]
  for (
    let start = Math.floor((order.length - 1) / columns) * columns;
    start >= 0;
    start -= columns
  ) {
    const positions = Array.from(
      { length: Math.min(columns, order.length - start) },
      (_, index) => start + index
    )
    settleRow(grid, positions, { columns, isFixed })
  }
  return grid.slice(0, order.length)
}

export function seamGap(order: BandCell[], neighbours: BandCell[], columns: number) {
  const grid = [...order, ...neighbours]
  const edge = Array.from(
    { length: Math.min(columns, order.length) },
    (_, index) => order.length - 1 - index
  )
  const total = edge.reduce((sum, position) => sum + costAt(grid, position, columns), 0)
  return (HARMONY.seam.weight * total) / Math.max(edge.length, 1)
}
