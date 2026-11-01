import type { Board } from './board-store'

export type Container = 'tray' | 'grid'

/** Every operation returns a new board, so a snapshot in the history can never change. */
export function addToTray(board: Board, ids: string[]): Board {
  return { ...board, tray: [...ids, ...board.tray] }
}

function locate(board: Board, id: string) {
  const container: Container = board.tray.includes(id) ? 'tray' : 'grid'
  return { container, index: board[container].indexOf(id) }
}

export function remove(board: Board, ids: string[]): Board {
  const gone = new Set(ids)
  return {
    ...board,
    tray: board.tray.filter((id) => !gone.has(id)),
    grid: board.grid.filter((id) => !gone.has(id))
  }
}

/** Inserts `id` before `index`, and shifts the rest. With no index, it goes last. */
export function move(board: Board, id: string, to: Container, index?: number): Board {
  const without = remove(board, [id])
  const cells = [...without[to]]
  cells.splice(index ?? cells.length, 0, id)
  return { ...without, [to]: cells }
}

export function swap(board: Board, first: string, second: string): Board {
  const a = locate(board, first)
  const b = locate(board, second)
  const next = { ...board, tray: [...board.tray], grid: [...board.grid] }
  next[a.container][a.index] = second
  next[b.container][b.index] = first
  return next
}

/** The cells that sit in a different container in `after`, whichever way they went. */
export const containerOf = (board: Board, id: string): Container =>
  board.tray.includes(id) ? 'tray' : 'grid'

export function cellsThatCrossed(before: Board, after: Board) {
  const wasInTray = new Set(before.tray)
  const wasInGrid = new Set(before.grid)
  return [
    ...after.grid.filter((id) => wasInTray.has(id)),
    ...after.tray.filter((id) => wasInGrid.has(id))
  ]
}

export function moveAll(board: Board, from: Container): Board {
  return from === 'tray'
    ? { ...board, tray: [], grid: [...board.grid, ...board.tray] }
    : { ...board, tray: [...board.tray, ...board.grid], grid: [] }
}

export function shuffle(board: Board, container: Container, random = Math.random): Board {
  const cells = [...board[container]]
  for (let last = cells.length - 1; last > 0; last -= 1) {
    const other = Math.floor(random() * (last + 1))
    ;[cells[last], cells[other]] = [cells[other], cells[last]]
  }
  return { ...board, [container]: cells }
}

export function clear(board: Board, containers: Container[]): Board {
  return containers.reduce((next, container) => ({ ...next, [container]: [] }), board)
}

export const isLocked = (board: Board, id: string) => board.locked?.includes(id) ?? false

/** The cells that sorting, shuffling, moving and clearing can touch. */
export function freeCells(board: Board, container: Container) {
  const locked = new Set(board.locked)
  return board[container].filter((id) => !locked.has(id))
}

/** Only the grid has positions to hold: a cell in the tray is not placed yet. */
export function toggleLock(board: Board, id: string): Board {
  if (!board.grid.includes(id)) return board
  const locked = new Set(board.locked)
  if (!locked.delete(id)) locked.add(id)
  return { ...board, locked: [...locked] }
}

/**
 * Whatever a change did, locked cells go back to their index in the grid and the rest flows around
 * them. A grid has no holes, so a lock past the end of a shorter grid moves up to the last cell.
 */
export function keepLocked(before: Board, after: Board): Board {
  const locked = new Set(after.locked)
  if (locked.size === 0) return after
  const grid = freeCells(after, 'grid')
  before.grid.forEach((id, index) => {
    if (locked.has(id)) grid.splice(index, 0, id)
  })
  return { ...after, tray: freeCells(after, 'tray'), grid }
}

export function sameBoard(a: Board, b: Board) {
  const same = (x: string[] = [], y: string[] = []) =>
    x.length === y.length && x.every((id, index) => id === y[index])
  return same(a.tray, b.tray) && same(a.grid, b.grid) && same(a.locked, b.locked)
}
