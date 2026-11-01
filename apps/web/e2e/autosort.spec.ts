/// <reference lib="dom" />

import { expect, type Page, test } from '@playwright/test'

import { addImages, image } from './fixtures'

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
