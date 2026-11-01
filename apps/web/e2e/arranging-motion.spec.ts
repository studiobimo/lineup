/// <reference lib="dom" />

import { expect, test } from '@playwright/test'

import { addImages, image } from './fixtures'

test.use({ contextOptions: { reducedMotion: 'no-preference' } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()
  await addImages(page, [image('a.png'), image('b.png'), image('c.png')])
  const move = page.getByRole('button', { name: 'Move to the grid' })
  await expect(move).toHaveCount(3)
  for (let cell = 0; cell < 3; cell += 1) {
    await move.first().evaluate((button) => (button as HTMLElement).click())
  }
  await expect(page.locator('[data-flight]')).toHaveCount(3)
  await expect(page.locator('[data-flight]')).toHaveCount(0)
})

test('a displaced cell passes over its neighbours', async ({ page }) => {
  const cells = page.locator('section [data-drop-id]')
  const displaced = await cells.nth(2).getAttribute('data-drop-id')
  const from = (await cells.nth(0).boundingBox())!
  const to = (await cells.nth(2).boundingBox())!

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
  await expect(page.locator('[data-mark="swap"]')).toBeVisible()

  const frames = page.evaluate(
    (id) =>
      new Promise<boolean[]>((resolve) => {
        const seen: boolean[] = []
        const end = performance.now() + 450
        let last: number | undefined
        const tick = (now: number) => {
          const cell = document.querySelector(`[data-drop-id="${id}"]`)
          const box = cell?.getBoundingClientRect()
          if (cell && box && box.left !== last) {
            last = box.left
            const middle = document.elementFromPoint(
              box.left + box.width / 2,
              box.top + box.height / 2
            )
            seen.push(middle?.closest('[data-drop-id]') === cell)
          }
          if (now < end) requestAnimationFrame(tick)
          else resolve(seen)
        }
        requestAnimationFrame(tick)
      }),
    displaced
  )
  await page.mouse.up()

  const onTop = await frames
  expect(onTop.length).toBeGreaterThan(5)
  expect(onTop).not.toContain(false)
})

test('a cell sent back while it is in the air heads for its new place', async ({ page }) => {
  await page.getByRole('button', { name: 'Undo' }).evaluate((button) => {
    ;(button as HTMLElement).click()
  })
  const flight = page.locator('[data-flight]')
  await expect(flight).toHaveCount(1)

  const landedAt = await flight.evaluate(
    (element) =>
      new Promise<number>((resolve) => {
        let left = 0
        const tick = () => {
          if (!element.isConnected) resolve(left)
          else {
            left = element.getBoundingClientRect().left
            requestAnimationFrame(tick)
          }
        }
        tick()
      })
  )
  const home = (await page.locator('aside [data-drop-id]').first().boundingBox())!
  expect(Math.abs(landedAt - home.x)).toBeLessThan(2)
})

test('the ghost is centred on the pointer, and leans only while it moves', async ({ page }) => {
  const cell = (await page.locator('section [data-drop-id]').first().boundingBox())!
  const ghost = page.locator('[data-ghost]')
  const lean = () =>
    ghost.evaluate((element) => {
      const { a, b } = new DOMMatrix(getComputedStyle(element).transform)
      return (Math.atan2(b, a) * 180) / Math.PI
    })

  await page.mouse.move(cell.x + 20, cell.y + 20)
  await page.mouse.down()
  await page.mouse.move(600, 300, { steps: 6 })
  await page.waitForTimeout(600)

  const box = (await ghost.boundingBox())!
  expect(Math.abs(box.x + box.width / 2 - 600)).toBeLessThan(2)
  expect(Math.abs(box.y + box.height / 2 - 300)).toBeLessThan(2)
  expect(Math.abs(await lean())).toBeLessThan(0.5)

  const peak = ghost.evaluate(
    (element) =>
      new Promise<number>((resolve) => {
        let most = 0
        const end = performance.now() + 400
        const tick = (now: number) => {
          const { a, b } = new DOMMatrix(getComputedStyle(element).transform)
          most = Math.max(most, Math.abs((Math.atan2(b, a) * 180) / Math.PI))
          if (now < end) requestAnimationFrame(tick)
          else resolve(most)
        }
        requestAnimationFrame(tick)
      })
  )
  await page.mouse.move(900, 300, { steps: 6 })
  expect(await peak).toBeGreaterThan(1)
  expect(await peak).toBeLessThanOrEqual(10)

  await page.waitForTimeout(700)
  expect(Math.abs(await lean())).toBeLessThan(0.5)
  await page.mouse.up()
})
