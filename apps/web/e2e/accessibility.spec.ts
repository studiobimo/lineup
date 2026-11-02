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

// Axe is the expensive part of each test, so dark mode, where contrast differs, checks only the
// fullest screen.
test.describe('in light', () => {
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
})

test.describe('in dark', () => {
  test.use({ colorScheme: 'dark' })

  test('a planner with images, its grid and tray filled', async ({ page }) => {
    await fillBoard(page)
    expect(await violations(page)).toEqual([])
  })
})
