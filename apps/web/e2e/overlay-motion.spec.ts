/// <reference lib="dom" />

import { expect, type Page, test } from '@playwright/test'

import { addImages, image } from './fixtures'

test.use({ contextOptions: { reducedMotion: 'no-preference' } })

/** Every opacity a dialog goes through while `act` runs, one sample a frame. */
async function opacities(page: Page, act: () => Promise<void>) {
  const sampling = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const seen: number[] = []
        const end = performance.now() + 700
        const tick = () => {
          const dialog = document.querySelector('[role="dialog"]')
          if (dialog) seen.push(Number(getComputedStyle(dialog).opacity))
          if (performance.now() < end) requestAnimationFrame(tick)
          else resolve(seen)
        }
        tick()
      })
  )
  await act()
  return sampling
}

async function expectFades(page: Page, open: () => Promise<void>) {
  const entering = await opacities(page, open)
  expect(Math.min(...entering)).toBeLessThan(0.9)
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1')

  const leaving = await opacities(page, () => page.keyboard.press('Escape'))
  expect(Math.min(...leaving)).toBeLessThan(0.9)
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('Help and Settings fade in and out', async ({ page }) => {
  await page.goto('/')
  await expectFades(page, () => page.getByRole('button', { name: 'Help' }).click())
  await expectFades(page, () => page.getByRole('button', { name: 'Settings' }).click())
})

test('the lightbox fades in and out', async ({ page }) => {
  await page.goto('/')
  await addImages(page, [image('a.png')])
  await page.getByRole('img').waitFor()
  const open = page.getByRole('button', { name: 'Open full size' })
  await expectFades(page, () => open.click({ force: true }))
})

test('closing with a button plays the exit too', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Help' }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('tab', { name: 'Getting started' }).click()
  await page.waitForTimeout(300)
  const leaving = await opacities(page, () =>
    page.getByRole('button', { name: 'Show the introduction' }).click()
  )
  expect(Math.min(...leaving)).toBeLessThan(0.9)
})
