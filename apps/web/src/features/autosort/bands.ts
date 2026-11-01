import { fromRed, type ImageColour, NEUTRAL_CHROMA } from './colour'

interface Coloured {
  id: string
  colour: ImageColour
}

// With this share of vivid pixels a photo is the accent of its row.
const ACCENT = 0.15
// With less than this its hue is noise, so it goes among the neutrals, by tone.
const MUTED = 0.05
// Past every hue, so the neutrals follow the colours.
const AFTER_HUES = 360

const isAccent = ({ colour }: Coloured) => colour.vivid > ACCENT

function colourKey({ colour: { dominant, tone, vivid } }: Coloured) {
  if (dominant.chroma < NEUTRAL_CHROMA || vivid < MUTED) return AFTER_HUES + tone
  return fromRed(dominant.hue)
}

/** Ties go by id, so the same images always give the same order, whatever order they came in. */
const sortedBy = (cells: Coloured[], key: (cell: Coloured) => number) =>
  [...cells].sort((one, other) => key(one) - key(other) || (one.id < other.id ? -1 : 1))

function chunks(cells: Coloured[], size: number) {
  return Array.from({ length: Math.ceil(cells.length / size) }, (_, index) =>
    cells.slice(index * size, (index + 1) * size)
  )
}

/** One accent to a row, walking across the columns, so they read as a diagonal and not a stripe. */
function layOut(band: Coloured[], columns: number) {
  const accents = sortedBy(band.filter(isAccent), ({ colour }) => -colour.vivid)
  const plain = sortedBy(
    band.filter((cell) => !isAccent(cell)),
    ({ colour }) => colour.tone
  )
  const rows = Array.from({ length: Math.ceil(band.length / columns) }, () => ({
    accents: [] as Coloured[],
    plain: [] as Coloured[]
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
export function bands(cells: Coloured[], rowsPerBand: number, columns: number) {
  const size = rowsPerBand * columns
  const dark = Math.ceil(Math.ceil(cells.length / size) / 2) * size
  const byTone = sortedBy(cells, ({ colour }) => colour.tone)
  const [night, day] = [byTone.slice(0, dark), byTone.slice(dark)].map((pool) =>
    chunks(sortedBy(pool, colourKey), size)
  )
  return night
    .flatMap((band, index) => [
      ...layOut(band, columns),
      ...(day[index] ? layOut(day[index], columns) : [])
    ])
    .map(({ id }) => id)
}
