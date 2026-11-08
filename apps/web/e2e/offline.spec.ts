/// <reference lib="dom" />

import { expect, type Page, test } from '@playwright/test'

import { addImages, image, watchErrors } from './fixtures'

async function readyForOffline(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
}

test('it works with the network off after the first visit', async ({ page, context }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await addImages(page, [image('a.png')])
  await expect(page.getByRole('img')).toHaveCount(1)
  await readyForOffline(page)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('img')).toHaveCount(1)

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('tab', { name: 'Photos' }).click()
  await expect(page.getByRole('switch', { name: 'Read locations' })).toBeVisible()
  await page.keyboard.press('Escape')
  await addImages(page, [image('b.png')])
  await expect(page.getByRole('img')).toHaveCount(2)

  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible()
  await context.setOffline(false)
  expect(errors).toEqual([])
})

test('it can be installed', async ({ page }) => {
  await page.goto('/')
  const response = await page.request.get('/manifest.webmanifest')
  const manifest = (await response.json()) as { display: string; icons: { src: string }[] }
  expect(manifest.display).toBe('standalone')
  for (const { src } of manifest.icons) {
    expect((await page.request.get(src)).headers()['content-type']).toBe('image/png')
  }
})
