/// <reference lib="dom" />

import { expect, type Page, test } from '@playwright/test'

import { addImages, image, watchErrors } from './fixtures'

const safari =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

const safariNote = 'Safari can delete'

/** The worker controls the page only once it has cached what it needs. */
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

  // Lazy on purpose: these load their own chunks, which the worker has to have cached.
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

test('only Safari is told about installing', async ({ page, browser, baseURL }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('tab', { name: 'Photos' }).click()
  await expect(page.getByRole('switch', { name: 'Read locations' })).toBeVisible()
  await page.getByRole('tab', { name: 'Storage' }).click()
  await expect(page.getByText(/ used$/)).toBeVisible()
  await expect(page.getByText(safariNote)).toHaveCount(0)

  const context = await browser.newContext({ baseURL, userAgent: safari })
  const inSafari = await context.newPage()
  await inSafari.goto('/')
  await inSafari.getByRole('button', { name: 'Settings' }).click()
  await inSafari.getByRole('tab', { name: 'Storage' }).click()
  await expect(inSafari.getByText(safariNote)).toBeVisible()
  await context.close()
})
