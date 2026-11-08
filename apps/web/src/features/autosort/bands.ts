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

export function bands({ cells, rowsPerBand, columns }: BandsRequest) {
  const size = rowsPerBand * columns
  const dark = Math.ceil(Math.ceil(cells.length / size) / 2) * size
  const byTone = sortedBy(cells, ({ tone }) => tone)
  const [night, day] = [byTone.slice(0, dark), byTone.slice(dark)].map((pool) =>
    chunks(inBandOrder(pool), size)
  )
  return night
    .flatMap((band, index) => [
      ...layOut(band, columns),
      ...(day[index] ? layOut(day[index], columns) : [])
    ])
    .map(({ id }) => id)
}
