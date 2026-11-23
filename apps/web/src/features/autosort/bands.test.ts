import { describe, expect, it } from 'vitest'

import { type BandCell, bands, type BandsRequest } from './bands'

const feed = (size: number): BandCell[] =>
  Array.from({ length: size }, (_, index) => ({
    id: String(index).padStart(3, '0'),
    tone: index % 2 === 0 ? 0.2 + index / 5000 : 0.8,
    vivid: index % 5 === 0 ? 0.4 : 0.1,
    hue: (index * 37) % 360
  }))

const toneOf = (cells: BandCell[], ids: string[]) =>
  ids.reduce((sum, id) => sum + cells.find((cell) => cell.id === id)!.tone, 0) / ids.length

const arrange = (cells: BandCell[], rowsPerBand: BandsRequest['rowsPerBand']) =>
  bands({ cells, rowsPerBand, columns: 3 })

describe('bands', () => {
  it.each([2, 4])('alternates dark and light every %i rows', (rows) => {
    const cells = feed(rows * 3 * 4)
    const order = arrange(cells, rows)
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
    expect([...arrange(cells, 2)].sort()).toEqual(cells.map(({ id }) => id))
  })

  it('gives a row one accent, and moves it along a column each row', () => {
    const cells = Array.from({ length: 6 }, (_, index) => ({
      id: `${index}`,
      tone: 0.3,
      vivid: index < 2 ? 0.5 : 0.1,
      hue: 200
    }))
    const order = arrange(cells, 2)
    const accents = order.flatMap((id, index) => (Number(id) < 2 ? [index] : []))
    expect(accents).toEqual([0, 4])
  })

  it('gives the same order whatever order the images came in', () => {
    const cells = feed(30)
    expect(arrange([...cells].reverse(), 4)).toEqual(arrange(cells, 4))
  })

  it('spreads neutrals through the colours rather than gathering them', () => {
    const cells = Array.from({ length: 12 }, (_, index) => ({
      id: String(index).padStart(2, '0'),
      tone: 0.2 + (index % 6) / 10,
      vivid: 0.1,
      hue: index % 2 === 0 ? null : index * 30
    }))
    const rows = arrange(cells, 1).reduce<string[][]>(
      (all, id, index) =>
        index % 3 === 0 ? [...all, [id]] : [...all.slice(0, -1), [...all.at(-1)!, id]],
      []
    )
    const isNeutral = (id: string) => cells.find((cell) => cell.id === id)!.hue === null
    for (const row of rows) {
      expect(row.some(isNeutral)).toBe(true)
      expect(row.every(isNeutral)).toBe(false)
    }
  })

  it('keeps a dated shoot in one band, and puts undated photos after it', () => {
    const shot = (id: string, tone: number, day?: number) => ({
      id,
      tone,
      vivid: 0.1,
      hue: (id.charCodeAt(0) * 40) % 360,
      takenAt: day
    })
    const dark = [shot('a', 0.1), shot('b', 0.1, 1), shot('c', 0.1), shot('d', 0.1, 3)]
    const light = ['e', 'f', 'g', 'h'].map((id) => shot(id, 0.9))
    const order = arrange(
      [...dark, ...light, shot('i', 0.1, 2), shot('j', 0.1), shot('k', 0.9), shot('l', 0.9)],
      1
    )
    expect(order.slice(0, 3).sort()).toEqual(['b', 'd', 'i'])
  })
})

describe('bands, places and the limits', () => {
  it('keeps a place together, and orders places by their newest photo', () => {
    const shot = (id: string, place: string, takenAt?: number) => ({
      id,
      tone: 0.3,
      vivid: 0.1,
      hue: 200,
      takenAt,
      place
    })
    const pool = [
      shot('a', 'Boston, US', 1),
      shot('b', 'Miami, US', 5),
      shot('c', 'Boston, US', 3),
      shot('d', 'Miami, US', 2),
      shot('e', 'Boston, US'),
      shot('f', 'Miami, US')
    ]
    const order = arrange(
      [...pool, ...pool.map((cell) => ({ ...cell, id: `${cell.id}2`, tone: 0.9 }))],
      1
    )
    expect(order.slice(0, 3).sort()).toEqual(['b', 'd', 'f'])
  })

  it('takes fewer images than a band, and none', () => {
    expect(arrange(feed(2), 4)).toHaveLength(2)
    expect(arrange([], 2)).toEqual([])
  })

  it('sorts 300 images well under the limit', () => {
    const cells = feed(300)
    const start = performance.now()
    arrange(cells, 4)
    expect(performance.now() - start).toBeLessThan(100)
  })

  it('sorts 300 images against nine neighbours well under the limit', () => {
    const cells = feed(300)
    const neighbours = feed(9).map((cell) => ({ ...cell, id: `live-${cell.id}` }))
    const start = performance.now()
    bands({ cells, rowsPerBand: 4, columns: 3, neighbours })
    expect(performance.now() - start).toBeLessThan(100)
  })

  it('ends on the tone of the posts that follow it', () => {
    const cells = feed(24)
    const meeting = (tone: number) => {
      const neighbours = [{ id: 'live', tone, vivid: 0.1, hue: null }]
      const order = bands({ cells, rowsPerBand: 2, columns: 3, neighbours })
      return toneOf(cells, order.slice(-3))
    }
    expect(meeting(0.2)).toBeLessThan(meeting(0.8))
  })

  it('keeps every image once when it has neighbours', () => {
    const cells = feed(20)
    const neighbours = [{ id: 'live', tone: 0.9, vivid: 0.1, hue: null }]
    const order = bands({ cells, rowsPerBand: 2, columns: 3, neighbours })
    expect([...order].sort()).toEqual(cells.map(({ id }) => id))
  })
})

describe('bands, colour at the seam', () => {
  const plain = (id: string, hue: number | null, vivid = 0.1): BandCell => ({
    id,
    tone: 0.3,
    vivid,
    hue
  })
  const seam = (cells: BandCell[], neighbours: BandCell[]) =>
    bands({ cells, rowsPerBand: 1, columns: 3, neighbours })

  it('puts each hue over the same hue below it, the short way round the circle', () => {
    const cells = [plain('x', 245), plain('y', 125), plain('z', 5)]
    const neighbours = [plain('n1', 355), plain('n2', 115), plain('n3', 235)]
    expect(seam(cells, neighbours)).toEqual(['z', 'y', 'x'])
  })

  it('carries the vividness of the row below down the column', () => {
    const cells = [plain('calm', 100, 0.02), plain('mid', 100, 0.1), plain('rich', 100, 0.14)]
    const row = (vivids: number[]) => vivids.map((vivid, index) => plain(`n${index}`, 100, vivid))
    expect(seam(cells, row([0.02, 0.1, 0.14]))).toEqual(['calm', 'mid', 'rich'])
    expect(seam(cells, row([0.14, 0.1, 0.02]))).toEqual(['rich', 'mid', 'calm'])
  })

  it('puts a neutral over a neutral, and a colour over its own colour', () => {
    const cells = [plain('grey', null), plain('green', 120), plain('red', 0)]
    const neighbours = [plain('n1', 0), plain('n2', 120), plain('n3', null)]
    expect(seam(cells, neighbours)).toEqual(['red', 'green', 'grey'])
  })
})
