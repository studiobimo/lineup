import { harmonise, seamGap } from './harmony'

export interface BandCell {
  id: string
  tone: number
  vivid: number
  hue: number | null
  takenAt?: number
  place?: string
}

export interface BandsRequest {
  cells: BandCell[]
  rowsPerBand: number
  columns: number
  neighbours?: BandCell[]
}

const ACCENT = 0.15
const AFTER_HUES = 360

const isAccent = ({ vivid }: BandCell) => vivid > ACCENT

const colourKey = ({ hue, tone }: BandCell) => hue ?? AFTER_HUES + tone

const sortedBy = (cells: BandCell[], key: (cell: BandCell) => number) =>
  [...cells].sort((one, other) => key(one) - key(other) || (one.id < other.id ? -1 : 1))

const inShootOrder = (cells: BandCell[]) =>
  sortedBy(cells, (cell) => (cell.takenAt === undefined ? colourKey(cell) : -cell.takenAt))

function inBandOrder(pool: BandCell[]) {
  const shoots = new Map<string, BandCell[]>()
  const unknown: BandCell[] = []
  for (const cell of pool) {
    const shoot = cell.place ?? cell.id
    if (cell.takenAt === undefined && cell.place === undefined) unknown.push(cell)
    else shoots.set(shoot, [...(shoots.get(shoot) ?? []), cell])
  }
  const newest = ([{ takenAt = 0 }]: BandCell[]) => takenAt
  const ordered = [...shoots.values()]
    .map(inShootOrder)
    .sort((one, other) => newest(other) - newest(one) || (one[0].id < other[0].id ? -1 : 1))
  return [...ordered.flat(), ...sortedBy(unknown, colourKey)]
}

function chunks(cells: BandCell[], size: number) {
  return Array.from({ length: Math.ceil(cells.length / size) }, (_, index) =>
    cells.slice(index * size, (index + 1) * size)
  )
}

function layOut(band: BandCell[], columns: number) {
  const accents = sortedBy(band.filter(isAccent), ({ vivid }) => -vivid)
  const plain = sortedBy(
    band.filter((cell) => !isAccent(cell)),
    ({ tone }) => tone
  )
  const rows = Array.from({ length: Math.ceil(band.length / columns) }, () => ({
    accents: [] as BandCell[],
    plain: [] as BandCell[]
  }))
  accents.forEach((accent, index) => rows[index % rows.length].accents.push(accent))
  for (const row of rows) {
    row.plain = plain.splice(0, columns - row.accents.length)
  }
  return rows.flatMap((row, index) => {
    const [first, ...others] = row.accents
    const line = [...row.plain]
    if (first) line.splice(index % columns, 0, first)
    return [...line, ...others]
  })
}

const meanTone = (cells: BandCell[]) =>
  cells.reduce((sum, { tone }) => sum + tone, 0) / cells.length

function arrange(cells: BandCell[], size: number, columns: number, darkFirst: boolean) {
  const bandCount = Math.ceil(cells.length / size)
  const lead = Math.ceil(bandCount / 2) * size
  const byTone = sortedBy(cells, ({ tone }) => (darkFirst ? tone : -tone))
  const [first, second] = [byTone.slice(0, lead), byTone.slice(lead)].map((pool) =>
    chunks(inBandOrder(pool), size)
  )
  return first.flatMap((band, index) => [
    ...layOut(band, columns),
    ...(second[index] ? layOut(second[index], columns) : [])
  ])
}

const rowsReversed = (order: BandCell[], columns: number) => chunks(order, columns).reverse().flat()

function closestToNeighbours(
  options: BandCell[][],
  { columns, size, neighbours }: { columns: number; size: number; neighbours: BandCell[] }
) {
  const nearestRow = meanTone(neighbours.slice(0, columns))
  const nearestBand = meanTone(neighbours.slice(0, size))
  const gap = (order: BandCell[]) =>
    Math.abs(meanTone(order.slice(-columns)) - nearestRow) +
    Math.abs(meanTone(order.slice(-size)) - nearestBand) +
    seamGap(order, neighbours, columns)
  return options.reduce((best, option) => (gap(option) < gap(best) ? option : best))
}

export function bands({ cells, rowsPerBand, columns, neighbours = [] }: BandsRequest) {
  const size = rowsPerBand * columns
  const settled = (order: BandCell[]) =>
    harmonise(order, { columns, neighbours, isFixed: isAccent })
  const dark = arrange(cells, size, columns, true)
  if (neighbours.length === 0 || cells.length === 0) return settled(dark).map(({ id }) => id)
  const light = arrange(cells, size, columns, false)
  const options = [dark, light].flatMap((order) => [order, rowsReversed(order, columns)])
  return closestToNeighbours(options.map(settled), { columns, size, neighbours }).map(
    ({ id }) => id
  )
}
