import { type ConsoleMessage, expect, type FileChooser, type Page } from '@playwright/test'

// A 2 x 2 PNG, so these run through the real decoder and the real worker.
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4zwAE/xkgFAAb8gP91pbyKwAAAABJRU5ErkJggg==',
  'base64'
)

export const image = (name: string) => ({ name, mimeType: 'image/png', buffer: png })

type Chosen = Parameters<FileChooser['setFiles']>[0]

export async function choose(page: Page, button: string, files: Chosen) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: button }).click()
  await (await chooser).setFiles(files)
}

export const addImages = (page: Page, files: Chosen) => choose(page, 'Add images', files)

interface PhotoFacts {
  /** As Exif writes it: `YYYY:MM:DD HH:MM:SS`. */
  taken: string
  /** Whole degrees, north and west, which is all a test needs. */
  north: number
  west: number
}

/** Adds the least Exif that says when and where a photo was taken. */
export function withExif(jpeg: Buffer, { taken, north, west }: PhotoFacts) {
  const tiff = Buffer.alloc(200)
  const [ASCII, LONG, RATIONAL] = [2, 4, 5]
  const [exifAt, gpsAt, takenAt, latitudeAt, longitudeAt] = [38, 56, 112, 132, 156]
  const directory = (at: number, entries: [number, number, number, number][]) => {
    tiff.writeUInt16LE(entries.length, at)
    for (const [index, [tag, type, count, value]] of entries.entries()) {
      const entry = at + 2 + index * 12
      tiff.writeUInt16LE(tag, entry)
      tiff.writeUInt16LE(type, entry + 2)
      tiff.writeUInt32LE(count, entry + 4)
      tiff.writeUInt32LE(value, entry + 8)
    }
  }
  const degrees = (at: number, value: number) => {
    tiff.writeUInt32LE(value, at)
    tiff.writeUInt32LE(1, at + 4)
    tiff.writeUInt32LE(1, at + 12)
    tiff.writeUInt32LE(1, at + 20)
  }
  tiff.write('II', 0, 'latin1')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  directory(8, [
    [0x8769, LONG, 1, exifAt],
    [0x8825, LONG, 1, gpsAt]
  ])
  directory(exifAt, [[0x9003, ASCII, 20, takenAt]])
  directory(gpsAt, [
    [1, ASCII, 2, 'N'.charCodeAt(0)],
    [2, RATIONAL, 3, latitudeAt],
    [3, ASCII, 2, 'W'.charCodeAt(0)],
    [4, RATIONAL, 3, longitudeAt]
  ])
  tiff.write(taken, takenAt, 'latin1')
  degrees(latitudeAt, north)
  degrees(longitudeAt, west)
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])
  const segment = Buffer.alloc(4)
  segment.writeUInt16BE(0xffe1, 0)
  segment.writeUInt16BE(body.length + 2, 2)
  return Buffer.concat([jpeg.subarray(0, 2), segment, body, jpeg.subarray(2)])
}

export function watchErrors(page: Page) {
  const errors: string[] = []
  const record = (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text())
  }
  page.on('console', record)
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

export interface SavedBoard {
  tray: string[]
  grid: string[]
  locked?: string[]
  albums?: Record<string, string[]>
}

export interface SavedImage {
  id: string
  colour?: { dominant: { hue: number }; tone: number }
  takenAt?: string
  place?: string
}

/** What a reload would find. On the page it is the store, not what is drawn. */
const readStore = <Saved>(page: Page, store: string, key?: string) =>
  page.evaluate(
    ([store, key]) =>
      new Promise<Saved>((resolve) => {
        const opening = indexedDB.open('lineup')
        opening.onsuccess = () => {
          const records = opening.result.transaction(store).objectStore(store)
          const reading = key ? records.get(key) : records.getAll()
          reading.onsuccess = () => {
            opening.result.close()
            resolve(reading.result as Saved)
          }
        }
      }),
    [store, key] as const
  )

export const savedBoard = (page: Page) => readStore<SavedBoard>(page, 'board', 'current')

export const savedImages = (page: Page) => readStore<SavedImage[]>(page, 'images')

/** A digest of every stored image's bytes, by id, to compare two boards without moving them. */
export const savedBytes = (page: Page, store: 'thumbnails' | 'publishCopies') =>
  page.evaluate(
    (store) =>
      new Promise<Record<string, string>>((resolve) => {
        const opening = indexedDB.open('lineup')
        opening.onsuccess = () => {
          const records = opening.result.transaction(store).objectStore(store)
          const keys = records.getAllKeys()
          const blobs = records.getAll()
          blobs.onsuccess = async () => {
            opening.result.close()
            const digests = await Promise.all(
              (blobs.result as Blob[]).map(async (blob) => {
                const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
                return [...new Uint8Array(digest)].join('.')
              })
            )
            resolve(Object.fromEntries(keys.result.map((key, index) => [key, digests[index]])))
          }
        }
      }),
    store
  )

export const savedGridSize = (page: Page) => savedBoard(page).then(({ grid }) => grid.length)

/** A write outlives the click that started it, so reloading straight away can lose it. */
export async function reloadWhenSaved(page: Page, saved: (board: SavedBoard) => boolean) {
  await expect.poll(async () => saved(await savedBoard(page))).toBe(true)
  await page.reload()
}
