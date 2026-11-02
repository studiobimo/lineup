import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

import { addImages, image } from './fixtures'

const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(wcag).analyze()
  return violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target).join(', ')}`)
}

/** A dialog still fading in reads as low contrast. */
async function openDialog(page: Page, button: string) {
  await page.getByRole('button', { name: button }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations({ subtree: true }).map(({ finished }) => finished))
  )
}

const images = Array.from({ length: 6 }, (_, index) => image(`${index + 1}.png`))

async function fillBoard(page: Page) {
  await page.goto('/')
  await page.getByText('Move images here to plan your feed.').waitFor()
  await addImages(page, images)
  await expect(page.getByRole('img')).toHaveCount(6)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await addImages(page, images.slice(0, 2))
  await expect(page.getByRole('img')).toHaveCount(8)
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`in ${colorScheme}`, () => {
    test.use({ colorScheme })

    test('the empty planner', async ({ page }) => {
      await page.goto('/')
      await page.getByText('Move images here to plan your feed.').waitFor()
      expect(await violations(page)).toEqual([])
    })

    test('a planner with images, its grid and tray filled', async ({ page }) => {
      await fillBoard(page)
      expect(await violations(page)).toEqual([])
    })

    test('the lightbox and the phone preview', async ({ page }) => {
      await fillBoard(page)
      await openDialog(page, 'Preview on a phone')
      expect(await violations(page)).toEqual([])
      await page.keyboard.press('Escape')
      await page.locator('section').getByRole('img').first().dblclick()
      await page.getByRole('dialog').waitFor()
      expect(await violations(page)).toEqual([])
    })

    test('help and settings', async ({ page }) => {
      await page.goto('/')
      await openDialog(page, 'Help')
      expect(await violations(page)).toEqual([])
      await page.keyboard.press('Escape')
      await openDialog(page, 'Settings')
      expect(await violations(page)).toEqual([])
    })

    test('a legal page', async ({ page }) => {
      await page.goto('/privacy')
      await page.getByRole('heading', { level: 1 }).waitFor()
      expect(await violations(page)).toEqual([])
    })
  })
}

test('an icon button stays opaque on hover, so it reads over any image', async ({ page }) => {
  await fillBoard(page)
  const cell = page
    .locator('section')
    .getByRole('group', { name: /^Image/ })
    .first()
  await cell.hover()
  const remove = cell.getByRole('button', { name: 'Delete' })
  await remove.hover()
  // A translucent colour computes with an alpha after a slash.
  await expect
    .poll(() => remove.evaluate((button) => getComputedStyle(button).backgroundColor))
    .not.toContain('/')
})

test('the header lines up with the tray and the grid', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await fillBoard(page)
  const left = async (selector: string) => (await page.locator(selector).first().boundingBox())?.x
  const right = async (selector: string) => {
    const box = await page.locator(selector).last().boundingBox()
    return (box?.x ?? 0) + (box?.width ?? 0)
  }
  expect(await left('header a')).toBe(await left('aside [data-drop-id]'))
  expect(await right('header button')).toBe(await right('section [data-drop-id]'))
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true })

  test('the planner, with no sideways scroll', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { level: 1 }).first().waitFor()
    expect(await violations(page)).toEqual([])
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
