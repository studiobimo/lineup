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
