import type { ImageColour } from '@/features/autosort/colour'

import type { CellPost } from './board-schema'
import type { VideoInfo } from './video-frame'

export interface Board {
  tray: string[]
  grid: string[]
  locked?: string[]
  albums?: Record<string, string[]>
  posts?: Record<string, CellPost>
}

export interface ImageRecord {
  id: string
  width: number
  height: number
  createdAt: string
  colour?: ImageColour
  takenAt?: string
  place?: string
  video?: VideoInfo
  fileName?: string
  missing?: boolean
}

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
  original?: Blob
}

export const toRecord = ({
  id,
  width,
  height,
  createdAt,
  colour,
  takenAt,
  place,
  video,
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
  video,
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
  storageUsage(): Promise<StorageUsage>
  requestPersistence(): Promise<boolean>
}

export const emptyBoard: Board = { tray: [], grid: [] }

export const emptyHistory: History = { past: [], future: [] }
