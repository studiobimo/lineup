import { describe, expect, it } from 'vitest'

import { type Box, dropTarget } from './drag-target'

const board = { tray: ['t1'], grid: ['a', 'b', 'c', 'd'] }

// Two columns of 100 x 100 cells: a b, then c d.
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
    boxOf: (id) => boxes[id],
    ...overrides
  })

describe('dropTarget', () => {
  it('swaps with the cell under the pointer', () => {
    expect(aim({})).toEqual({ kind: 'swap', id: 'b' })
  })

  it('does nothing over the cell being dragged', () => {
    expect(aim({ active: 'b' })).toBeNull()
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
