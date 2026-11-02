import { expect, type Page, test } from '@playwright/test'

import { addImages, image, reloadWhenSaved, watchErrors } from './fixtures'

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
