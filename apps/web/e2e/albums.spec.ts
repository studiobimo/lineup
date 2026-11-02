import { expect, type Page, test } from '@playwright/test'

import { addImages, choose, image, reloadWhenSaved, savedBoard, watchErrors } from './fixtures'

const tray = (page: Page) => page.locator('aside').getByRole('group', { name: /^Image \d+$/ })
const grid = (page: Page) => page.locator('section').getByRole('group', { name: /^Image \d+$/ })
const bar = (page: Page) => page.getByRole('toolbar', { name: 'Selected cells' })
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
const named = (count: number) =>
  Array.from({ length: count }, (_, index) => image(`photo-${index}.png`))

async function boardOf(page: Page, count: number) {
  await page.goto('/')
  await addImages(page, named(count))
  await expect(tray(page)).toHaveCount(count)
}

async function groupFirst(page: Page, count: number) {
  await tray(page)
    .nth(0)
    .click({ modifiers: [modifier] })
  await tray(page)
    .nth(count - 1)
    .click({ modifiers: ['Shift'] })
  await bar(page).getByRole('button', { name: 'Group' }).click()
}

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

test('passing over a cell without holding still swaps', async ({ page }) => {
  await boardOf(page, 3)
  await dragOnto(page, 0, 1, 50)
  await page.mouse.up()
  await expect(tray(page)).toHaveCount(3)
})

test('an album past the limit is refused, and says why', async ({ page }) => {
  await boardOf(page, 21)
  await groupFirst(page, 21)
  await expect(page.getByText('An album holds at most 20 images.')).toBeVisible()
  await expect(tray(page)).toHaveCount(21)
})

test('a cell cannot join an album that is full', async ({ page }) => {
  await boardOf(page, 21)
  await groupFirst(page, 20)
  await expect(tray(page)).toHaveCount(2)
  await dragOnto(page, 0, 1, 800)
  await expect(page.getByRole('status').getByText('at most 20 images')).toBeVisible()
  await page.mouse.up()
  await expect(tray(page)).toHaveCount(2)
  await expect(page.getByText('Album of 20 images')).toBeAttached()
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
  // The sensor starts listening a tick after the pick-up, which no hand on a keyboard can beat.
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

test('taking images out ends at two cells, not an album of one', async ({ page }) => {
  await boardOf(page, 3)
  await groupFirst(page, 3)
  await expect(tray(page)).toHaveCount(1)
  await openAlbum(page)
  const dialog = page.getByRole('dialog')
  const takeOut = () =>
    dialog.getByRole('button', { name: 'Take out of the album' }).first().click({ force: true })

  await takeOut()
  await expect(dialog.getByRole('group', { name: /^Album image/ })).toHaveCount(2)
  await takeOut()
  await expect(dialog).toHaveCount(0)
  await expect(tray(page)).toHaveCount(3)
  await expect(page.getByText(/^Album of/)).toHaveCount(0)
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

test('a locked album cannot be changed until it is unlocked', async ({ page }) => {
  await boardOf(page, 2)
  await groupFirst(page, 2)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await expect(grid(page)).toHaveCount(1)
  await grid(page).first().hover()
  await grid(page).first().getByRole('button', { name: 'Lock in place' }).click()
  await grid(page).first().getByRole('button', { name: 'Open album' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Unlock it to change it')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Ungroup' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Take out of the album' })).toHaveCount(0)
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
  await boardOf(page, 3)
  await groupFirst(page, 2)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await expect(grid(page)).toHaveCount(2)
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
  await boardOf(page, 3)
  await groupFirst(page, 2)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await expect(grid(page)).toHaveCount(2)
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
  const saving = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Back up' }).click()
  const path = test.info().outputPath('board.lineup')
  await (await saving).saveAs(path)

  const elsewhere = await browser.newContext({ baseURL })
  const device = await elsewhere.newPage()
  await device.goto('/')
  await device.getByRole('button', { name: 'Settings' }).click()
  await choose(device, 'Restore', path)
  await expect(device.getByText('Album of 2 images')).toBeAttached()
  await expect(tray(device)).toHaveCount(2)
  await elsewhere.close()
})

test('the clear dialog counts images, not cells', async ({ page }) => {
  await boardOf(page, 3)
  await groupFirst(page, 2)
  await expect(bar(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(page.getByRole('alertdialog').getByText(/3/).first()).toBeVisible()
})

test('a locked cell is not grouped', async ({ page }) => {
  await boardOf(page, 2)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await expect(grid(page)).toHaveCount(2)
  await grid(page).nth(0).hover()
  await grid(page).nth(0).getByRole('button', { name: 'Lock in place' }).click()
  await grid(page)
    .nth(0)
    .click({ modifiers: [modifier] })
  await grid(page)
    .nth(1)
    .click({ modifiers: [modifier] })
  await bar(page).getByRole('button', { name: 'Group' }).click()
  await expect(page.getByText('Unlock a cell before grouping it.')).toBeVisible()
  await expect(grid(page)).toHaveCount(2)
})

test('an album cell opens its images full size from one button and its editor from another', async ({
  page
}) => {
  await boardOf(page, 3)
  await groupFirst(page, 2)
  await tray(page).first().hover()
  await tray(page).first().getByRole('button', { name: 'Open full size' }).click()
  await expect(page.getByText('Album, image 1 of 2')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Album, image 1 of 2')).toBeHidden()

  await tray(page).first().getByRole('button', { name: 'Open album' }).click()
  await expect(page.getByRole('dialog', { name: 'Album of 2 images' })).toBeVisible()
})

test('double-clicking anywhere on a cell opens it, even under its buttons', async ({ page }) => {
  await boardOf(page, 2)
  await tray(page)
    .first()
    .dblclick({ position: { x: 4, y: 4 } })
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('the album button keeps working after an album has gone while it was open', async ({
  page
}) => {
  await boardOf(page, 5)
  await groupFirst(page, 2)
  await tray(page)
    .nth(1)
    .click({ modifiers: [modifier] })
  await tray(page)
    .nth(2)
    .click({ modifiers: ['Shift'] })
  await bar(page).getByRole('button', { name: 'Group' }).click()
  await expect(tray(page)).toHaveCount(3)

  await openAlbum(page)
  await page.getByRole('button', { name: 'Ungroup' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(tray(page)).toHaveCount(4)

  await tray(page).nth(2).hover()
  await tray(page).nth(2).getByRole('button', { name: 'Open album' }).click()
  await expect(page.getByRole('dialog', { name: 'Album of 2 images' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(tray(page)).toHaveCount(3)
  await openAlbum(page)
  await expect(page.getByRole('dialog', { name: 'Album of 2 images' })).toBeVisible()
})

test('the lightbox shows the album an image belongs to and moves through it', async ({ page }) => {
  await boardOf(page, 3)
  await groupFirst(page, 3)
  await tray(page).first().dblclick()
  const strip = page.getByRole('group', { name: 'Images in this album' })
  await expect(strip.getByRole('button')).toHaveCount(3)
  await expect(strip.getByRole('button', { name: 'Image 1 of the album' })).toHaveAttribute(
    'aria-current',
    'true'
  )

  await strip.getByRole('button', { name: 'Image 3 of the album' }).click()
  await expect(page.getByText('Album, image 3 of 3')).toBeVisible()
})

test('clicking beside the image closes the lightbox, and dragging it does not', async ({
  page
}) => {
  await boardOf(page, 2)
  await tray(page).first().dblclick()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await page.mouse.move(40, 400)
  await page.mouse.down()
  await page.mouse.move(70, 400, { steps: 4 })
  await page.mouse.up()
  await expect(dialog).toBeVisible()

  await page.mouse.click(40, 400)
  await expect(dialog).toHaveCount(0)
})
