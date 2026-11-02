import type { Board } from './board-store'
import { instagram } from './network-profile'

export type Container = 'tray' | 'grid'

/** The images in a cell: its album's, or the one image it is. */
export const imagesOf = (board: Board, cell: string) => board.albums?.[cell] ?? [cell]

/** What a cell shows, and what it sorts by. An album's first image is its cover. */
export const coverOf = (board: Board, cell: string) => imagesOf(board, cell)[0]

/** The cell an image is in: the album that holds it, or its own. */
export function cellOf(board: Board, image: string) {
  const album = Object.entries(board.albums ?? {}).find(([, images]) => images.includes(image))
  return album?.[0] ?? image
}

/** Every image a board holds, in albums or not, which is not the same as every cell. */
export const imagesOn = (board: Board) =>
  [...board.tray, ...board.grid].flatMap((cell) => imagesOf(board, cell))

const postedCells = (board: Board) => Object.keys(board.posts ?? {})

/** The cells that hold their place: those the user locked, and those with a post. */
const lockedCells = (board: Board) => new Set([...(board.locked ?? []), ...postedCells(board)])

/**
 * An album belongs to the board only while a cell holds it. Snapshots keep their own. A locked cell
 * counts as held even when a change took it, because `keepLocked` is about to put it back.
 */
function withoutLooseAlbums(board: Board): Board {
  if (!board.albums) return board
  const placed = new Set([...board.tray, ...board.grid, ...lockedCells(board)])
  const albums = Object.entries(board.albums).filter(([id]) => placed.has(id))
  return { ...board, albums: Object.fromEntries(albums) }
}

/** Every operation returns a new board, so a snapshot in the history can never change. */
export function addToTray(board: Board, ids: string[]): Board {
  return { ...board, tray: [...ids, ...board.tray] }
}

function locate(board: Board, id: string) {
  const container: Container = board.tray.includes(id) ? 'tray' : 'grid'
  return { container, index: board[container].indexOf(id) }
}

function lift(board: Board, ids: string[]): Board {
  const gone = new Set(ids)
  return {
    ...board,
    tray: board.tray.filter((id) => !gone.has(id)),
    grid: board.grid.filter((id) => !gone.has(id))
  }
}

export const remove = (board: Board, ids: string[]) => withoutLooseAlbums(lift(board, ids))

/** Inserts `id` before `index`, and shifts the rest. With no index, it goes last. */
export function move(board: Board, id: string, to: Container, index?: number): Board {
  const without = lift(board, [id])
  const cells = [...without[to]]
  cells.splice(index ?? cells.length, 0, id)
  return { ...without, [to]: cells }
}

/** Those not already in `to`, in their order on the board, after what is there. */
export function moveCells(board: Board, ids: string[], to: Container): Board {
  const chosen = new Set(ids)
  const from = to === 'tray' ? board.grid : board.tray
  const moving = from.filter((id) => chosen.has(id))
  return { ...lift(board, moving), [to]: [...board[to], ...moving] }
}

/** Why these cells cannot become one album, if they cannot. */
export function groupProblem(board: Board, cells: string[]) {
  if (cells.length < 2) return 'tooFew'
  if (cells.some((cell) => isLocked(board, cell))) return 'locked'
  const images = cells.flatMap((cell) => imagesOf(board, cell))
  return images.length > instagram.carouselLimit ? 'tooMany' : null
}

/** The album takes the first cell's place. An album among the cells gives up its images, in order. */
export function group(board: Board, cells: string[], album: string): Board {
  const [first, ...rest] = cells
  const { container } = locate(board, first)
  const without = lift(board, rest)
  const merged = new Set(cells)
  const albums = Object.entries(board.albums ?? {}).filter(([id]) => !merged.has(id))
  return {
    ...without,
    [container]: without[container].map((cell) => (cell === first ? album : cell)),
    albums: {
      ...Object.fromEntries(albums),
      [album]: cells.flatMap((cell) => imagesOf(board, cell))
    }
  }
}

function replaceCell(board: Board, cell: string, cells: string[]) {
  const { container, index } = locate(board, cell)
  const next = [...board[container]]
  next.splice(index, 1, ...cells)
  return { ...board, [container]: next }
}

function withoutAlbum(board: Board, album: string) {
  const albums = Object.entries(board.albums ?? {}).filter(([id]) => id !== album)
  return { ...board, albums: Object.fromEntries(albums) }
}

/** The images go back as cells in the album's place, in order. */
export function ungroup(board: Board, album: string) {
  return replaceCell(withoutAlbum(board, album), album, imagesOf(board, album))
}

export function reorderAlbum(board: Board, album: string, images: string[]): Board {
  return { ...board, albums: { ...board.albums, [album]: images } }
}

/** The image goes beside the album, as a cell. An album left with one image stops being one. */
export function takeFromAlbum(board: Board, album: string, image: string) {
  const rest = imagesOf(board, album).filter((id) => id !== image)
  if (rest.length === 1) return replaceCell(withoutAlbum(board, album), album, [...rest, image])
  return reorderAlbum(replaceCell(board, album, [album, image]), album, rest)
}

/** The cells in the order they sit on the board, tray first, however they were chosen. */
export function inBoardOrder(board: Board, cells: string[]) {
  const chosen = new Set(cells)
  return [...board.tray, ...board.grid].filter((cell) => chosen.has(cell))
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

/**
 * Every cell that goes somewhere when a board changes: over to the other container, into an album,
 * or out of one. `image` is the picture it carries on the way. An undo is a change like any other.
 */
export function flightsBetween(before: Board, after: Board) {
  const placed = ({ tray, grid }: Board) => new Set([...tray, ...grid])
  const was = placed(before)
  const is = placed(after)
  const carrying = (cell: string, to: string) => ({ from: cell, to, image: coverOf(before, cell) })
  const crossed = cellsThatCrossed(before, after).map((cell) => carrying(cell, cell))
  const gathered = [...was]
    .filter((cell) => !is.has(cell))
    .map((cell) => carrying(cell, cellOf(after, coverOf(before, cell))))
    .filter(({ to }) => after.albums?.[to])
  const dealt = [...is]
    .filter((cell) => !was.has(cell) && was.has(cellOf(before, cell)))
    .map((cell) => ({ from: cellOf(before, cell), to: cell, image: cell }))
  return [...crossed, ...gathered, ...dealt]
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
  return withoutLooseAlbums(
    containers.reduce((next, container) => ({ ...next, [container]: [] }), board)
  )
}

export const isLocked = (board: Board, id: string) =>
  board.posts?.[id] !== undefined || (board.locked?.includes(id) ?? false)

/** The cells that sorting, shuffling, moving and clearing can touch. */
export function freeCells(board: Board, container: Container) {
  const locked = lockedCells(board)
  return board[container].filter((id) => !locked.has(id))
}

/** The images a clear would take: an album counts for all it holds, a locked cell for nothing. */
export const imagesIn = (board: Board, container: Container) =>
  freeCells(board, container).flatMap((cell) => imagesOf(board, cell))

/** Only the grid has positions to hold: a cell in the tray is not placed yet. */
export function toggleLock(board: Board, id: string): Board {
  if (!board.grid.includes(id) || board.posts?.[id]) return board
  const locked = new Set(board.locked)
  if (!locked.delete(id)) locked.add(id)
  return { ...board, locked: [...locked] }
}

/**
 * Whatever a change did, locked cells go back to their index in the grid and the rest flows around
 * them. A grid has no holes, so a lock past the end of a shorter grid moves up to the last cell.
 */
export const keepLocked = (before: Board, after: Board) =>
  holdCells(before, after, lockedCells(after))

function holdCells(before: Board, after: Board, held: Set<string>): Board {
  if (held.size === 0) return after
  const free = (container: Container) => after[container].filter((id) => !held.has(id))
  const grid = free('grid')
  before.grid.forEach((id, index) => {
    if (held.has(id)) grid.splice(index, 0, id)
  })
  return { ...after, tray: free('tray'), grid }
}

/** A snapshot under today's posts: undo restores the arrangement, and a post is not part of it. */
export function keepPosted(today: Board, snapshot: Board): Board {
  const { posts, albums } = today
  if (!posts) return { ...snapshot, posts }
  const posted = Object.entries(albums ?? {}).filter(([cell]) => posts[cell])
  const restored = {
    ...snapshot,
    posts,
    albums: { ...snapshot.albums, ...Object.fromEntries(posted) }
  }
  return holdCells(today, restored, new Set(postedCells(today)))
}

/** Whether a snapshot has this cell as it is now, so undoing to it cannot take a post apart. */
export function holdsCell(snapshot: Board, cell: string, images: string[]) {
  const held = imagesOf(snapshot, cell)
  return (
    snapshot.grid.includes(cell) &&
    held.length === images.length &&
    held.every((image, index) => image === images[index])
  )
}

/** Whether a time would publish this cell out of the grid's order, whose first cell is newest. */
export function outOfOrder(board: Board, cell: string, time: string) {
  const at = board.grid.indexOf(cell)
  const when = Date.parse(time)
  return board.grid.some((other, index) => {
    const post = other !== cell && board.posts?.[other]
    if (!post) return false
    const then = Date.parse(post.scheduledFor)
    return index < at ? then < when : then > when
  })
}

/** The board less whatever `known` says is gone. An album down to one image is that image. */
export function withKnownImages(board: Board, known: (image: string) => boolean): Board {
  const albums: Record<string, string[]> = {}
  const keep = (cell: string) => {
    const images = imagesOf(board, cell).filter(known)
    if (!board.albums?.[cell] || images.length < 2) return images
    albums[cell] = images
    return [cell]
  }
  const tray = board.tray.flatMap(keep)
  const grid = board.grid.flatMap(keep)
  const placed = new Set([...tray, ...grid])
  return {
    tray,
    grid,
    locked: board.locked?.filter((cell) => placed.has(cell)),
    ...(board.albums && { albums }),
    ...(board.posts && {
      posts: Object.fromEntries(Object.entries(board.posts).filter(([cell]) => placed.has(cell)))
    })
  }
}

export function sameBoard(a: Board, b: Board) {
  const same = (x: string[] = [], y: string[] = []) =>
    x.length === y.length && x.every((id, index) => id === y[index])
  const sameAlbums = () => {
    const [first, second] = [a.albums ?? {}, b.albums ?? {}]
    const ids = Object.keys(first)
    return (
      ids.length === Object.keys(second).length && ids.every((id) => same(first[id], second[id]))
    )
  }
  return (
    same(a.tray, b.tray) &&
    same(a.grid, b.grid) &&
    same(a.locked, b.locked) &&
    sameAlbums() &&
    JSON.stringify(a.posts) === JSON.stringify(b.posts)
  )
}
