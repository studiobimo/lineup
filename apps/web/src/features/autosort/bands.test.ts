import { describe, expect, it } from 'vitest'

import { bands } from './bands'
import type { ImageColour } from './colour'

const colourOf = (tone: number, vivid: number, hue = 200): ImageColour => {
  const dominant = { lightness: tone, chroma: 0.1, hue }
  return { dominant, palette: [dominant], tone, vivid }
}

/** Half dark, half light, every fifth one vivid, and a hue that varies. */
const feed = (size: number) =>
  Array.from({ length: size }, (_, index) => ({
    id: String(index).padStart(3, '0'),
    colour: colourOf(
      index % 2 === 0 ? 0.2 + index / 5000 : 0.8,
      index % 5 === 0 ? 0.4 : 0.1,
      (index * 37) % 360
    )
  }))

const toneOf = (cells: ReturnType<typeof feed>, ids: string[]) =>
  ids.reduce((sum, id) => sum + cells.find((cell) => cell.id === id)!.colour.tone, 0) / ids.length

describe('bands', () => {
  it.each([2, 4])('alternates dark and light every %i rows', (rows) => {
    const cells = feed(rows * 3 * 4)
    const order = bands(cells, rows, 3)
    const size = rows * 3
    const tones = [0, 1, 2, 3].map((band) =>
      toneOf(cells, order.slice(band * size, (band + 1) * size))
    )
    expect(tones[0]).toBeLessThan(tones[1])
    expect(tones[1]).toBeGreaterThan(tones[2])
    expect(tones[2]).toBeLessThan(tones[3])
  })

  it('keeps every image once, including a part-filled last row', () => {
    const cells = feed(20)
    expect([...bands(cells, 2, 3)].sort()).toEqual(cells.map(({ id }) => id))
  })

  it('gives a row one accent, and moves it along a column each row', () => {
    const cells = Array.from({ length: 6 }, (_, index) => ({
      id: `${index}`,
      colour: colourOf(0.3, index < 2 ? 0.5 : 0.1)
    }))
    const order = bands(cells, 2, 3)
    const accents = order.flatMap((id, index) => (Number(id) < 2 ? [index] : []))
    expect(accents).toEqual([0, 4])
  })

  it('gives the same order whatever order the images came in', () => {
    const cells = feed(30)
    expect(bands([...cells].reverse(), 4, 3)).toEqual(bands(cells, 4, 3))
  })

  it('takes fewer images than a band, and none', () => {
    expect(bands(feed(2), 4, 3)).toHaveLength(2)
    expect(bands([], 2, 3)).toEqual([])
  })

  it('sorts 300 images well under the limit', () => {
    const cells = feed(300)
    const start = performance.now()
    bands(cells, 4, 3)
    expect(performance.now() - start).toBeLessThan(100)
  })
})
