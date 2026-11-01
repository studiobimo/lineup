// Numbers in and ids out, with no imports, so this file can move to the Worker as it is. The app
// reaches it only through arrange-bands.ts.

export interface BandCell {
  id: string
  /** Mean lightness, from 0 to 1. */
  tone: number
  /** The share of pixels, from 0 to 1, that are strongly coloured. */
  vivid: number
  /** Degrees from the start of the rainbow. Null for a neutral, whose hue is noise. */
  hue: number | null
  /** When the photo was taken, in milliseconds, if that is known. */
  takenAt?: number
}

export interface BandsRequest {
  cells: BandCell[]
  rowsPerBand: number
  columns: number
}

// With this share of vivid pixels a photo is the accent of its row.
const ACCENT = 0.15
// Past every hue, so the neutrals follow the colours.
const AFTER_HUES = 360

const isAccent = ({ vivid }: BandCell) => vivid > ACCENT

const colourKey = ({ hue, tone }: BandCell) => hue ?? AFTER_HUES + tone

/** Ties go by id, so the same images always give the same order, whatever order they came in. */
const sortedBy = (cells: BandCell[], key: (cell: BandCell) => number) =>
  [...cells].sort((one, other) => key(one) - key(other) || (one.id < other.id ? -1 : 1))

/** Dated photos first, newest at the top, so that a shoot stays in one band. */
function inBandOrder(pool: BandCell[]) {
  const dated = pool.filter(({ takenAt }) => takenAt !== undefined)
  const undated = pool.filter(({ takenAt }) => takenAt === undefined)
  return [...sortedBy(dated, ({ takenAt = 0 }) => -takenAt), ...sortedBy(undated, colourKey)]
}

function chunks(cells: BandCell[], size: number) {
  return Array.from({ length: Math.ceil(cells.length / size) }, (_, index) =>
    cells.slice(index * size, (index + 1) * size)
  )
}

/** One accent to a row, walking across the columns, so they read as a diagonal and not a stripe. */
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

/**
 * Night and day: bands of dark rows and light rows in turn, each band close in colour. The darkest
 * cells take the first band and every other one, because a feed reads best opening dark.
 */
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
