import { z } from 'zod'

import { imagesOn } from './board'
import { boardSchema, imageRecordSchema } from './board-schema'
import type { Board, BoardStore, ImageRecord, StoredImage } from './board-store'

// The file format is in ADR-0013. A signature, the manifest's length and the manifest come first,
// and then every image's bytes, which the manifest finds by offset from where they start.
const SIGNATURE = 'LINEUPBK'
const HEADER_BYTES = SIGNATURE.length + Uint32Array.BYTES_PER_ELEMENT
// 1 had no albums, and reads as a board that has none.
const FORMAT_VERSION = 2
const READABLE_VERSIONS = [1, FORMAT_VERSION] as const
const IMAGE_TYPE = 'image/jpeg'

const span = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])

const manifestSchema = z.object({
  version: z.literal(READABLE_VERSIONS),
  board: boardSchema,
  images: z.array(imageRecordSchema.extend({ thumbnail: span, publish: span }))
})

type Manifest = z.infer<typeof manifestSchema>

export interface Backup {
  board: Board
  images: StoredImage[]
}

type BackupSource = Pick<BoardStore, 'listImages' | 'getThumbnail' | 'getPublishCopy'>

/**
 * One file, of any size, with no image in memory: a Blob made of Blobs only refers to them. The
 * history stays behind, so an image only a past step could bring back is not in the file.
 */
export async function createBackup(store: BackupSource, board: Board) {
  const onBoard = new Set(imagesOn(board))
  const records = (await store.listImages()).filter(({ id }) => onBoard.has(id))
  const bytes: Blob[] = []
  let offset = 0
  const add = (blob: Blob | undefined, { id }: ImageRecord): [number, number] => {
    if (!blob) throw new Error(`Image ${id} has lost its bytes`)
    bytes.push(blob)
    offset += blob.size
    return [offset - blob.size, blob.size]
  }

  const images: Manifest['images'] = []
  for (const record of records) {
    const thumbnail = add(await store.getThumbnail(record.id), record)
    const publish = add(await store.getPublishCopy(record.id), record)
    images.push({ ...record, thumbnail, publish })
  }

  // Parsed, so that what a store knows beyond the format, such as a file's name, stays behind.
  const manifest = new TextEncoder().encode(
    JSON.stringify(manifestSchema.parse({ version: FORMAT_VERSION, board, images }))
  )
  const length = new DataView(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT))
  length.setUint32(0, manifest.length, true)
  return new Blob([SIGNATURE, length, manifest, ...bytes], { type: 'application/octet-stream' })
}

/** Throws on anything that is not a whole backup. The images stay in the file until they are put. */
export async function readBackup(file: Blob): Promise<Backup> {
  const header = await file.slice(0, HEADER_BYTES).arrayBuffer()
  const signature = new TextDecoder().decode(header.slice(0, SIGNATURE.length))
  if (signature !== SIGNATURE) throw new Error('Not a backup')
  const length = new DataView(header).getUint32(SIGNATURE.length, true)
  const bytesStart = HEADER_BYTES + length

  const { version, board, images } = manifestSchema.parse(
    JSON.parse(await file.slice(HEADER_BYTES, bytesStart).text())
  )
  const slice = ([offset, size]: [number, number], type = IMAGE_TYPE) => {
    const start = bytesStart + offset
    if (start + size > file.size) throw new Error(`Cut short, in a version ${version} backup`)
    return file.slice(start, start + size, type)
  }
  // A video's publish copy is the video itself (ADR-0022).
  const stored = images.map(({ thumbnail, publish, ...record }) => ({
    ...record,
    thumbnail: slice(thumbnail),
    publish: slice(publish, record.video?.type)
  }))

  const known = new Set(images.map(({ id }) => id))
  if (!imagesOn(board).every((id) => known.has(id))) {
    throw new Error('The board names an image the file does not hold')
  }
  return { board, images: stored }
}
