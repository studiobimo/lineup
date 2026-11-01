import { createStore } from 'zustand/vanilla'

import {
  addToTray,
  clear,
  type Container,
  move,
  moveAll,
  remove,
  sameBoard,
  shuffle,
  swap
} from './board'
import { type Board, type BoardStore, emptyBoard, type ImageRecord } from './board-store'
import type { ProcessedImage } from './process-image'

const HISTORY_LIMIT = 50

export interface PlannerState {
  board: Board
  images: Record<string, ImageRecord>
  past: Board[]
  future: Board[]
  ready: boolean
  /** Only the active tab writes or purges (ADR-0010). */
  session: 'starting' | 'active' | 'elsewhere'
  /** The last write to the store failed: what is on screen may not survive a reload. */
  saveFailed: boolean
  load(): Promise<void>
  suspend(): void
  addImages(images: ProcessedImage[]): Promise<void>
  move(id: string, to: Container, index?: number): void
  swap(first: string, second: string): void
  moveAll(from: Container): void
  shuffle(container: Container): void
  remove(ids: string[]): void
  clear(containers: Container[]): void
  undo(): void
  redo(): void
}

export function createPlannerStore(boardStore: BoardStore) {
  return createStore<PlannerState>((set, get) => {
    const report = (write: Promise<unknown>) =>
      write.then(
        () => set({ saveFailed: false }),
        () => set({ saveFailed: true })
      )

    /** An image stays until no snapshot can bring it back, which is what makes undo exact. */
    const purge = () => {
      const { board, past, future, images } = get()
      const reachable = new Set(
        [board, ...past, ...future].flatMap(({ tray, grid }) => [...tray, ...grid])
      )
      const gone = Object.keys(images).filter((id) => !reachable.has(id))
      if (gone.length === 0) return
      set({
        images: Object.fromEntries(Object.entries(images).filter(([id]) => reachable.has(id)))
      })
      void report(boardStore.deleteImages(gone))
    }

    /** Every change to the board comes through here, so every change can be undone. */
    const commit = (next: Board) => {
      const { board, past, session } = get()
      if (session !== 'active' || sameBoard(board, next)) return
      set({ board: next, past: [...past, board].slice(-HISTORY_LIMIT), future: [] })
      void report(boardStore.saveBoard(next))
      purge()
    }

    return {
      board: emptyBoard,
      images: {},
      past: [],
      future: [],
      ready: false,
      session: 'starting',
      saveFailed: false,

      async load() {
        const [stored, records] = await Promise.all([
          boardStore.loadBoard(),
          boardStore.listImages()
        ])
        const images = Object.fromEntries(records.map((record) => [record.id, record]))
        const known = (id: string) => id in images
        set({
          board: { tray: stored.tray.filter(known), grid: stored.grid.filter(known) },
          images,
          past: [],
          future: [],
          ready: true,
          session: 'active'
        })
        // Undo history does not outlive a reload yet, so nothing can reach what the board does not.
        purge()
      },

      suspend: () => set({ session: 'elsewhere' }),

      async addImages(added) {
        if (get().session !== 'active') return
        const createdAt = new Date().toISOString()
        const stored = added.map((image) => ({ ...image, id: crypto.randomUUID(), createdAt }))
        await Promise.all(stored.map((image) => boardStore.putImage(image)))
        const records = stored.map(({ id, width, height }) => ({ id, width, height, createdAt }))
        set(({ images }) => ({
          images: { ...images, ...Object.fromEntries(records.map((r) => [r.id, r])) }
        }))
        commit(
          addToTray(
            get().board,
            records.map(({ id }) => id)
          )
        )
      },

      move: (id, to, index) => commit(move(get().board, id, to, index)),
      swap: (first, second) => commit(swap(get().board, first, second)),
      moveAll: (from) => commit(moveAll(get().board, from)),
      shuffle: (container) => commit(shuffle(get().board, container)),
      remove: (ids) => commit(remove(get().board, ids)),
      clear: (containers) => commit(clear(get().board, containers)),

      undo() {
        const { board, past, future, session } = get()
        const previous = past.at(-1)
        if (!previous || session !== 'active') return
        set({ board: previous, past: past.slice(0, -1), future: [board, ...future] })
        void report(boardStore.saveBoard(previous))
      },

      redo() {
        const { board, past, future, session } = get()
        const [next, ...rest] = future
        if (!next || session !== 'active') return
        set({ board: next, past: [...past, board], future: rest })
        void report(boardStore.saveBoard(next))
      }
    }
  })
}
