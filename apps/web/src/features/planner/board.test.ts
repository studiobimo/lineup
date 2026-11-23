import { describe, expect, it } from 'vitest'

import {
  adjacent,
  addToTray,
  cellOf,
  cellsThatCrossed,
  flightsBetween,
  clear,
  coverOf,
  freeCells,
  group,
  groupProblem,
  holdsCell,
  imagesOf,
  imagesOn,
  neighbour,
  inBoardOrder,
  isLocked,
  keepLocked,
  keepPosted,
  move,
  moveAll,
  moveCells,
  moveToStart,
  outOfOrder,
  remove,
  reorderAlbum,
  sameBoard,
  shuffle,
  swap,
  takeFromAlbum,
  toggleLock,
  ungroup,
  withKnownImages,
  withoutImages,
  publishedCells
} from './board'
import type { CellPost } from './board-schema'
import type { Board } from './board-store'

const board = { tray: ['a', 'b'], grid: ['c', 'd', 'e'] }

describe('adjacent', () => {
  it('is the item one step along, or undefined at the ends', () => {
    expect(adjacent(['a', 'b', 'c'], 'b', -1)).toBe('a')
    expect(adjacent(['a', 'b', 'c'], 'b', 1)).toBe('c')
    expect(adjacent(['a', 'b', 'c'], 'a', -1)).toBeUndefined()
    expect(adjacent(['a', 'b', 'c'], 'c', 1)).toBeUndefined()
  })
})

describe('neighbour', () => {
  const board = { tray: ['a'], grid: ['b', 'c', 'd', 'e'], locked: ['c'] }

  it('is the next cell along, either way', () => {
    expect(neighbour(board, 'd', 1)).toBe('e')
    expect(neighbour(board, 'e', -1)).toBe('d')
  })

  it('passes over a locked cell, which keeps its place', () => {
    expect(neighbour(board, 'b', 1)).toBe('d')
    expect(neighbour(board, 'd', -1)).toBe('b')
  })

  it('stops at the ends', () => {
    expect(neighbour(board, 'b', -1)).toBeUndefined()
    expect(neighbour(board, 'e', 1)).toBeUndefined()
    expect(neighbour(board, 'a', 1)).toBeUndefined()
  })
})

describe('locked cells', () => {
  const locked = { tray: ['a'], grid: ['b', 'c', 'd', 'e'], locked: ['c'] }

  it('stay at their index when the cells around them change order', () => {
    const reversed = { ...locked, grid: ['e', 'd', 'c', 'b'] }
    expect(keepLocked(locked, reversed).grid).toEqual(['e', 'c', 'd', 'b'])
  })

  it('stay in the grid when moved, cleared or deleted', () => {
    expect(keepLocked(locked, moveAll(locked, 'grid'))).toEqual({
      ...locked,
      tray: ['b', 'd', 'e', 'a'],
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

describe('a locked album', () => {
  const album = {
    tray: [],
    grid: ['album', 'c'],
    locked: ['album'],
    albums: { album: ['a', 'b'] }
  }

  it('keeps its images when the board around it is cleared or the cell removed', () => {
    expect(keepLocked(album, clear(album, ['grid']))).toMatchObject({
      grid: ['album'],
      albums: { album: ['a', 'b'] }
    })
    expect(keepLocked(album, remove(album, ['album']))).toEqual(album)
  })
})

const postFor = (scheduledFor: string): CellPost => ({
  id: `post-${scheduledFor}`,
  accountId: 'account',
  scheduledFor,
  timeZone: 'Europe/London',
  caption: '',
  status: 'scheduled'
})

describe('a cell with a post', () => {
  const posted: Board = {
    tray: ['a'],
    grid: ['b', 'c', 'd'],
    posts: { c: postFor('2030-01-01T10:00:00Z') }
  }

  it('is locked, by the same rule as a cell the user locked', () => {
    expect(isLocked(posted, 'c')).toBe(true)
    expect(isLocked(posted, 'b')).toBe(false)
    expect(freeCells(posted, 'grid')).toEqual(['b', 'd'])
    expect(groupProblem(posted, ['b', 'c'])).toBe('locked')
    expect(keepLocked(posted, moveAll(posted, 'grid')).grid).toEqual(['c'])
    expect(keepLocked(posted, remove(posted, ['c']))).toEqual(posted)
  })

  it('cannot have its lock taken off', () => {
    expect(toggleLock(posted, 'c')).toBe(posted)
  })

  it('goes with the image, and stays for as long as the image does', () => {
    const present = withKnownImages(posted, (image) => image !== 'b')
    expect(present.posts).toEqual(posted.posts)
    const gone = withKnownImages(posted, (image) => image !== 'c')
    expect(gone.posts).toEqual({})
  })

  it('tells boards apart, so that a journal holding only a new post is not missed', () => {
    expect(sameBoard(posted, { ...posted, posts: undefined })).toBe(false)
  })

  describe('under a snapshot', () => {
    const before: Board = { tray: ['c'], grid: ['d', 'b', 'a'] }

    it('keeps today’s post and place, and the rest of the arrangement goes back', () => {
      expect(keepPosted(posted, before)).toMatchObject({
        tray: [],
        grid: ['d', 'c', 'b', 'a'],
        posts: posted.posts
      })
    })

    it('drops a post that has since gone from the snapshot', () => {
      expect(keepPosted({ tray: [], grid: ['c'] }, posted).posts).toBeUndefined()
    })

    it('keeps a posted album that the snapshot did not have', () => {
      const today: Board = {
        tray: [],
        grid: ['album'],
        albums: { album: ['a', 'b'] },
        posts: { album: postFor('2030-01-01T10:00:00Z') }
      }
      expect(keepPosted(today, { tray: ['a', 'b'], grid: [] }).albums).toEqual(today.albums)
    })
  })

  it('knows the snapshots that hold it unchanged', () => {
    const album: Board = { tray: [], grid: ['x'], albums: { x: ['a', 'b'] } }
    expect(holdsCell(album, 'x', ['a', 'b'])).toBe(true)
    expect(holdsCell(album, 'x', ['b', 'a'])).toBe(false)
    expect(holdsCell({ tray: ['x'], grid: [] }, 'x', ['x'])).toBe(false)
  })
})

describe('publishing order', () => {
  const newer = '2030-01-03T10:00:00Z'
  const older = '2030-01-01T10:00:00Z'
  const planned: Board = {
    tray: [],
    grid: ['first', 'cell', 'last'],
    posts: { first: postFor(newer), last: postFor(older) }
  }

  it('is kept by a time between the cells around it', () => {
    expect(outOfOrder(planned, 'cell', '2030-01-02T10:00:00Z')).toBe(false)
  })

  it('is broken by a time after a cell above, or before a cell below', () => {
    expect(outOfOrder(planned, 'cell', '2030-01-04T10:00:00Z')).toBe(true)
    expect(outOfOrder(planned, 'cell', '2029-12-31T10:00:00Z')).toBe(true)
  })

  it('has nothing to say about a cell with no post around it', () => {
    expect(outOfOrder({ tray: [], grid: ['cell'] }, 'cell', newer)).toBe(false)
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

  it('sends a tray cell to the start of the grid', () => {
    expect(moveToStart(board, ['a'], 'grid')).toEqual({
      tray: ['b'],
      grid: ['a', 'c', 'd', 'e']
    })
  })

  it('sends a grid cell to the start of the tray, the same way', () => {
    expect(moveToStart(board, ['d'], 'tray')).toEqual({
      tray: ['d', 'a', 'b'],
      grid: ['c', 'e']
    })
  })

  it('starts after the locked and posted cells, which keep their places', () => {
    const posted = {
      tray: ['a'],
      grid: ['b', 'c', 'd'],
      posts: { b: postFor('2030-01-01T10:00:00Z') }
    }
    expect(moveToStart(posted, ['a'], 'grid').grid).toEqual(['b', 'a', 'c', 'd'])
    const locked = { tray: ['a'], grid: ['b', 'c'], locked: ['b'] }
    expect(moveToStart(locked, ['a'], 'grid').grid).toEqual(['b', 'a', 'c'])
  })

  it('appends when every grid cell is locked or the grid is empty', () => {
    expect(moveToStart({ tray: ['a'], grid: ['b'], locked: ['b'] }, ['a'], 'grid').grid).toEqual([
      'b',
      'a'
    ])
    expect(moveToStart({ tray: ['a'], grid: [] }, ['a'], 'grid').grid).toEqual(['a'])
  })

  it('swaps within a container and between them', () => {
    expect(swap(board, 'c', 'e').grid).toEqual(['e', 'd', 'c'])
    expect(swap(board, 'a', 'd')).toEqual({ tray: ['d', 'b'], grid: ['c', 'a', 'e'] })
  })

  it('moves the tray to the start of the grid, in tray order, ahead of the planned cells', () => {
    expect(moveAll(board, 'tray')).toEqual({ tray: [], grid: ['a', 'b', 'c', 'd', 'e'] })
    const locked = { tray: ['a', 'b'], grid: ['c', 'd'], locked: ['c'] }
    expect(moveAll(locked, 'tray')).toEqual({ tray: [], grid: ['c', 'a', 'b', 'd'], locked: ['c'] })
  })

  it('moves the grid to the start of the tray, keeping the order', () => {
    expect(moveAll(board, 'grid')).toEqual({ tray: ['c', 'd', 'e', 'a', 'b'], grid: [] })
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

  it('sends them to the start of the grid in tray order, whatever order they were chosen in', () => {
    expect(moveCells(board, ['c', 'a'], 'grid')).toEqual({
      tray: ['b'],
      grid: ['a', 'c', 'd', 'e']
    })
  })

  it('starts after a locked cell, which keeps its place', () => {
    const locked: Board = { tray: ['a', 'b', 'c'], grid: ['d', 'e'], locked: ['d'] }
    expect(moveCells(locked, ['c', 'a'], 'grid').grid).toEqual(['d', 'a', 'c', 'e'])
  })

  it('sends them to the start of the tray, in grid order, the same as a single cell', () => {
    const planned = { tray: ['a'], grid: ['b', 'c', 'd'] }
    expect(moveCells(planned, ['d', 'b'], 'tray')).toEqual({ tray: ['b', 'd', 'a'], grid: ['c'] })
    expect(moveToStart(planned, ['b'], 'tray')).toEqual({ tray: ['b', 'a'], grid: ['c', 'd'] })
  })

  it('leaves alone those already there', () => {
    expect(moveCells(board, ['a', 'd'], 'grid')).toEqual({
      tray: ['b', 'c'],
      grid: ['a', 'd', 'e']
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

describe('an album moves as one', () => {
  const albums = { album: ['b', 'c'] }
  const board: Board = { tray: ['a', 'album'], grid: ['d', 'e'], albums }
  const images = ['a', 'b', 'c', 'd', 'e']
  const everyImage = (next: Board) => expect(imagesOn(next).sort()).toEqual(images)

  it.each<[string, (start: Board) => Board]>([
    ['swap', (start) => swap(start, 'album', 'd')],
    ['insert', (start) => move(start, 'album', 'grid', 1)],
    ['move across', (start) => move(start, 'album', 'grid')],
    ['move several', (start) => moveCells(start, ['a', 'album'], 'grid')],
    ['move all', (start) => moveAll(start, 'tray')],
    ['shuffle', (start) => shuffle(start, 'tray', () => 0)]
  ])('through a %s', (_, change) => {
    const next = change(board)
    everyImage(next)
    expect(next.albums).toEqual(albums)
    expect([...next.tray, ...next.grid].filter((cell) => cell === 'album')).toHaveLength(1)
    expect([...next.tray, ...next.grid]).toHaveLength(4)
  })

  it('holds its place when it is locked, whatever happens around it', () => {
    const locked = toggleLock(move(board, 'album', 'grid', 0), 'album')
    const next = keepLocked(
      locked,
      shuffle(locked, 'grid', () => 0.9)
    )
    expect(next.grid[0]).toBe('album')
    expect(isLocked(next, 'album')).toBe(true)
  })

  it('finds the cell an image is in', () => {
    expect(cellOf(board, 'c')).toBe('album')
    expect(cellOf(board, 'a')).toBe('a')
  })
})

describe('flightsBetween', () => {
  const board = { tray: ['a', 'b', 'c'], grid: ['d'] }

  it('sends each cell of a new album to it, carrying its own picture', () => {
    expect(flightsBetween(board, group(board, ['a', 'c'], 'album'))).toEqual([
      { from: 'a', to: 'album', image: 'a' },
      { from: 'c', to: 'album', image: 'c' }
    ])
  })

  it('deals an album back out, and undoing a group is the same thing', () => {
    const grouped = group(board, ['a', 'c'], 'album')
    expect(flightsBetween(grouped, board)).toEqual([
      { from: 'album', to: 'a', image: 'a' },
      { from: 'album', to: 'c', image: 'c' }
    ])
  })

  it('moves an album that joins another with the picture on its cover', () => {
    const grouped = group(board, ['a', 'b'], 'first')
    expect(flightsBetween(grouped, group(grouped, ['c', 'first'], 'second'))).toEqual([
      { from: 'first', to: 'second', image: 'a' },
      { from: 'c', to: 'second', image: 'c' }
    ])
  })

  it('follows a cell to the other container, and lets a deleted one go', () => {
    const moved = { tray: ['b', 'c'], grid: ['d', 'a'] }
    expect(flightsBetween(board, moved)).toEqual([{ from: 'a', to: 'a', image: 'a' }])
    expect(flightsBetween(board, { tray: ['b', 'c'], grid: ['d'] })).toEqual([])
  })
})

describe('a published cell', () => {
  const post = {
    id: 'post',
    accountId: 'account',
    scheduledFor: '2030-01-01T10:00:00.000Z',
    timeZone: 'Europe/London',
    caption: ''
  }

  it('is found by the status of its post alone', () => {
    const posts = {
      c: { ...post, status: 'published' as const },
      d: { ...post, status: 'scheduled' as const },
      e: { ...post, status: 'failed' as const }
    }
    expect(publishedCells({ ...board, posts })).toEqual(['c'])
    expect(publishedCells(board)).toEqual([])
  })

  it('goes with its images, from a step that held it as loose cells or in an album', () => {
    const step = { tray: ['a'], grid: ['b', 'c', 'd'], albums: { x: ['b', 'c'] }, posts: undefined }
    expect(withoutImages({ ...step, grid: ['x', 'd'] }, ['b', 'c'])).toEqual({
      tray: ['a'],
      grid: ['d'],
      albums: {}
    })
    expect(withoutImages(step, ['b', 'c']).grid).toEqual(['d'])
  })
})
