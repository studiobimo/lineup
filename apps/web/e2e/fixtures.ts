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

/** Adds the least Exif that says when a photo was taken, `taken` as `YYYY:MM:DD HH:MM:SS`. */
export function withCaptureDate(jpeg: Buffer, taken: string) {
  const tiff = Buffer.alloc(64)
  tiff.write('II', 0, 'latin1')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    tiff.writeUInt16LE(1, at)
    tiff.writeUInt16LE(tag, at + 2)
    tiff.writeUInt16LE(type, at + 4)
    tiff.writeUInt32LE(count, at + 6)
    tiff.writeUInt32LE(value, at + 10)
  }
  entry(8, 0x8769, 4, 1, 26)
  entry(26, 0x9003, 2, 20, 44)
  tiff.write(taken, 44, 'latin1')
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
}

export interface SavedImage {
  id: string
  colour?: { dominant: { hue: number }; tone: number }
  takenAt?: string
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

export const savedGridSize = (page: Page) => savedBoard(page).then(({ grid }) => grid.length)

/** A write outlives the click that started it, so reloading straight away can lose it. */
export async function reloadWhenSaved(page: Page, saved: (board: SavedBoard) => boolean) {
  await expect.poll(async () => saved(await savedBoard(page))).toBe(true)
  await page.reload()
}
