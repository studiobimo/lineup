/// <reference lib="dom" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, type Page, test } from '@playwright/test'

import { addImages, savedBoard, type SavedBoard, watchErrors } from './fixtures'

const photo = (name: string) => ({
  name,
  mimeType: 'image/jpeg',
  buffer: readFileSync(join(import.meta.dirname, '../../../test-images', name))
})

// The origin's private file system is a real folder with real handles, which survive a reload in
// IndexedDB as a chosen one does. Only the picker, which a test cannot click, is replaced.
const replacePicker = (page: Page) =>
  page.addInitScript(() => {
    window.showDirectoryPicker = async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('photos', { create: true })
  })

/** Every file in the folder, with its size. */
const folderFiles = (page: Page) =>
  page.evaluate(async () => {
    const found: Record<string, number> = {}
    const walk = async (directory: FileSystemDirectoryHandle, prefix: string) => {
      for await (const [name, handle] of directory.entries()) {
        if (handle.kind === 'directory') {
          await walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`)
        } else if (!name.endsWith('.crswap')) {
          found[`${prefix}${name}`] = await (handle as FileSystemFileHandle)
            .getFile()
            .then(({ size }) => size)
            .catch(() => 0)
        }
      }
    }
    const root = await navigator.storage.getDirectory()
    await walk(await root.getDirectoryHandle('photos'), '')
    return found
  })

/** The board as the folder has it, or null as a write swaps the file in, which outlives a click. */
const folderBoard = (page: Page) =>
  page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const folder = await root.getDirectoryHandle('photos')
    const data = await folder.getDirectoryHandle('.lineup')
    try {
      const file = await (await data.getFileHandle('board.json')).getFile()
      return JSON.parse(await file.text()) as SavedBoard
    } catch {
      return null
    }
  })

const openSettings = (page: Page) => page.getByRole('button', { name: 'Settings' }).click()

async function useFolder(page: Page) {
  await openSettings(page)
  await page.getByRole('button', { name: 'Keep in a folder' }).click()
  await expect(page.getByText('Your board is in photos.')).toBeVisible()
  await page.keyboard.press('Escape')
}

test('a folder keeps the original at full size, and the board comes back', async ({ page }) => {
  const errors = watchErrors(page)
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  const original = photo('01.jpg')
  await addImages(page, [original])
  await expect(page.getByRole('img')).toHaveCount(1)

  await expect.poll(() => folderFiles(page)).toHaveProperty(['01.jpg'], original.buffer.length)
  await expect
    .poll(async () => Object.keys(await folderFiles(page)).sort())
    .toEqual([
      '.lineup/board.json',
      '.lineup/history.json',
      '.lineup/images.json',
      expect.stringMatching(/^\.lineup\/publish\/.+\.jpg$/),
      expect.stringMatching(/^\.lineup\/thumbnails\/.+\.jpg$/),
      '01.jpg'
    ])

  await page.reload()
  await expect(page.getByRole('img')).toHaveCount(1)
  // The browser's own board was never touched.
  expect(await savedBoard(page)).toBeUndefined()

  const later = await page.context().newPage()
  await page.close()
  await later.goto('/')
  await expect(later.getByRole('img')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('an empty folder takes a copy of the board, and undo still works', async ({ page }) => {
  await replacePicker(page)
  await page.goto('/')
  await addImages(page, [photo('01.jpg'), photo('02.jpg')])
  await expect(page.getByRole('img')).toHaveCount(2)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await expect.poll(async () => (await savedBoard(page)).grid.length).toBe(2)

  await useFolder(page)
  await expect(page.locator('section').getByRole('img')).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('section').getByRole('img')).toHaveCount(0)
  await expect.poll(async () => (await folderBoard(page))?.tray.length).toBe(2)
  await page.reload()
  await expect(page.locator('aside').getByRole('img')).toHaveCount(2)
})

test('leaving a folder keeps it, and choosing it again opens its board', async ({ page }) => {
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  await addImages(page, [photo('01.jpg')])
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect.poll(() => folderFiles(page)).toHaveProperty(['01.jpg'])

  await openSettings(page)
  await page.getByRole('button', { name: 'Stop using this folder' }).click()
  await expect(page.getByRole('button', { name: 'Keep in a folder' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('img')).toHaveCount(0)
  expect(await folderFiles(page)).toHaveProperty(['01.jpg'])

  await useFolder(page)
  await expect(page.getByRole('img')).toHaveCount(1)
})

test('a folder the browser must ask for again waits for a click', async ({ page }) => {
  await replacePicker(page)
  await page.addInitScript(() => {
    const permission = () => localStorage.getItem('permission') ?? 'granted'
    const access = FileSystemHandle.prototype
    access.queryPermission = async () => permission() as FolderAccess
    access.requestPermission = async () => {
      localStorage.setItem('permission', 'granted')
      return 'granted'
    }
  })
  await page.goto('/')
  await useFolder(page)
  await addImages(page, [photo('01.jpg')])
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect.poll(() => folderFiles(page)).toHaveProperty(['01.jpg'])

  await page.evaluate(() => localStorage.setItem('permission', 'prompt'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Open photos' })).toBeVisible()
  await page.getByRole('button', { name: 'Open the folder' }).click()
  await expect(page.getByRole('img')).toHaveCount(1)
})

test('a folder that has gone can be left behind', async ({ page }) => {
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry('photos', { recursive: true })
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'photos could not be found' })).toBeVisible()
  await page.getByRole('button', { name: 'Use the board in this browser' }).click()
  await expect(page.getByRole('button', { name: 'Add images' })).toBeVisible()
})

test('the option is absent where the browser has no folders', async ({ page }) => {
  await page.addInitScript(() => {
    delete window.showDirectoryPicker
    delete (Window.prototype as Partial<Window>).showDirectoryPicker
  })
  await page.goto('/')
  await openSettings(page)
  await expect(page.getByRole('button', { name: 'Back up' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Keep in a folder' })).toHaveCount(0)
})
