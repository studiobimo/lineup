import { describe, expect, it } from 'vitest'

import type { BandCell } from './bands'
import { harmonise, hueGap, seamGap } from './harmony'

const cell = (id: string, hue: number | null, vivid = 0.1): BandCell => ({
  id,
  tone: 0.5,
  vivid,
  hue
})

const COLUMNS = 3
const isAccent = ({ vivid }: BandCell) => vivid > 0.3

const settle = (order: BandCell[], neighbours: BandCell[] = [], columns = COLUMNS) =>
  harmonise(order, { columns, neighbours, isFixed: isAccent }).map(({ id }) => id)

const everyOrder = <T>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((item, index) =>
        everyOrder(items.filter((_, other) => other !== index)).map((rest) => [item, ...rest])
      )

describe('hueGap', () => {
  it('is 1 for opposite hues and 0 for the same hue', () => {
    expect(hueGap(0, 180)).toBe(1)
    expect(hueGap(90, 270)).toBe(1)
    expect(hueGap(120, 120)).toBe(0)
  })

  it('goes the short way round the circle', () => {
    expect(hueGap(350, 10)).toBeCloseTo(20 / 180)
    expect(hueGap(350, 10)).toBeLessThan(hueGap(300, 10))
    expect(hueGap(300, 10)).toBeCloseTo(70 / 180)
  })

  it('treats a neutral as halfway from any colour, and as the same as another neutral', () => {
    expect(hueGap(null, 200)).toBe(0.5)
    expect(hueGap(200, null)).toBe(0.5)
    expect(hueGap(null, null)).toBe(0)
  })

  it('is symmetric', () => {
    for (const [one, other] of [
      [10, 250],
      [355, 5],
      [null, 40],
      [null, null]
    ] as const) {
      expect(hueGap(one, other)).toBe(hueGap(other, one))
    }
  })
})

describe('harmonise', () => {
  const planned = [cell('red', 0), cell('green', 120), cell('blue', 240)]
  const below = [cell('n-blue', 240), cell('n-red', 0), cell('n-green', 120)]

  it('keeps every cell once and does not return the neighbours', () => {
    const order = Array.from({ length: 8 }, (_, index) => cell(`c${index}`, index * 45))
    const result = settle(order, below)
    expect(result).toHaveLength(order.length)
    expect([...result].sort()).toEqual(order.map(({ id }) => id).sort())
  })

  it('leaves a fixed cell where it was', () => {
    const order = [cell('a', 0), cell('accent', 60, 0.5), cell('b', 0), cell('c', 180)]
    const result = settle(order, [], 4)
    expect(result[1]).toBe('accent')
  })

  it('puts a cell above the neighbour of the same hue', () => {
    expect(settle(planned, below)).toEqual(['blue', 'red', 'green'])
  })

  it('matches hues round the circle', () => {
    const row = [cell('last', 245), cell('mid', 125), cell('near', 5)]
    const neighbours = [cell('n1', 355), cell('n2', 115), cell('n3', 235)]
    expect(settle(row, neighbours)).toEqual(['near', 'mid', 'last'])
  })

  it('keeps equal hues side by side within a row', () => {
    const row = [cell('a1', 0), cell('b1', 120), cell('a2', 0), cell('b2', 120)]
    const hueOf = (id: string) => row.find((one) => one.id === id)!.hue
    const hues = settle(row, [], 4).map(hueOf)
    const changes = hues.filter((hue, index) => index > 0 && hue !== hues[index - 1])
    expect(changes).toHaveLength(1)
  })

  it('gives the same row whatever order the cells came in', () => {
    const expected = settle(planned, below)
    for (const order of everyOrder(planned)) {
      expect(settle(order, below)).toEqual(expected)
    }
  })

  it('returns nothing for nothing', () => {
    expect(settle([])).toEqual([])
    expect(settle([], below)).toEqual([])
  })
})

describe('seamGap', () => {
  const below = [cell('n-blue', 240), cell('n-red', 0), cell('n-green', 120)]

  it('is lower for a row that matches the posts below than for one that clashes', () => {
    const matching = [cell('blue', 240), cell('red', 0), cell('green', 120)]
    const clashing = [cell('red', 0), cell('green', 120), cell('blue', 240)]
    expect(seamGap(matching, below, COLUMNS)).toBeLessThan(seamGap(clashing, below, COLUMNS))
  })

  it('is 0 with nothing planned', () => {
    expect(seamGap([], below, COLUMNS)).toBe(0)
  })
})
