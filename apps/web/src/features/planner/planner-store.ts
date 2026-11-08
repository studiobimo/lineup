import { createStore, type StoreApi } from 'zustand/vanilla'

import type { ImageColour } from '@/features/autosort/colour'
import { sortByColour, type SortStrategy } from '@/features/autosort/sort'

import {
  addToTray,
  clear,
  type Container,
  coverOf,
  group,
  groupProblem,
  holdsCell,
  imagesOf,
  imagesOn,
  keepLocked,
  keepPosted,
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
import type { Backup } from './backup'
import { boardJournal, type BoardJournal } from './board-journal'
import type { CellPost } from './board-schema'
import { type Board, type BoardStore, emptyBoard, type ImageRecord, toRecord } from './board-store'
import type { ProcessedImage } from './process-image'

const HISTORY_LIMIT = 50

interface ImageImport {
  add(images: ProcessedImage[]): Promise<void>
  finish(): void
}

export interface PlannerState {
  board: Board
  images: Record<string, ImageRecord>
  past: Board[]
  future: Board[]
  ready: boolean
  loadFailed: boolean
  session: 'starting' | 'active' | 'elsewhere' | 'folder'
  saveFailed: boolean
  load(): Promise<void>
  opened(): Promise<boolean>
  retrySave(): void
  suspend(): void
  addImages(images: ProcessedImage[]): Promise<void>
  beginImport(): ImageImport
  move(id: string, to: Container, index?: number): void
  swap(first: string, second: string): void
  moveAll(from: Container): void
  moveCells(ids: string[], to: Container): void
  group(cells: string[]): string | undefined
  ungroup(album: string): void
  reorderAlbum(album: string, images: string[]): void
  takeFromAlbum(album: string, image: string): void
  shuffle(container: Container): void
  sortByColour(container: Container, strategy: SortStrategy): Promise<void>
  setColour(id: string, colour: ImageColour): void
  toggleLock(id: string): void
  linkPost(cell: string, post: CellPost): void
  updatePosts(changes: Record<string, CellPost | undefined>): void
  restore(backup: Backup): Promise<void>
  remove(ids: string[]): void
  clear(containers: Container[]): void
  undo(): void
  redo(): void
}

const placedIn = (boards: Board[]) => new Set(boards.flatMap(imagesOn))

type Set = (
  partial: Partial<PlannerState> | ((state: PlannerState) => Partial<PlannerState>)
) => void
type Get = () => PlannerState

interface Context {
  set: Set
  get: Get
  subscribe: StoreApi<PlannerState>['subscribe']
  boardStore: BoardStore
  journal: BoardJournal
  staged: globalThis.Set<string>
  loads: { latest: number }
  report: (write: Promise<unknown>) => Promise<unknown>
  save: () => void
  purge: () => void
  record: (next: Board) => void
  commit: (proposed: Board) => void
}

function plannerContext(
  set: Set,
  get: Get,
  subscribe: Context['subscribe'],
  boardStore: BoardStore,
  journal: BoardJournal
): Context {
  let savesUnderWay = 0
  const staged = new globalThis.Set<string>()
  const report = (write: Promise<unknown>) => write.catch(() => set({ saveFailed: true }))

  const purge = () => {
    const { board, past, future, images } = get()
    const reachable = placedIn([board, ...past, ...future])
    const gone = Object.keys(images).filter((id) => !reachable.has(id) && !staged.has(id))
    if (gone.length === 0) return
    const removed = new globalThis.Set(gone)
    set({
      images: Object.fromEntries(Object.entries(images).filter(([id]) => !removed.has(id)))
    })
    void report(boardStore.deleteImages(gone))
  }

  const save = () => {
    const { board, past, future } = get()
    journal.write(board)
    savesUnderWay += 1
    void Promise.all([boardStore.saveBoard(board), boardStore.saveHistory({ past, future })]).then(
      () => {
        savesUnderWay -= 1
        if (savesUnderWay > 0) return
        journal.clear()
        set({ saveFailed: false })
      },
      () => {
        savesUnderWay -= 1
        set({ saveFailed: true })
      }
    )
  }

  const record = (next: Board) => {
    const { board, past, session } = get()
    if (session !== 'active' || sameBoard(board, next)) return
    set({ board: next, past: [...past, board].slice(-HISTORY_LIMIT), future: [] })
    save()
    purge()
  }

  const commit = (proposed: Board) => record(keepLocked(get().board, proposed))

  return {
    set,
    get,
    subscribe,
    boardStore,
    journal,
    staged,
    loads: { latest: 0 },
    report,
    save,
    purge,
    record,
    commit
  }
}

async function readSaved({ boardStore }: Context) {
  return Promise.all([
    boardStore.loadBoard(),
    boardStore.listImages(),
    boardStore.loadHistory()
  ]).catch(() => null)
}

async function loadBoard(context: Context) {
  const { set, journal, staged, loads, save, purge } = context
  const thisLoad = ++loads.latest
  set({ loadFailed: false })
  const reading = await readSaved(context)
  if (thisLoad !== loads.latest) return
  if (!reading) {
    set({ loadFailed: true })
    return
  }
  const [storedBoard, records, history] = reading
  const images = Object.fromEntries(records.map((record) => [record.id, record]))
  const known = (id: string) => id in images
  const present = (saved: Board) => withKnownImages(saved, known)
  const stored = present(storedBoard)
  const future = history.future.map(present)
  let board = stored
  let past = history.past.map(present)
  const step = (next: Board) => {
    past = [...past, board].slice(-HISTORY_LIMIT)
    board = next
  }

  const unsaved = journal.read()
  if (unsaved && imagesOn(unsaved).every(known)) {
    if (!sameBoard(unsaved, board)) step(unsaved)
  }
  const placed = placedIn([board, ...past, ...future])
  const stranded = records.map(({ id }) => id).filter((id) => !placed.has(id) && !staged.has(id))
  if (stranded.length > 0) step(addToTray(board, stranded))

  set({ board, images, past, future, ready: true, session: 'active' })
  if (board === stored) journal.clear()
  else save()
  purge()
}

const sessionSlice = (
  context: Context
): Pick<PlannerState, 'load' | 'opened' | 'retrySave' | 'suspend'> => {
  const { set, get, subscribe, loads, save } = context
  return {
    load: () => loadBoard(context),

    opened() {
      const settled = ({ session, loadFailed }: PlannerState) =>
        session !== 'starting' || loadFailed
      const isActive = ({ session }: PlannerState) => session === 'active'
      if (settled(get())) return Promise.resolve(isActive(get()))
      return new Promise((resolve) => {
        const stop = subscribe((state) => {
          if (!settled(state)) return
          stop()
          resolve(isActive(state))
        })
      })
    },

    retrySave() {
      if (get().session === 'active') save()
    },

    suspend() {
      loads.latest += 1
      set({ session: 'elsewhere' })
    }
  }
}

async function storeBatch({ set, get, boardStore, staged }: Context, added: ProcessedImage[]) {
  if (!(await get().opened())) throw new Error('This board is not open here')
  const createdAt = new Date().toISOString()
  const batch = added.map((image) => ({ ...image, id: crypto.randomUUID(), createdAt }))
  for (const { id } of batch) staged.add(id)
  const puts = await Promise.allSettled(batch.map((image) => boardStore.putImage(image)))
  const records = batch.filter((_, index) => puts[index].status === 'fulfilled').map(toRecord)
  batch.forEach(({ id }, index) => {
    if (puts[index].status === 'rejected') staged.delete(id)
  })
  set(({ images }) => ({
    images: { ...images, ...Object.fromEntries(records.map((r) => [r.id, r])) }
  }))
  const rejected = puts.find((put): put is PromiseRejectedResult => put.status === 'rejected')
  return { stored: records.map(({ id }) => id), rejected }
}

const importSlice = (context: Context): Pick<PlannerState, 'beginImport' | 'addImages'> => {
  const { get, staged, commit } = context
  return {
    beginImport() {
      const stored: string[] = []
      let failure: { reason: unknown } | undefined

      return {
        async add(added) {
          const batch = await storeBatch(context, added)
          stored.push(...batch.stored)
          if (!batch.rejected) return
          failure ??= { reason: batch.rejected.reason }
          throw batch.rejected.reason
        },

        finish() {
          for (const id of stored) staged.delete(id)
          commit(addToTray(get().board, stored))
          if (failure) throw failure.reason
        }
      }
    },

    async addImages(added) {
      const adding = get().beginImport()
      try {
        await adding.add(added)
      } finally {
        adding.finish()
      }
    }
  }
}

const arrangeSlice = ({
  get,
  commit
}: Context): Pick<
  PlannerState,
  | 'move'
  | 'swap'
  | 'moveAll'
  | 'moveCells'
  | 'group'
  | 'ungroup'
  | 'reorderAlbum'
  | 'takeFromAlbum'
  | 'shuffle'
  | 'toggleLock'
  | 'remove'
  | 'clear'
> => ({
  move: (id, to, index) => commit(move(get().board, id, to, index)),
  swap: (first, second) => commit(swap(get().board, first, second)),
  moveAll: (from) => commit(moveAll(get().board, from)),
  moveCells: (ids, to) => commit(moveCells(get().board, ids, to)),

  group(cells) {
    const { board } = get()
    if (groupProblem(board, cells)) return undefined
    const album = crypto.randomUUID()
    commit(group(board, cells, album))
    return album
  },

  ungroup: (album) => commit(ungroup(get().board, album)),
  reorderAlbum: (album, images) => commit(reorderAlbum(get().board, album, images)),
  takeFromAlbum: (album, image) => commit(takeFromAlbum(get().board, album, image)),

  shuffle: (container) => commit(shuffle(get().board, container)),
  toggleLock: (id) => commit(toggleLock(get().board, id)),
  remove: (ids) => commit(remove(get().board, ids)),
  clear: (containers) => commit(clear(get().board, containers))
})

const colourSlice = ({
  set,
  get,
  boardStore,
  report,
  commit
}: Context): Pick<PlannerState, 'sortByColour' | 'setColour'> => ({
  async sortByColour(container, strategy) {
    const { board, images } = get()
    const cells = board[container].map((id) => ({ ...images[coverOf(board, id)], id }))
    const order = await sortByColour(cells, strategy)
    if (get().board === board) commit({ ...board, [container]: order })
  },

  setColour(id, colour) {
    const { images } = get()
    if (!images[id]) return
    set({ images: { ...images, [id]: { ...images[id], colour } } })
    void report(boardStore.setColour(id, colour))
  }
})

const postSlice = ({
  set,
  get,
  boardStore,
  save,
  purge,
  record
}: Context): Pick<PlannerState, 'linkPost' | 'updatePosts' | 'restore'> => ({
  linkPost(cell, post) {
    const { board, past, future, session } = get()
    if (session !== 'active') return
    const images = imagesOf(board, cell)
    const holding = (snapshot: Board) => holdsCell(snapshot, cell, images)
    set({
      board: { ...board, posts: { ...board.posts, [cell]: post } },
      past: past.filter(holding),
      future: future.filter(holding)
    })
    save()
    purge()
  },

  updatePosts(changes) {
    const { board, session } = get()
    if (session !== 'active') return
    const posts = { ...board.posts, ...changes }
    for (const cell of Object.keys(changes)) if (!posts[cell]) delete posts[cell]
    const next = { ...board, posts: posts as Board['posts'] }
    if (sameBoard(board, next)) return
    set({ board: next })
    save()
  },

  async restore({ board, images }) {
    if (get().session !== 'active') return
    for (const image of images) await boardStore.putImage(image)
    const records = images.map(toRecord)
    set(({ images: known }) => ({
      images: { ...known, ...Object.fromEntries(records.map((image) => [image.id, image])) }
    }))
    record(board)
  }
})

const historySlice = ({ set, get, save }: Context): Pick<PlannerState, 'undo' | 'redo'> => ({
  undo() {
    const { board, past, future, session } = get()
    const previous = past.at(-1)
    if (!previous || session !== 'active') return
    set({
      board: keepPosted(board, previous),
      past: past.slice(0, -1),
      future: [board, ...future]
    })
    save()
  },

  redo() {
    const { board, past, future, session } = get()
    const [next, ...rest] = future
    if (!next || session !== 'active') return
    set({ board: keepPosted(board, next), past: [...past, board], future: rest })
    save()
  }
})

export function createPlannerStore(boardStore: BoardStore, journal: BoardJournal = boardJournal) {
  return createStore<PlannerState>((set, get, store) => {
    const context = plannerContext(set, get, store.subscribe, boardStore, journal)
    return {
      board: emptyBoard,
      images: {},
      past: [],
      future: [],
      ready: false,
      loadFailed: false,
      session: 'starting',
      saveFailed: false,
      ...sessionSlice(context),
      ...importSlice(context),
      ...arrangeSlice(context),
      ...colourSlice(context),
      ...postSlice(context),
      ...historySlice(context)
    }
  })
}
