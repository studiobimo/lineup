/// <reference lib="dom" />

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { type ConsoleMessage, expect, type Page, test } from '@playwright/test'

// A 2 x 2 PNG, so these run through the real decoder and the real worker.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4zwAE/xkgFAAb8gP91pbyKwAAAABJRU5ErkJggg==',
  'base64'
)
const image = (name: string) => ({ name, mimeType: 'image/png', buffer: png })

function watchErrors(page: Page) {
  const errors: string[] = []
  const record = (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text())
  }
  page.on('console', record)
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

const addImages = (page: Page, files: Parameters<Page['setInputFiles']>[1]) =>
  page.getByLabel('Add images').setInputFiles(files)

// A board is written as soon as it changes, but a reload can still beat the write.
const savedGridSize = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const opening = indexedDB.open('lineup')
        opening.onsuccess = () => {
          const reading = opening.result.transaction('board').objectStore('board').get('current')
          reading.onsuccess = () => {
            opening.result.close()
            resolve((reading.result as { grid: string[] }).grid.length)
          }
        }
      })
  )

test('imports, arranges, undoes and comes back after a reload', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')

  await addImages(page, [
    image('one.png'),
    image('two.png'),
    image('three.png'),
    { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') }
  ])

  const images = page.getByRole('img')
  await expect(images).toHaveCount(3)
  await expect(page.getByText('1 image could not be read.')).toBeVisible()
  // An empty canvas is 300 wide, and it counts as an image before anything is drawn.
  await expect(images.first()).toHaveJSProperty('width', 2)

  await page.getByRole('button', { name: 'Move to the grid' }).first().click()
  const grid = page.locator('section')
  await expect(grid.getByRole('img')).toHaveCount(1)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(grid.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(grid.getByRole('img')).toHaveCount(1)

  await expect.poll(() => savedGridSize(page)).toBe(1)
  await page.reload()
  await expect(images).toHaveCount(3)
  await expect(grid.getByRole('img')).toHaveJSProperty('width', 2)

  expect(errors).toEqual([])
})

test('one tab at a time changes a board', async ({ context, page }) => {
  await page.goto('/')
  await addImages(page, [image('one.png'), image('two.png')])
  await expect(page.getByRole('img')).toHaveCount(2)

  const notice = 'This board is open in another tab'
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.getByRole('heading', { name: notice })).toBeVisible()
  await expect(second.getByRole('img')).toHaveCount(0)

  // Opening a second tab must not have touched the first one's board or its images.
  await page.getByRole('button', { name: 'Delete' }).first().click()
  await expect(page.getByRole('img')).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('img')).toHaveCount(2)

  await second.getByRole('button', { name: 'Use it here' }).click()
  await expect(second.getByRole('img')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: notice })).toBeVisible()

  await second.close()
  await expect(page.getByRole('img')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
})

// Builds real files in the page, because a drop or a paste can only be dispatched from inside it.
const fileData = (page: Page, base64: string, names: string[]) =>
  page.evaluateHandle(
    ([data, list]) => {
      const bytes = Uint8Array.from(atob(data as string), (char) => char.charCodeAt(0))
      const transfer = new DataTransfer()
      for (const name of list as string[]) {
        const type = name.endsWith('.png') ? 'image/png' : 'text/plain'
        transfer.items.add(new File([bytes], name, { type }))
      }
      return transfer
    },
    [base64, names]
  )

test('dropping files shows the overlay and adds the images, with one note on the rest', async ({
  page
}) => {
  await page.goto('/')
  const data = await fileData(page, png.toString('base64'), ['a.png', 'b.png', 'notes.txt'])

  await page.dispatchEvent('html', 'dragenter', { dataTransfer: data })
  await expect(page.getByText('Drop to add to the tray')).toBeVisible()

  await page.dispatchEvent('html', 'drop', { dataTransfer: data })
  await expect(page.getByText('Drop to add to the tray')).toBeHidden()
  await expect(page.getByRole('img')).toHaveCount(2)
  await expect(page.getByText('1 file was not an image.')).toBeVisible()
})

test('pasting an image adds it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()
  const data = await fileData(page, png.toString('base64'), ['pasted.png'])
  // dispatchEvent sends a paste as a plain Event, which would drop clipboardData.
  await data.evaluate((clipboardData) => {
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData }))
  })
  await expect(page.getByRole('img')).toHaveCount(1)
})

// What a full device does to a write, so the app's own handling of it runs for real.
const fillStorage = (page: Page) =>
  page.evaluateHandle(() => {
    const { put } = IDBObjectStore.prototype
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    return () => {
      IDBObjectStore.prototype.put = put
    }
  })

test('a full device is explained, and the next import still works', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()
  const free = await fillStorage(page)

  await addImages(page, [image('one.png')])
  await expect(page.getByText('This device is out of room for images')).toBeVisible()
  await expect(page.getByRole('img')).toHaveCount(0)

  await free.evaluate((restore) => restore())
  await addImages(page, [image('two.png')])
  await expect(page.getByRole('img')).toHaveCount(1)
})

test('a save that fails is reported until one goes through', async ({ page }) => {
  await page.goto('/')
  await addImages(page, [image('one.png'), image('two.png')])
  await expect(page.getByRole('img')).toHaveCount(2)
  const free = await fillStorage(page)

  await page.getByRole('button', { name: 'Move to the grid' }).first().click()
  const warning = page.getByText('Your latest changes are not saved yet')
  await expect(warning).toBeVisible()

  await free.evaluate((restore) => restore())
  await page.getByRole('button', { name: 'Move to the grid' }).first().click()
  await expect(warning).toBeHidden()
  await expect.poll(() => savedGridSize(page)).toBe(2)
})

test('adding a folder takes the images in it and its subfolders', async ({ page }, testInfo) => {
  const folder = testInfo.outputPath('holiday')
  mkdirSync(join(folder, 'day two'), { recursive: true })
  writeFileSync(join(folder, 'one.png'), png)
  writeFileSync(join(folder, 'notes.txt'), 'not an image')
  writeFileSync(join(folder, 'day two', 'two.png'), png)

  await page.goto('/')
  await page.getByLabel('Add a folder').setInputFiles(folder)

  await expect(page.getByRole('img')).toHaveCount(2)
})
