import { describe, expect, it } from 'vitest'

import { addToTray, clear, move, moveAll, remove, sameBoard, shuffle, swap } from './board'

const board = { tray: ['a', 'b'], grid: ['c', 'd', 'e'] }

describe('board operations', () => {
  it('puts new images at the top of the tray, in the order given', () => {
    expect(addToTray(board, ['x', 'y']).tray).toEqual(['x', 'y', 'a', 'b'])
  })

  it('moves a cell to the other container, last by default', () => {
    expect(move(board, 'a', 'grid')).toEqual({ tray: ['b'], grid: ['c', 'd', 'e', 'a'] })
  })

  it('inserts at a position and shifts the rest', () => {
    expect(move(board, 'a', 'grid', 1)).toEqual({ tray: ['b'], grid: ['c', 'a', 'd', 'e'] })
    expect(move(board, 'e', 'grid', 0).grid).toEqual(['e', 'c', 'd'])
  })

  it('swaps within a container and between them', () => {
    expect(swap(board, 'c', 'e').grid).toEqual(['e', 'd', 'c'])
    expect(swap(board, 'a', 'd')).toEqual({ tray: ['d', 'b'], grid: ['c', 'a', 'e'] })
  })

  it('moves everything at once, keeping the order', () => {
    expect(moveAll(board, 'tray')).toEqual({ tray: [], grid: ['c', 'd', 'e', 'a', 'b'] })
    expect(moveAll(board, 'grid')).toEqual({ tray: ['a', 'b', 'c', 'd', 'e'], grid: [] })
  })

  it('shuffles one container and keeps every cell', () => {
    const shuffled = shuffle(board, 'grid', () => 0)
    expect(shuffled.grid).toEqual(['d', 'e', 'c'])
    expect(shuffled.tray).toEqual(board.tray)
  })

  it('removes cells from either container', () => {
    expect(remove(board, ['a', 'c'])).toEqual({ tray: ['b'], grid: ['d', 'e'] })
  })

  it('clears the containers it is given', () => {
    expect(clear(board, ['tray'])).toEqual({ tray: [], grid: board.grid })
    expect(clear(board, ['tray', 'grid'])).toEqual({ tray: [], grid: [] })
  })

  it('leaves the board it was given alone', () => {
    const before = structuredClone(board)
    swap(board, 'a', 'c')
    move(board, 'a', 'grid', 0)
    shuffle(board, 'grid')
    expect(board).toEqual(before)
  })

  it('tells boards apart by order', () => {
    expect(sameBoard(board, structuredClone(board))).toBe(true)
    expect(sameBoard(board, swap(board, 'a', 'b'))).toBe(false)
  })
})
