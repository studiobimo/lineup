/// <reference lib="dom" />

import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, type Page, test } from '@playwright/test'

import { addImages, image, watchErrors } from './fixtures'

const photos = new URL('../../../test-images/', import.meta.url)

/** The image records, read from the browser as a reload would find them. */
const storedColours = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown[]>((resolve) => {
        const opening = indexedDB.open('lineup')
        opening.onsuccess = () => {
          const reading = opening.result.transaction('images').objectStore('images').getAll()
          reading.onsuccess = () => {
            opening.result.close()
            resolve(reading.result.map(({ colour }) => colour ?? null))
          }
        }
      })
  )

const forgetColours = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const opening = indexedDB.open('lineup')
        opening.onsuccess = () => {
          const transaction = opening.result.transaction('images', 'readwrite')
          const images = transaction.objectStore('images')
          const reading = images.getAll()
          reading.onsuccess = () => {
            for (const record of reading.result) {
              delete record.colour
              images.put(record)
            }
          }
          transaction.oncomplete = () => {
            opening.result.close()
            resolve()
          }
        }
      })
  )

const testImages = readdirSync(photos).map((name) => fileURLToPath(new URL(name, photos)))

/** The grid's hues in order, from the first image in the grid to the last. */
const gridHues = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const opening = indexedDB.open('lineup')
        opening.onsuccess = () => {
          const transaction = opening.result.transaction(['board', 'images'])
          const board = transaction.objectStore('board').get('current')
          const images = transaction.objectStore('images').getAll()
          transaction.oncomplete = () => {
            opening.result.close()
            const hue = new Map(images.result.map(({ id, colour }) => [id, colour.dominant.hue]))
            resolve(board.result.grid.map((id: string) => hue.get(id)))
          }
        }
      })
  )

async function shuffledGrid(page: Page) {
  await page.goto('/')
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles([...testImages].reverse())
  await expect(page.getByRole('img')).toHaveCount(testImages.length)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await expect(page.locator('section').getByRole('img')).toHaveCount(testImages.length)
  await expect.poll(async () => (await gridHues(page)).length).toBe(testImages.length)
}

const ascending = (hues: number[]) => hues.every((hue, index) => !index || hue >= hues[index - 1])

test('the sort menu sorts the grid, and one undo restores it', async ({ page }) => {
  const errors = watchErrors(page)
  await shuffledGrid(page)
  const before = await gridHues(page)

  await page.getByRole('button', { name: 'Sort the grid by colour' }).click()
  await page.getByRole('menuitem', { name: 'Rainbow' }).click()

  await expect.poll(async () => ascending((await gridHues(page)).slice(0, 8))).toBe(true)
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect.poll(() => gridHues(page)).toEqual(before)
  expect(errors).toEqual([])
})

test('a prompt beside the button offers Undo, and goes once something else changes', async ({
  page
}) => {
  await shuffledGrid(page)
  const before = await gridHues(page)
  const prompt = page.getByRole('button', { name: 'Undo', exact: true }).last()
  const sort = async () => {
    await page.getByRole('button', { name: 'Sort the grid by colour' }).click()
    await page.getByRole('menuitem', { name: 'Rainbow' }).click()
  }

  await sort()
  await expect(page.getByText('Sorted by colour')).toBeVisible()
  await prompt.click()
  await expect.poll(() => gridHues(page)).toEqual(before)
  await expect(page.getByText('Sorted by colour')).toHaveCount(0)

  await sort()
  await expect(page.getByText('Sorted by colour')).toBeVisible()
  await page.getByRole('button', { name: 'Shuffle the grid' }).click()
  await expect(page.getByText('Sorted by colour')).toHaveCount(0)
})

test('sorting what is already in order offers nothing new to undo', async ({ page }) => {
  await shuffledGrid(page)
  for (let times = 0; times < 2; times += 1) {
    await page.getByRole('button', { name: 'Sort the grid by colour' }).click()
    await page.getByRole('menuitem', { name: 'Rainbow' }).click()
  }
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByText('Sorted by colour')).toHaveCount(1)
})

test('the sort menu works from the keyboard', async ({ page }) => {
  await shuffledGrid(page)
  const before = await gridHues(page)

  await page.getByRole('button', { name: 'Sort the grid by colour' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Rainbow' })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  await expect.poll(() => gridHues(page)).not.toEqual(before)
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('there is nothing to sort with fewer than two images', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sort the tray by colour' })).toBeDisabled()
  await addImages(page, [image('a.png')])
  await expect(page.getByRole('img')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Sort the tray by colour' })).toBeDisabled()
})

test('an image is given its colour on import, through the real worker', async ({ page }) => {
  await page.goto('/')
  await addImages(page, [image('a.png')])
  await expect(page.getByRole('img')).toHaveCount(1)

  const [colour] = await storedColours(page)
  expect(colour).toMatchObject({ dominant: { hue: expect.any(Number) } })
})

test('an image saved before colours existed gets one in the background', async ({ page }) => {
  await page.goto('/')
  await addImages(page, [image('a.png'), image('b.png')])
  await expect(page.getByRole('img')).toHaveCount(2)
  await forgetColours(page)
  expect(await storedColours(page)).toEqual([null, null])

  await page.reload()
  await expect(page.getByRole('img')).toHaveCount(2)
  await expect.poll(() => storedColours(page).then((all) => all.every(Boolean))).toBe(true)
})
