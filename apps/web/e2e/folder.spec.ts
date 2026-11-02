/// <reference lib="dom" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium, expect, type Page, test } from '@playwright/test'

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

/** What a person's file manager would do, with folders on the way made as it goes. */
const addToFolder = (page: Page, path: string, bytes: Buffer) =>
  page.evaluate(
    async ({ path, bytes }) => {
      const root = await navigator.storage.getDirectory()
      let folder = await root.getDirectoryHandle('photos')
      const parts = path.split('/')
      const name = parts.pop()!
      for (const part of parts) {
        folder = await folder.getDirectoryHandle(part, { create: true })
      }
      const writable = await (await folder.getFileHandle(name, { create: true })).createWritable()
      await writable.write(new Uint8Array(bytes))
      await writable.close()
    },
    { path, bytes: [...bytes] }
  )

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

test('what appears in the folder is offered, and goes in without a second copy', async ({
  page
}) => {
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  const dropped = photo('01.jpg')
  await addToFolder(page, 'trip/dropped.jpg', dropped.buffer)
  await page.reload()

  await page.getByRole('button', { name: 'Add to tray' }).click()
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect.poll(async () => (await folderBoard(page))?.tray.length).toBe(1)
  const files = Object.keys(await folderFiles(page)).filter((name) => !name.startsWith('.'))
  expect(files).toEqual(['trip/dropped.jpg'])

  await page.reload()
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Add to tray' })).toHaveCount(0)
})

test('a removed image stays in the folder and is not offered again', async ({ page }) => {
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  await addImages(page, [photo('01.jpg')])
  await expect(page.getByRole('img')).toHaveCount(1)
  const cell = page.locator('aside').getByRole('group', { name: 'Image 1', exact: true })
  await cell.hover()
  await cell.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('img')).toHaveCount(0)
  await expect.poll(async () => (await folderBoard(page))?.tray.length).toBe(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Add images' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add to tray' })).toHaveCount(0)
  expect(await folderFiles(page)).toHaveProperty(['01.jpg'])
})

test('a file deleted outside the app is a missing cell, and comes back', async ({ page }) => {
  const errors = watchErrors(page)
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  const original = photo('01.jpg')
  await addImages(page, [original])
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect.poll(() => folderFiles(page)).toHaveProperty(['01.jpg'])
  await expect.poll(async () => (await folderBoard(page))?.tray.length).toBe(1)

  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    await (await root.getDirectoryHandle('photos')).removeEntry('01.jpg')
  })
  await page.reload()
  const cell = page.locator('aside').getByRole('group', { name: 'Image 1', exact: true })
  await expect(cell.getByText('Original not in the folder')).toBeAttached()
  await expect(page.getByRole('img')).toHaveCount(1)
  await cell.dblclick()
  await expect(page.getByRole('dialog').getByText('Original not in the folder')).toBeVisible()
  await page.keyboard.press('Escape')

  await addToFolder(page, '01.jpg', original.buffer)
  await page.reload()
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect(page.getByText('Original not in the folder')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a step whose write never finished comes back, and can be undone', async ({ page }) => {
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  await addImages(page, [photo('01.jpg')])
  await expect(page.locator('aside').getByRole('img')).toHaveCount(1)
  await expect.poll(async () => (await folderBoard(page))?.tray.length).toBe(1)

  // As a tab that closes mid-write leaves things: the change made, and the file never swapped in.
  await page.evaluate(() => {
    FileSystemFileHandle.prototype.createWritable = () => new Promise(() => {})
  })
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await expect(page.locator('section').getByRole('img')).toHaveCount(1)
  expect((await folderBoard(page))?.grid).toEqual([])

  await page.reload()
  await expect(page.locator('section').getByRole('img')).toHaveCount(1)
  await expect.poll(async () => (await folderBoard(page))?.grid.length).toBe(1)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('aside').getByRole('img')).toHaveCount(1)
})

test('a folder that goes while it is open stops the board, and nothing is lost', async ({
  page
}) => {
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  await addImages(page, [photo('01.jpg')])
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect.poll(async () => (await folderBoard(page))?.tray.length).toBe(1)

  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry('photos', { recursive: true })
  })
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await expect(page.getByRole('heading', { name: 'photos could not be found' })).toBeVisible()
  await page.getByRole('button', { name: 'Use the board in this browser' }).click()
  await expect(page.getByRole('button', { name: 'Add images' })).toBeVisible()
})

test('permission lost while a folder is open comes back with the change', async ({ page }) => {
  await replacePicker(page)
  await page.addInitScript(() => {
    const permission = () => localStorage.getItem('permission') ?? 'granted'
    const access = FileSystemHandle.prototype
    const write = FileSystemFileHandle.prototype.createWritable
    access.queryPermission = async () => permission() as FolderAccess
    access.requestPermission = async () => {
      localStorage.setItem('permission', 'granted')
      return 'granted'
    }
    FileSystemFileHandle.prototype.createWritable = function (...options) {
      if (permission() === 'granted') return write.apply(this, options)
      return Promise.reject(new DOMException('Revoked', 'NotAllowedError'))
    }
  })
  await page.goto('/')
  await useFolder(page)
  await addImages(page, [photo('01.jpg')])
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect.poll(async () => (await folderBoard(page))?.tray.length).toBe(1)

  await page.evaluate(() => localStorage.setItem('permission', 'prompt'))
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await page.getByRole('button', { name: 'Open the folder' }).click()
  await expect(page.locator('section').getByRole('img')).toHaveCount(1)
  await expect.poll(async () => (await folderBoard(page))?.grid.length).toBe(1)
})

test('a damaged folder says so, and the way out leaves it alone', async ({ page }) => {
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  await addImages(page, [photo('01.jpg')])
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect.poll(async () => (await folderBoard(page))?.tray.length).toBe(1)

  await addToFolder(page, '.lineup/images.json', Buffer.from('not what it wrote'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'photos could not be read' })).toBeVisible()
  await page.getByRole('button', { name: 'Use the board in this browser' }).click()
  await expect(page.getByRole('button', { name: 'Add images' })).toBeVisible()
  expect(await folderFiles(page)).toHaveProperty(['01.jpg'])
})

test('a folder board survives a browser restart', async ({ baseURL }) => {
  const profile = test.info().outputPath('profile')
  const launch = () => chromium.launchPersistentContext(profile, { baseURL })

  const first = await launch()
  const page = first.pages()[0] ?? (await first.newPage())
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  await addImages(page, [photo('01.jpg')])
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect.poll(async () => (await folderBoard(page))?.tray.length).toBe(1)
  await first.close()

  const second = await launch()
  const reopened = second.pages()[0] ?? (await second.newPage())
  await reopened.goto('/')
  await expect(reopened.getByRole('img')).toHaveCount(1)
  await second.close()
})

test('a folder board keeps an album, and its files stay where they are', async ({ page }) => {
  await replacePicker(page)
  await page.goto('/')
  await useFolder(page)
  await addImages(page, [photo('01.jpg'), photo('02.jpg')])
  const cells = page.locator('aside').getByRole('group', { name: /^Image \d+$/ })
  await expect(cells).toHaveCount(2)
  await cells.nth(0).hover()
  await cells.nth(0).getByRole('button', { name: 'Select' }).click()
  await cells.nth(1).click()
  await page.getByRole('toolbar').getByRole('button', { name: 'Group' }).click()
  await expect(cells).toHaveCount(1)
  await expect
    .poll(async () => Object.keys((await folderBoard(page))?.albums ?? {}))
    .toHaveLength(1)

  await page.reload()
  await expect(page.getByText('Album of 2 images')).toBeAttached()
  expect(await folderFiles(page)).toHaveProperty(['01.jpg'])
  expect(await folderFiles(page)).toHaveProperty(['02.jpg'])
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
