import { describe, expect, it } from 'vitest'

import {
  addToTray,
  cellsThatCrossed,
  clear,
  coverOf,
  freeCells,
  group,
  groupProblem,
  imagesOf,
  imagesOn,
  inBoardOrder,
  isLocked,
  keepLocked,
  move,
  moveAll,
  moveCells,
  remove,
  reorderAlbum,
  sameBoard,
  shuffle,
  swap,
  takeFromAlbum,
  toggleLock,
  ungroup,
  withKnownImages
} from './board'
import type { Board } from './board-store'

const board = { tray: ['a', 'b'], grid: ['c', 'd', 'e'] }

describe('locked cells', () => {
  const locked = { tray: ['a'], grid: ['b', 'c', 'd', 'e'], locked: ['c'] }

  it('stay at their index when the cells around them change order', () => {
    const reversed = { ...locked, grid: ['e', 'd', 'c', 'b'] }
    expect(keepLocked(locked, reversed).grid).toEqual(['e', 'c', 'd', 'b'])
  })

  it('stay in the grid when moved, cleared or deleted', () => {
    expect(keepLocked(locked, moveAll(locked, 'grid'))).toEqual({
      ...locked,
      tray: ['a', 'b', 'd', 'e'],
      grid: ['c']
    })
    expect(keepLocked(locked, move(locked, 'c', 'tray')).grid).toEqual(locked.grid)
    expect(keepLocked(locked, clear(locked, ['grid'])).grid).toEqual(['c'])
    expect(keepLocked(locked, remove(locked, ['c']))).toEqual(locked)
  })

  it('leave no hole when the grid gets shorter', () => {
    const board = { tray: [], grid: ['a', 'b', 'c', 'd'], locked: ['d', 'b'] }
    expect(keepLocked(board, remove(board, ['a', 'c'])).grid).toEqual(['b', 'd'])
  })

  it('lets new cells flow past them', () => {
    const arrived = move(locked, 'a', 'grid')
    expect(keepLocked(locked, arrived).grid).toEqual(['b', 'c', 'd', 'e', 'a'])
  })

  it('changes nothing on a board with none', () => {
    const shuffled = { ...board, grid: ['e', 'd', 'c'] }
    expect(keepLocked(board, shuffled)).toBe(shuffled)
  })

  it('only locks cells in the grid, and a second toggle unlocks', () => {
    expect(toggleLock(board, 'a')).toBe(board)
    const once = toggleLock(board, 'c')
    expect(isLocked(once, 'c')).toBe(true)
    expect(freeCells(once, 'grid')).toEqual(['d', 'e'])
    expect(isLocked(toggleLock(once, 'c'), 'c')).toBe(false)
  })

  it('count as a change to the board', () => {
    expect(sameBoard(board, toggleLock(board, 'c'))).toBe(false)
    expect(sameBoard(board, { ...board, locked: [] })).toBe(true)
  })
})

describe('board operations', () => {
  it('finds the cells that changed container, and no others', () => {
    const before = { tray: ['a', 'b'], grid: ['c', 'd'] }
    expect(cellsThatCrossed(before, { tray: ['b', 'a'], grid: ['d', 'c'] })).toEqual([])
    expect(cellsThatCrossed(before, { tray: ['b', 'c'], grid: ['a', 'd'] }).sort()).toEqual([
      'a',
      'c'
    ])
    expect(cellsThatCrossed(before, { tray: ['b'], grid: ['c', 'd'] })).toEqual([])
  })

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

describe('moving several cells', () => {
  const board: Board = { tray: ['a', 'b', 'c'], grid: ['d', 'e'] }

  it('keeps their order on the board, whatever order they were chosen in', () => {
    expect(moveCells(board, ['c', 'a'], 'grid')).toEqual({
      tray: ['b'],
      grid: ['d', 'e', 'a', 'c']
    })
  })

  it('leaves alone those already there', () => {
    expect(moveCells(board, ['a', 'd'], 'grid')).toEqual({
      tray: ['b', 'c'],
      grid: ['d', 'e', 'a']
    })
  })
})

describe('a board with an album', () => {
  const albums = { album: ['b', 'c'] }
  const board: Board = { tray: ['a', 'album'], grid: ['d'], albums }

  it('knows the images in a cell, and its cover', () => {
    expect(imagesOf(board, 'album')).toEqual(['b', 'c'])
    expect(imagesOf(board, 'a')).toEqual(['a'])
    expect(coverOf(board, 'album')).toBe('b')
    expect(imagesOn(board)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps the album through a move, a swap and a shuffle', () => {
    expect(move(board, 'album', 'grid').albums).toEqual(albums)
    expect(swap(board, 'album', 'd')).toMatchObject({ tray: ['a', 'd'], grid: ['album'], albums })
    expect(shuffle(board, 'tray', () => 0).albums).toEqual(albums)
  })

  it('lets the album go with its cell', () => {
    expect(remove(board, ['album']).albums).toEqual({})
    expect(clear(board, ['tray']).albums).toEqual({})
    expect(clear(board, ['grid']).albums).toEqual(albums)
    expect(board.albums).toEqual(albums)
  })

  it('tells boards apart by their albums alone', () => {
    const reordered = { ...board, albums: { album: ['c', 'b'] } }
    expect(sameBoard(board, reordered)).toBe(false)
    expect(sameBoard(board, { ...board, albums: { album: ['b', 'c'] } })).toBe(true)
    expect(sameBoard({ tray: [], grid: [] }, { tray: [], grid: [], albums: {} })).toBe(true)
  })

  it('drops an image a store no longer has, and an album left with one is that image', () => {
    const big: Board = { tray: ['album'], grid: [], albums: { album: ['a', 'b', 'c'] } }
    const without = (gone: string[]) => withKnownImages(big, (id) => !gone.includes(id))
    expect(without(['b'])).toMatchObject({ tray: ['album'], albums: { album: ['a', 'c'] } })
    expect(without(['b', 'c'])).toMatchObject({ tray: ['a'], albums: {} })
    expect(without(['a', 'b', 'c']).tray).toEqual([])
  })

  it('leaves a board that never had an album as it was', () => {
    const plain: Board = { tray: ['a'], grid: ['b'], locked: ['b'] }
    expect(withKnownImages(plain, () => true)).toEqual(plain)
    expect(withKnownImages(plain, () => true)).not.toHaveProperty('albums')
  })
})

describe('grouping', () => {
  const board: Board = { tray: ['a', 'b', 'c'], grid: ['d'] }

  it('puts the album where the first cell was, with the images in order', () => {
    expect(group(board, ['b', 'd', 'a'], 'album')).toEqual({
      tray: ['album', 'c'],
      grid: [],
      albums: { album: ['b', 'd', 'a'] }
    })
  })

  it('merges an album that is among the cells', () => {
    const start: Board = { tray: ['one', 'c'], grid: [], albums: { one: ['a', 'b'] } }
    expect(group(start, ['c', 'one'], 'two')).toEqual({
      tray: ['two'],
      grid: [],
      albums: { two: ['c', 'a', 'b'] }
    })
  })

  it('takes cells in board order, tray first, whatever order they were chosen in', () => {
    expect(inBoardOrder(board, ['d', 'c', 'a'])).toEqual(['a', 'c', 'd'])
  })

  it('refuses what would not be a valid carousel, and says why', () => {
    const full: Board = {
      tray: ['album', 'a', 'b'],
      grid: ['locked'],
      locked: ['locked'],
      albums: { album: Array.from({ length: 19 }, (_, index) => `image-${index}`) }
    }
    expect(groupProblem(full, ['a'])).toBe('tooFew')
    expect(groupProblem(full, ['a', 'locked'])).toBe('locked')
    expect(groupProblem(full, ['album', 'a'])).toBeNull()
    expect(groupProblem(full, ['album', 'a', 'b'])).toBe('tooMany')
  })
})

describe('editing an album', () => {
  const board: Board = { tray: ['x', 'album', 'y'], grid: [], albums: { album: ['a', 'b', 'c'] } }

  it('reorders it, which changes the cover', () => {
    const next = reorderAlbum(board, 'album', ['c', 'a', 'b'])
    expect(coverOf(next, 'album')).toBe('c')
    expect(next.tray).toEqual(board.tray)
  })

  it('puts an image taken out beside the album', () => {
    expect(takeFromAlbum(board, 'album', 'b')).toEqual({
      tray: ['x', 'album', 'b', 'y'],
      grid: [],
      albums: { album: ['a', 'c'] }
    })
  })

  it('dissolves when the last image but one comes out', () => {
    const pair: Board = { tray: ['x', 'album'], grid: [], albums: { album: ['a', 'b'] } }
    expect(takeFromAlbum(pair, 'album', 'a')).toEqual({
      tray: ['x', 'b', 'a'],
      grid: [],
      albums: {}
    })
  })

  it('ungroups into cells at its position, in order', () => {
    expect(ungroup(board, 'album')).toEqual({
      tray: ['x', 'a', 'b', 'c', 'y'],
      grid: [],
      albums: {}
    })
  })
})
