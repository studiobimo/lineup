import { expect, type Page, test } from '@playwright/test'

import {
  addImages,
  choose,
  grid,
  groupCells,
  image,
  reloadWhenSaved,
  savedBoard,
  selectKey as modifier,
  selectionBar as bar,
  tray,
  watchErrors
} from './fixtures'

const named = (count: number) =>
  Array.from({ length: count }, (_, index) => image(`photo-${index}.png`))

async function boardOf(page: Page, count: number) {
  await page.goto('/')
  await addImages(page, named(count))
  await expect(tray(page)).toHaveCount(count)
}

const groupFirst = (page: Page, count: number) => groupCells(page, tray(page), count)

async function dragOnto(page: Page, from: number, to: number, holdFor: number) {
  const start = (await tray(page).nth(from).boundingBox())!
  const end = (await tray(page).nth(to).boundingBox())!
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 })
  await page.waitForTimeout(holdFor)
}

const albumOnBoard = async (page: Page) =>
  Object.values((await savedBoard(page)).albums ?? {})[0] ?? []

async function openAlbum(page: Page) {
  await tray(page).first().hover()
  await tray(page).first().getByRole('button', { name: 'Open album' }).click()
}

async function albumOnGrid(page: Page) {
  await boardOf(page, 3)
  await groupFirst(page, 2)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await expect(grid(page)).toHaveCount(2)
}

test('a selection becomes one cell, marked as an album, and undo takes it back', async ({
  page
}) => {
  const errors = watchErrors(page)
  await boardOf(page, 4)
  await groupFirst(page, 3)
  await expect(tray(page)).toHaveCount(2)
  await expect(page.getByText('Album of 3 images')).toBeAttached()
  await expect(bar(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(tray(page)).toHaveCount(4)
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(tray(page)).toHaveCount(2)
  expect(errors).toEqual([])
})

test('an album comes back after a reload', async ({ page }) => {
  await boardOf(page, 3)
  await groupFirst(page, 2)
  await expect(page.getByText('Album of 2 images')).toBeAttached()
  await reloadWhenSaved(page, ({ albums }) => Object.keys(albums ?? {}).length === 1)
  await expect(page.getByText('Album of 2 images')).toBeAttached()
  await expect(tray(page)).toHaveCount(2)
})

test('holding a cell over another groups them when it is dropped', async ({ page }) => {
  await boardOf(page, 3)
  await dragOnto(page, 0, 1, 800)
  await expect(page.getByRole('status').getByText('Drop to make an album')).toBeVisible()
  await page.mouse.up()
  await expect(tray(page)).toHaveCount(2)
  await expect(page.getByText('Album of 2 images')).toBeAttached()
})

test('an album past the limit is refused, and says why', async ({ page }) => {
  await boardOf(page, 21)
  await groupFirst(page, 21)
  await expect(page.getByText('An album holds at most 20 images.')).toBeVisible()
  await expect(tray(page)).toHaveCount(21)
})

test('an album opens, reorders from the keyboard, and undo puts it back', async ({ page }) => {
  const errors = watchErrors(page)
  await boardOf(page, 3)
  await groupFirst(page, 3)
  await expect.poll(async () => albumOnBoard(page)).toHaveLength(3)
  const before = await albumOnBoard(page)

  await openAlbum(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('group', { name: /^Album image/ })).toHaveCount(3)
  await expect(dialog.getByText('Cover', { exact: true })).toBeVisible()

  await dialog.getByRole('group', { name: 'Album image 1', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByText('Picked up Album image 1.')).toBeAttached()
  await page.waitForTimeout(50)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('Over Album image 2.')).toBeAttached()
  await page.keyboard.press('Space')
  await expect.poll(() => albumOnBoard(page)).toEqual([before[1], before[0], before[2]])

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => albumOnBoard(page)).toEqual(before)
  expect(errors).toEqual([])
})

test('ungrouping puts the images back where the album was', async ({ page }) => {
  await boardOf(page, 4)
  await tray(page)
    .nth(1)
    .click({ modifiers: [modifier] })
  await tray(page)
    .nth(2)
    .click({ modifiers: ['Shift'] })
  await bar(page).getByRole('button', { name: 'Group' }).click()
  await expect(tray(page)).toHaveCount(3)
  await tray(page).nth(1).hover()
  await tray(page).nth(1).getByRole('button', { name: 'Open album' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Ungroup' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(tray(page)).toHaveCount(4)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(tray(page)).toHaveCount(3)
})

test('the lightbox steps through an album before the next cell', async ({ page }) => {
  await boardOf(page, 3)
  await groupFirst(page, 2)
  await tray(page).first().dblclick()
  const lightbox = page.getByRole('dialog')
  await expect(lightbox.getByText('1 of 2', { exact: true })).toBeVisible()
  await expect(lightbox.getByText('Album, image 1 of 2')).toBeVisible()

  await page.keyboard.press('ArrowRight')
  await expect(lightbox.getByText('Album, image 2 of 2')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(lightbox.getByText('2 of 2', { exact: true })).toBeVisible()
  await expect(lightbox.getByText(/^Album/)).toHaveCount(0)
  await page.keyboard.press('ArrowLeft')
  await expect(lightbox.getByText('Album, image 2 of 2')).toBeVisible()
})

test('an album drags as one cell, across and back', async ({ page }) => {
  await albumOnGrid(page)
  const first = (await grid(page).nth(0).boundingBox())!
  const second = (await grid(page).nth(1).boundingBox())!
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
  await page.mouse.down()
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(grid(page)).toHaveCount(2)
  await expect(page.getByText('Album of 2 images')).toBeAttached()
  await expect(grid(page).nth(1).getByText('Album of 2 images')).toBeAttached()
})

test('an album is one post in the phone preview, with the carousel marker', async ({ page }) => {
  await albumOnGrid(page)
  await page.getByRole('button', { name: 'Preview on a phone' }).click()
  const phone = page.getByRole('dialog')
  await expect(phone.getByRole('img')).toHaveCount(2)
  await expect(phone.locator('svg.lucide-layers')).toHaveCount(1)
})

test('a board with an album survives a backup, and every image comes back', async ({
  page,
  browser,
  baseURL
}) => {
  await boardOf(page, 3)
  await groupFirst(page, 2)
  await expect.poll(() => albumOnBoard(page)).toHaveLength(2)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('tab', { name: 'Storage' }).click()
  const saving = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Back up' }).click()
  const path = test.info().outputPath('board.lineup')
  await (await saving).saveAs(path)

  const elsewhere = await browser.newContext({ baseURL })
  const device = await elsewhere.newPage()
  await device.goto('/')
  await device.getByRole('button', { name: 'Settings' }).click()
  await device.getByRole('tab', { name: 'Storage' }).click()
  await choose(device, 'Restore', path)
  await expect(device.getByText('Album of 2 images')).toBeAttached()
  await expect(tray(device)).toHaveCount(2)
  await elsewhere.close()
})
