/// <reference lib="dom" />

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, type Page, test } from '@playwright/test'

import { addImages, image, savedBoard, savedImages, watchErrors, withExif } from './fixtures'

const photos = new URL('../../../test-images/', import.meta.url)

const storedColours = (page: Page) =>
  savedImages(page).then((images) => images.map(({ colour }) => colour ?? null))

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
async function gridHues(page: Page) {
  const [{ grid }, images] = await Promise.all([savedBoard(page), savedImages(page)])
  const hue = new Map(images.map(({ id, colour }) => [id, colour?.dominant.hue ?? -1]))
  return grid.map((id) => hue.get(id) ?? -1)
}

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

test('bands put the dark images first and the light ones after', async ({ page }) => {
  await page.goto('/')
  await addImages(page, testImages)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await page.getByRole('button', { name: 'Sort the grid by colour' }).click()
  await page.getByRole('menuitem', { name: 'Bands, 2 rows' }).click()

  const darkFirst = async () => {
    const [{ grid }, images] = await Promise.all([savedBoard(page), savedImages(page)])
    const tones = grid.map((id) => images.find((one) => one.id === id)?.colour?.tone ?? 0)
    return (
      tones.length === testImages.length &&
      Math.max(...tones.slice(0, 6)) <= Math.min(...tones.slice(6))
    )
  }
  await expect.poll(darkFirst).toBe(true)
})

test('a date and a city are kept only when asked for, and a position never', async ({ page }) => {
  const photo = (name: string) => ({
    name,
    mimeType: 'image/jpeg',
    buffer: withExif(readFileSync(testImages[0]), {
      taken: '2024:05:06 12:00:00',
      north: 26,
      west: 80
    })
  })
  const facts = async () => {
    const images = await savedImages(page)
    return images.map(({ takenAt, place }) => [takenAt?.slice(0, 10), place]).sort()
  }
  await page.goto('/')
  await addImages(page, [photo('off.jpg')])
  await expect(page.getByRole('img')).toHaveCount(1)

  await page.getByRole('button', { name: 'Settings' }).click()
  const dates = page.getByRole('switch', { name: 'Read capture dates' })
  const locations = page.getByRole('switch', { name: 'Read locations' })
  await expect(dates).not.toBeChecked()
  await expect(locations).not.toBeChecked()
  await dates.click()
  await locations.click()
  await page.keyboard.press('Escape')
  await addImages(page, [photo('on.jpg')])
  await expect(page.getByRole('img')).toHaveCount(2)

  await expect.poll(facts).toEqual([
    [undefined, undefined],
    ['2024-05-06', 'Hollywood, US']
  ])
  expect(JSON.stringify(await savedImages(page))).not.toMatch(/latitude|longitude/i)

  // The copy that goes to Instagram is re-encoded, so the photo's metadata stays behind.
  const copiesWithExif = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const opening = indexedDB.open('lineup')
        opening.onsuccess = () => {
          const copies = opening.result.transaction('publishCopies').objectStore('publishCopies')
          const reading = copies.getAll()
          reading.onsuccess = async () => {
            opening.result.close()
            const texts = await Promise.all((reading.result as Blob[]).map((copy) => copy.text()))
            resolve(texts.length === 2 ? texts.filter((text) => text.includes('Exif')).length : -1)
          }
        }
      })
  )
  expect(copiesWithExif).toBe(0)

  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(dates).toBeChecked()
  await expect(locations).toBeChecked()
})
