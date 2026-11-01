/// <reference lib="dom" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, type Page, test } from '@playwright/test'

import { addImages, choose, savedBoard, savedBytes, savedImages, watchErrors } from './fixtures'

const photos = ['01.jpg', '02.jpg', '03.jpg', '04.jpg'].map((name) => ({
  name,
  mimeType: 'image/jpeg',
  buffer: readFileSync(join(import.meta.dirname, '../../../test-images', name))
}))

const snapshot = async (page: Page) => ({
  board: await savedBoard(page),
  images: (await savedImages(page)).sort((one, other) => (one.id < other.id ? -1 : 1)),
  thumbnails: await savedBytes(page, 'thumbnails'),
  copies: await savedBytes(page, 'publishCopies')
})

async function backUp(page: Page, path: string) {
  await page.getByRole('button', { name: 'Settings' }).click()
  const saving = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Back up' }).click()
  const file = await saving
  expect(file.suggestedFilename()).toMatch(/^lineup-\d{4}-\d{2}-\d{2}\.lineup$/)
  await file.saveAs(path)
  await page.keyboard.press('Escape')
}

async function restore(page: Page, file: string | Parameters<typeof choose>[2]) {
  await page.getByRole('button', { name: 'Settings' }).click()
  await choose(page, 'Restore', file)
}

async function arrangedBoard(page: Page) {
  await page.goto('/')
  await addImages(page, photos)
  await expect(page.getByRole('img')).toHaveCount(4)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await page.getByRole('button', { name: 'Shuffle the grid' }).click()
  const second = page.locator('section').getByRole('group', { name: 'Image 2', exact: true })
  await second.hover()
  await second.getByRole('button', { name: 'Lock in place' }).click()
  await expect.poll(async () => (await savedBoard(page)).locked?.length).toBe(1)
}

test('a board restored on another device is identical', async ({ page, browser, baseURL }) => {
  const errors = watchErrors(page)
  const path = test.info().outputPath('board.lineup')
  await arrangedBoard(page)
  await expect.poll(async () => (await snapshot(page)).images.length).toBe(4)
  const original = await snapshot(page)
  await backUp(page, path)

  const elsewhere = await browser.newContext({ baseURL })
  const device = await elsewhere.newPage()
  await device.goto('/')
  await expect(device.getByRole('button', { name: 'Settings' })).toBeVisible()
  await restore(device, path)
  await expect(device.getByText('Board restored')).toBeVisible()
  await expect(device.getByRole('img')).toHaveCount(4)
  await expect.poll(() => snapshot(device)).toEqual(original)
  await device.reload()
  await expect(device.getByRole('img')).toHaveCount(4)
  await elsewhere.close()
  expect(errors).toEqual([])
})

test('Undo brings back the board a restore replaced', async ({ page }) => {
  const path = test.info().outputPath('board.lineup')
  await arrangedBoard(page)
  await backUp(page, path)
  await page.getByRole('button', { name: 'Clear' }).click()
  await page.getByRole('button', { name: /^Tray/ }).waitFor()
  await page.keyboard.press('Escape')

  await addImages(page, [photos[0]])
  await expect.poll(async () => (await savedBoard(page)).tray.length).toBe(1)
  const replaced = await savedBoard(page)
  await restore(page, path)
  await expect(page.getByText('Board restored')).toBeVisible()
  await expect.poll(async () => (await savedBoard(page)).tray.length).toBe(0)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => savedBoard(page)).toEqual(replaced)
})

test('a file that is not a backup changes nothing, and says so', async ({ page }) => {
  await arrangedBoard(page)
  const before = await savedBoard(page)
  await restore(page, {
    name: 'photo.lineup',
    mimeType: 'application/octet-stream',
    buffer: photos[0].buffer
  })
  await expect(page.getByText('That file could not be restored')).toBeVisible()
  expect(await savedBoard(page)).toEqual(before)
})
