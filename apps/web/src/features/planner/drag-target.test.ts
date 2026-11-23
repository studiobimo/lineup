import { describe, expect, it } from 'vitest'

import { type Box, dropTarget, nearestInDirection } from './drag-target'

const board = { tray: ['t1'], grid: ['a', 'b', 'c', 'd'] }

const boxes: Record<string, Box> = {
  a: { left: 0, right: 100, top: 0, bottom: 100 },
  b: { left: 100, right: 200, top: 0, bottom: 100 },
  c: { left: 0, right: 100, top: 100, bottom: 200 },
  d: { left: 100, right: 200, top: 100, bottom: 200 }
}

const aim = (overrides: Partial<Parameters<typeof dropTarget>[0]>) =>
  dropTarget({
    board,
    active: 't1',
    hover: { id: 'b', container: 'grid', isCell: true },
    point: { x: 150, y: 50 },
    inserting: false,
    dwelling: null,
    boxOf: (id) => boxes[id],
    ...overrides
  })

describe('dropTarget over a cell it has been held on', () => {
  it('groups with that cell', () => {
    expect(aim({ dwelling: 'b', hover: { id: 'b', container: 'grid', isCell: true } })).toEqual({
      kind: 'group',
      id: 'b'
    })
  })

  it('swaps with any other', () => {
    const target = aim({ dwelling: 'a', hover: { id: 'b', container: 'grid', isCell: true } })
    expect(target).toEqual({ kind: 'swap', id: 'b' })
  })
})

describe('dropTarget on a locked cell', () => {
  it('inserts beside it, because it cannot swap', () => {
    const locked = { ...board, locked: ['b'] }
    expect(aim({ board: locked })).toMatchObject({ kind: 'insert', container: 'grid' })
  })
})

describe('nearestInDirection', () => {
  const all = Object.values(boxes)

  it('finds the next cell each way', () => {
    expect(nearestInDirection(boxes.a, 'right', all)).toBe(boxes.b)
    expect(nearestInDirection(boxes.b, 'left', all)).toBe(boxes.a)
    expect(nearestInDirection(boxes.a, 'down', all)).toBe(boxes.c)
    expect(nearestInDirection(boxes.c, 'up', all)).toBe(boxes.a)
  })

  it('stays in the column rather than taking the nearer diagonal', () => {
    const below = { left: 0, right: 100, top: 300, bottom: 400 }
    const diagonal = { left: 100, right: 200, top: 120, bottom: 220 }
    expect(nearestInDirection(boxes.a, 'down', [diagonal, below])).toBe(below)
  })

  it('finds nothing past the edge', () => {
    expect(nearestInDirection(boxes.a, 'left', all)).toBeUndefined()
    expect(nearestInDirection(boxes.a, 'up', all)).toBeUndefined()
  })
})

describe('dropTarget', () => {
  it('swaps with the cell under the pointer', () => {
    expect(aim({})).toEqual({ kind: 'swap', id: 'b' })
  })

  it('does nothing over the cell being dragged', () => {
    expect(aim({ active: 'b' })).toBeNull()
  })

  it("inserts near a cell's side edges without Shift", () => {
    expect(aim({ point: { x: 119, y: 50 } })).toMatchObject({
      kind: 'insert',
      index: 1,
      beside: { id: 'b', side: 'before' }
    })
    expect(aim({ point: { x: 181, y: 50 } })).toMatchObject({
      kind: 'insert',
      index: 2,
      beside: { id: 'b', side: 'after' }
    })
  })

  it('swaps from just inside the edges', () => {
    expect(aim({ point: { x: 121, y: 50 } })).toEqual({ kind: 'swap', id: 'b' })
    expect(aim({ point: { x: 179, y: 50 } })).toEqual({ kind: 'swap', id: 'b' })
  })

  it('does nothing near the edges of the cell being dragged', () => {
    expect(aim({ active: 'b', point: { x: 110, y: 50 } })).toBeNull()
  })

  it('does nothing over nothing', () => {
    expect(aim({ hover: null })).toBeNull()
  })

  it('inserts before a cell from its left half', () => {
    expect(aim({ inserting: true, point: { x: 120, y: 50 } })).toEqual({
      kind: 'insert',
      container: 'grid',
      index: 1,
      beside: { id: 'b', side: 'before' }
    })
  })

  it('inserts after a cell from its right half', () => {
    expect(aim({ inserting: true, point: { x: 180, y: 50 } })).toMatchObject({
      index: 2,
      beside: { id: 'b', side: 'after' }
    })
  })

  it('counts positions without the cell being dragged', () => {
    expect(aim({ active: 'a', inserting: true, point: { x: 180, y: 150 } })).toMatchObject({
      index: 3,
      beside: { id: 'd', side: 'after' }
    })
  })

  it('takes the nearest position from an empty area', () => {
    const hover = { id: 'grid', container: 'grid' as const, isCell: false }
    expect(aim({ hover, point: { x: 40, y: 400 } })).toMatchObject({
      index: 3,
      beside: { id: 'c', side: 'after' }
    })
  })

  it('starts an empty container', () => {
    const hover = { id: 'grid', container: 'grid' as const, isCell: false }
    expect(aim({ hover, board: { tray: ['t1'], grid: [] } })).toEqual({
      kind: 'insert',
      container: 'grid',
      index: 0
    })
  })
})
