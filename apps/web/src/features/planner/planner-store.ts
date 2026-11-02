import { createStore } from 'zustand/vanilla'

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
  /** Stores a batch. The images reach the board only at `finish`, so the import is one undo step. */
  add(images: ProcessedImage[]): Promise<void>
  /** Puts everything that was stored in the tray, and throws the first error that stopped any. */
  finish(): void
}

export interface PlannerState {
  board: Board
  images: Record<string, ImageRecord>
  past: Board[]
  future: Board[]
  ready: boolean
  /** The board could not be read, so nothing can be shown or safely saved over it. */
  loadFailed: boolean
  /** Only the active tab writes or purges (ADR-0010). `folder`: its folder cannot open yet. */
  session: 'starting' | 'active' | 'elsewhere' | 'folder'
  /** A write failed. The board is safe in the journal, and `retrySave` writes it again. */
  saveFailed: boolean
  load(): Promise<void>
  /** Whether the board opened in this tab, for what can arrive first: a drop as the page loads. */
  opened(): Promise<boolean>
  retrySave(): void
  suspend(): void
  addImages(images: ProcessedImage[]): Promise<void>
  /** For an import too large to hold at once: store batches as they come, then `finish` once. */
  beginImport(): ImageImport
  move(id: string, to: Container, index?: number): void
  swap(first: string, second: string): void
  moveAll(from: Container): void
  moveCells(ids: string[], to: Container): void
  /** The album's id, or nothing if `groupProblem` has a reason to refuse. */
  group(cells: string[]): string | undefined
  ungroup(album: string): void
  reorderAlbum(album: string, images: string[]): void
  takeFromAlbum(album: string, image: string): void
  shuffle(container: Container): void
  sortByColour(container: Container, strategy: SortStrategy): Promise<void>
  /** Not a change to the board, so it is no part of undo. */
  setColour(id: string, colour: ImageColour): void
  toggleLock(id: string): void
  /**
   * A post exists now, whatever undo does, so the steps from before its cell was as it is go.
   * Like every change to a post, this is no part of the history (ADR-0018).
   */
  linkPost(cell: string, post: CellPost): void
  /** The latest on each post, by cell. Nothing in place of a post frees its cell. */
  updatePosts(changes: Record<string, CellPost | undefined>): void
  /** One undo step, so the board it replaced is still there. */
  restore(backup: Backup): Promise<void>
  remove(ids: string[]): void
  clear(containers: Container[]): void
  undo(): void
  redo(): void
}

const placedIn = (boards: Board[]) => new Set(boards.flatMap(imagesOn))

export function createPlannerStore(boardStore: BoardStore, journal: BoardJournal = boardJournal) {
  return createStore<PlannerState>((set, get, store) => {
    // A later load, or another tab taking over, makes what an earlier load read out of date.
    let latestLoad = 0
    let savesUnderWay = 0
    // Stored by an import that has not finished, so on no board yet, but not to be purged.
    const staged = new Set<string>()

    const report = (write: Promise<unknown>) => write.catch(() => set({ saveFailed: true }))

    /** An image stays until no snapshot can bring it back, which is what makes undo exact. */
    const purge = () => {
      const { board, past, future, images } = get()
      const reachable = placedIn([board, ...past, ...future])
      const gone = Object.keys(images).filter((id) => !reachable.has(id) && !staged.has(id))
      if (gone.length === 0) return
      const removed = new Set(gone)
      set({
        images: Object.fromEntries(Object.entries(images).filter(([id]) => !removed.has(id)))
      })
      void report(boardStore.deleteImages(gone))
    }

    const save = () => {
      const { board, past, future } = get()
      journal.write(board)
      savesUnderWay += 1
      void Promise.all([
        boardStore.saveBoard(board),
        boardStore.saveHistory({ past, future })
      ]).then(
        () => {
          savesUnderWay -= 1
          // A later save has a newer board in the journal, and only the last may clear it.
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

    /** Every change to the board comes through here, so every change can be undone. */
    const record = (next: Board) => {
      const { board, past, session } = get()
      if (session !== 'active' || sameBoard(board, next)) return
      set({ board: next, past: [...past, board].slice(-HISTORY_LIMIT), future: [] })
      save()
      purge()
    }

    const commit = (proposed: Board) => record(keepLocked(get().board, proposed))

    return {
      board: emptyBoard,
      images: {},
      past: [],
      future: [],
      ready: false,
      loadFailed: false,
      session: 'starting',
      saveFailed: false,

      async load() {
        const thisLoad = ++latestLoad
        set({ loadFailed: false })
        const reading = await Promise.all([
          boardStore.loadBoard(),
          boardStore.listImages(),
          boardStore.loadHistory()
        ]).catch(() => null)
        if (thisLoad !== latestLoad) return
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

        // Each is a step of its own, so that what comes back can still be undone.
        const unsaved = journal.read()
        if (unsaved && imagesOn(unsaved).every(known)) {
          if (!sameBoard(unsaved, board)) step(unsaved)
        }
        // Stored but on no board: an import stopped, or the board's own file was lost.
        const placed = placedIn([board, ...past, ...future])
        const stranded = records.map(({ id }) => id).filter((id) => !placed.has(id))
        if (stranded.length > 0) step(addToTray(board, stranded))

        set({ board, images, past, future, ready: true, session: 'active' })
        if (board === stored) journal.clear()
        else save()
        purge()
      },

      opened() {
        const settled = ({ session, loadFailed }: PlannerState) =>
          session !== 'starting' || loadFailed
        const isActive = ({ session }: PlannerState) => session === 'active'
        if (settled(get())) return Promise.resolve(isActive(get()))
        return new Promise((resolve) => {
          const stop = store.subscribe((state) => {
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
        latestLoad += 1
        set({ session: 'elsewhere' })
      },

      beginImport() {
        const stored: string[] = []
        let failure: { reason: unknown } | undefined

        return {
          async add(added) {
            if (!(await get().opened())) throw new Error('This board is not open here')
            const createdAt = new Date().toISOString()
            const batch = added.map((image) => ({ ...image, id: crypto.randomUUID(), createdAt }))
            for (const { id } of batch) staged.add(id)
            const puts = await Promise.allSettled(batch.map((image) => boardStore.putImage(image)))
            const records = batch
              .filter((_, index) => puts[index].status === 'fulfilled')
              .map(toRecord)
            batch.forEach(({ id }, index) => {
              if (puts[index].status === 'rejected') staged.delete(id)
            })
            set(({ images }) => ({
              images: { ...images, ...Object.fromEntries(records.map((r) => [r.id, r])) }
            }))
            stored.push(...records.map(({ id }) => id))
            const rejected = puts.find(
              (put): put is PromiseRejectedResult => put.status === 'rejected'
            )
            if (!rejected) return
            failure ??= { reason: rejected.reason }
            // Stops the import here, since a full disk will fail the rest the same way.
            throw rejected.reason
          },

          finish() {
            for (const id of stored) staged.delete(id)
            commit(addToTray(get().board, stored))
            // After the board, so that the images that made it are kept whatever stopped the rest.
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
      },

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
        // One at a time, so that a large backup is never all in memory on its way to the store.
        for (const image of images) await boardStore.putImage(image)
        const records = images.map(toRecord)
        set(({ images: known }) => ({
          images: { ...known, ...Object.fromEntries(records.map((image) => [image.id, image])) }
        }))
        // Exactly the backup's board, so its locks are not held to where this one's were.
        record(board)
      },

      async sortByColour(container, strategy) {
        const { board, images } = get()
        const cells = board[container].map((id) => ({ ...images[coverOf(board, id)], id }))
        const order = await sortByColour(cells, strategy)
        // An order for a board that has since moved on would undo whatever moved it.
        if (get().board === board) commit({ ...board, [container]: order })
      },

      setColour(id, colour) {
        const { images } = get()
        if (!images[id]) return
        set({ images: { ...images, [id]: { ...images[id], colour } } })
        void report(boardStore.setColour(id, colour))
      },
      remove: (ids) => commit(remove(get().board, ids)),
      clear: (containers) => commit(clear(get().board, containers)),

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
    }
  })
}
