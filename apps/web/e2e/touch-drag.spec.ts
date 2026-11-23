/// <reference lib="dom" />

import { devices, expect, type Locator, type Page, test } from '@playwright/test'

import { addImages, image } from './fixtures'

const { hasTouch, isMobile } = devices['Pixel 7']

test.use({ hasTouch, isMobile, viewport: { width: 360, height: 640 } })

type Spot = { x: number; y: number }

const middle = async (cell: Locator): Promise<Spot> => {
  const box = (await cell.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function fingerOn(page: Page) {
  const session = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', spot?: Spot) =>
    session.send('Input.dispatchTouchEvent', { type, touchPoints: spot ? [spot] : [] })

  return {
    async press(spot: Spot, hold: number) {
      await touch('touchStart', spot)
      await page.waitForTimeout(hold)
    },
    async move(from: Spot, to: Spot, steps = 10) {
      for (let step = 1; step <= steps; step += 1) {
        await touch('touchMove', {
          x: from.x + ((to.x - from.x) * step) / steps,
          y: from.y + ((to.y - from.y) * step) / steps
        })
        await page.waitForTimeout(16)
      }
    },
    lift: () => touch('touchEnd')
  }
}

const gridOrder = (cells: Locator) =>
  cells.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.dropId))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await addImages(
    page,
    Array.from({ length: 12 }, (_, index) => image(`${index}.png`))
  )
  await page.getByRole('button', { name: 'Tray (12)' }).click()
  const move = page.getByRole('button', { name: 'Move to the grid' })
  await expect(move).toHaveCount(12)
  for (let cell = 0; cell < 12; cell += 1) {
    await move.first().evaluate((button) => (button as HTMLElement).click())
  }
  await page.keyboard.press('Escape')
  await expect(page.locator('section [data-drop-id]')).toHaveCount(12)
})

test('a long press picks up a cell, and a drop swaps it', async ({ page }) => {
  const cells = page.locator('section [data-drop-id]')
  const before = await gridOrder(cells)
  const from = await middle(cells.nth(0))
  const to = await middle(cells.nth(2))
  const finger = await fingerOn(page)

  await finger.press(from, 350)
  await finger.move(from, to)
  await expect(page.locator('[data-ghost]')).toBeVisible()
  await expect(page.locator('[data-mark="swap"]')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await finger.lift()

  const [a, b, c, ...rest] = before
  await expect.poll(() => gridOrder(cells)).toEqual([c, b, a, ...rest])
})

test('a finger that moves at once scrolls the page and picks up nothing', async ({ page }) => {
  const cells = page.locator('section [data-drop-id]')
  const before = await gridOrder(cells)
  const from = await middle(cells.nth(6))
  const finger = await fingerOn(page)

  await finger.press(from, 0)
  await finger.move(from, { x: from.x, y: from.y - 240 })
  await finger.lift()

  await expect(page.locator('[data-ghost]')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
  expect(await gridOrder(cells)).toEqual(before)
})
