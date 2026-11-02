import type { ImageColour } from '@/features/autosort/colour'

import type { CellPost } from './board-schema'

/** A cell is an image's id for now. Albums arrive in M3, with a migration. */
export interface Board {
  tray: string[]
  grid: string[]
  /** Grid cells that hold their position: a post that is already live, say. */
  locked?: string[]
  /** Each album's images, in order, by the id of the cell it fills. Those images are in no cell. */
  albums?: Record<string, string[]>
  /** Each scheduled cell's post at the provider, by cell. Those cells are locked (ADR-0018). */
  posts?: Record<string, CellPost>
}

export interface ImageRecord {
  id: string
  width: number
  height: number
  createdAt: string
  /** Absent until the backfill reaches an image stored before colours were kept (ADR-0004). */
  colour?: ImageColour
  /** Only there if the photo said, and the capture dates setting was on when it was added. */
  takenAt?: string
  /** A city and a country, if the locations setting was on. Coordinates are never kept. */
  place?: string
  /** A folder board's original, by its path in the folder. */
  fileName?: string
  /** Worked out on each load, not stored: that original was not in the folder. */
  missing?: boolean
}

/** Whole boards, oldest first in `past`, so that a step can never be half undone. */
export interface History {
  past: Board[]
  future: Board[]
}

export interface StorageUsage {
  used: number
  quota: number
}

export interface StoredImage extends ImageRecord {
  thumbnail: Blob
  publish: Blob
  /** For a store that keeps originals. A browser board does not, and a backup has none. */
  original?: Blob
}

/**
 * Everything the planner keeps goes through here, and nothing else knows where it lives
 * (ADR-0002). Bytes come out one image at a time and never join the records: application state
 * holds records only, however many images a board has.
 */
/** An image without its bytes, which never join the state or a store's records. */
export const toRecord = ({
  id,
  width,
  height,
  createdAt,
  colour,
  takenAt,
  place,
  fileName,
  missing
}: ImageRecord): ImageRecord => ({
  id,
  width,
  height,
  createdAt,
  colour,
  takenAt,
  place,
  fileName,
  missing
})

export interface BoardStore {
  loadBoard(): Promise<Board>
  saveBoard(board: Board): Promise<void>
  loadHistory(): Promise<History>
  saveHistory(history: History): Promise<void>
  listImages(): Promise<ImageRecord[]>
  putImage(image: StoredImage): Promise<void>
  setColour(id: string, colour: ImageColour): Promise<void>
  getThumbnail(id: string): Promise<Blob | undefined>
  getPublishCopy(id: string): Promise<Blob | undefined>
  deleteImages(ids: string[]): Promise<void>
  /** What this origin uses and may use, in bytes, as the browser estimates it. */
  storageUsage(): Promise<StorageUsage>
  /** Asks the browser not to evict the board. Resolves to whether it agreed. */
  requestPersistence(): Promise<boolean>
}

export const emptyBoard: Board = { tray: [], grid: [] }

export const emptyHistory: History = { past: [], future: [] }
