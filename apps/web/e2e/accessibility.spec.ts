import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

import { addImages, grid, groupCells, image, png, savedBoard, tray } from './fixtures'
import { mockProvider } from './provider-mock'

const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(wcag).analyze()
  return violations.map(({ id, nodes }) => `${id}: ${nodes.map((node) => node.target).join(', ')}`)
}

/** A dialog still fading in reads as low contrast. */
async function settled(page: Page, role: 'dialog' | 'alertdialog' = 'dialog') {
  const dialog = page.getByRole(role)
  await dialog.waitFor()
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations({ subtree: true }).map(({ finished }) => finished))
  )
}

async function openDialog(page: Page, button: string) {
  await page.getByRole('button', { name: button }).click()
  await settled(page)
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
})

test('every tab of help and settings', async ({ page }) => {
  await page.goto('/')
  for (const name of ['Help', 'Settings']) {
    await openDialog(page, name)
    for (const tab of await page.getByRole('tab').all()) {
      await tab.click()
      expect(await violations(page)).toEqual([])
    }
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
})

test('a phone preview too long for the phone scrolls from the keyboard', async ({ page }) => {
  await page.goto('/')
  await addImages(
    page,
    Array.from({ length: 15 }, (_, index) => image(`${index}.png`))
  )
  await expect(tray(page)).toHaveCount(15)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await page.getByRole('button', { name: 'Preview on a phone' }).focus()
  await page.keyboard.press('Enter')
  const feed = page.getByRole('region', { name: 'Your feed on the phone' })
  await expect(feed).toBeFocused()
  await settled(page)
  expect(await violations(page)).toEqual([])
  await page.keyboard.press('End')
  await expect.poll(() => feed.evaluate(({ scrollTop }) => scrollTop)).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('the arrows pan a zoomed picture, and step through one that is not', async ({ page }) => {
  await fillBoard(page)
  await grid(page).first().focus()
  await page.keyboard.press('Enter')
  await page.getByRole('menuitem', { name: 'Open full size' }).click()
  const lightbox = page.getByRole('dialog')
  await lightbox.getByRole('button', { name: 'Zoom in' }).click()
  const at = () => lightbox.locator('[data-zoom]').evaluate((zoomed) => zoomed.style.transform)
  const before = await at()
  await page.keyboard.press('ArrowRight')
  await expect.poll(at).not.toBe(before)
  await expect(lightbox.getByText('1 of 6')).toBeVisible()

  await lightbox.getByRole('button', { name: 'Zoom out' }).click()
  await lightbox.locator('[data-zoom="1"]').waitFor()
  await page.keyboard.press('ArrowRight')
  await expect(lightbox.getByText('2 of 6')).toBeVisible()
})

test('focus opens a picture without a tooltip, so Escape goes straight to closing', async ({
  page
}) => {
  await fillBoard(page)
  await grid(page).first().focus()
  await page.keyboard.press('Enter')
  await page.getByRole('menuitem', { name: 'Open full size' }).click()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(grid(page).first()).toBeFocused()
})

test('focus does not land under the header', async ({ page }) => {
  await fillBoard(page)
  await page.setViewportSize({ width: 640, height: 360 })
  const undo = page.getByRole('button', { name: 'Undo' })
  // Under the header, but on the page, so without room left for the header nothing would scroll.
  await undo.evaluate((button) => scrollTo(0, scrollY + button.getBoundingClientRect().top))
  await undo.focus()
  const header = await page.getByRole('banner').boundingBox()
  expect((await undo.boundingBox())!.y).toBeGreaterThanOrEqual(header!.height)
})

test('a focused photo is marked in two colours, one of which shows on any photo', async ({
  page
}) => {
  await fillBoard(page)
  await tray(page).first().focus()
  await page.keyboard.press('ArrowRight')
  const colours = await tray(page)
    .nth(1)
    .evaluate((cell) => ({
      outer: getComputedStyle(cell).outlineColor,
      inner: getComputedStyle(cell, '::after').borderTopColor
    }))
  expect(colours.outer).not.toEqual(colours.inner)
})

/** The one place a person meets a destructive button without first opening anything else. */
async function openClear(page: Page) {
  await fillBoard(page)
  await page.getByRole('button', { name: 'Clear' }).click()
  await settled(page, 'alertdialog')
}

test('the confirmation before clearing the board', async ({ page }) => {
  await openClear(page)
  expect(await violations(page)).toEqual([])
})

test('a mouse reorders without dragging, and undo puts it back', async ({ page }) => {
  await fillBoard(page)
  const before = (await savedBoard(page)).grid
  await grid(page).first().hover()
  await grid(page).first().getByRole('button', { name: 'More actions' }).click()
  expect(await violations(page)).toEqual([])
  await expect(page.getByRole('menuitem', { name: 'Move earlier' })).toBeDisabled()
  await page.getByRole('menuitem', { name: 'Move later' }).click()
  const swapped = [before[1], before[0], ...before.slice(2)]
  await expect.poll(async () => (await savedBoard(page)).grid).toEqual(swapped)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await savedBoard(page)).grid).toEqual(before)
})

test('an album reorders without dragging', async ({ page }) => {
  await fillBoard(page)
  await groupCells(page, grid(page), 3)
  const [album] = (await savedBoard(page)).grid
  const order = async () => (await savedBoard(page)).albums?.[album]
  const [first, second, third] = (await order())!
  await grid(page).first().hover()
  await grid(page).first().getByRole('button', { name: 'Open album' }).click()
  await settled(page)
  const tile = page.getByRole('dialog').getByRole('group', { name: 'Image 1' })
  await expect(tile.getByRole('button', { name: 'Move earlier' })).toHaveCount(0)
  await tile.hover()
  await tile.getByRole('button', { name: 'Move later' }).click()
  await expect.poll(order).toEqual([second, first, third])
})

test('an error stays until it is dismissed, and the dismiss is in reach', async ({ page }) => {
  await page.goto('/')
  await openDialog(page, 'Settings')
  await page.getByRole('tab', { name: 'Storage' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Restore' }).click()
  await (await chooser).setFiles({ name: 'photo.lineup', mimeType: 'text/plain', buffer: png })
  const message = page.getByText('That file could not be restored')
  await expect(message).toBeVisible()
  await page.waitForTimeout(5500)
  await expect(message).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(message).toHaveCount(0)
})

test('the pages around the board', async ({ page }) => {
  for (const path of ['/no-such-page', '/privacy', '/terms']) {
    await page.goto(path)
    await page.getByRole('heading', { level: 1 }).waitFor()
    expect(await violations(page)).toEqual([])
  }
})

test('an album', async ({ page }) => {
  await fillBoard(page)
  await groupCells(page, grid(page), 3)
  await grid(page).first().hover()
  await grid(page).first().getByRole('button', { name: 'Open album' }).click()
  await settled(page)
  expect(await violations(page)).toEqual([])
})

test('a key that is not one is called out at the field', async ({ page }) => {
  await mockProvider(page)
  await page.goto('/')
  await openDialog(page, 'Settings')
  await page.getByRole('tab', { name: 'Integrations' }).click()
  await page.getByRole('button', { name: 'Save key' }).click()
  await expect(page.getByLabel('Zernio API key')).toHaveAccessibleDescription(
    'That does not look like a key.'
  )
  expect(await violations(page)).toEqual([])
})

test('the schedule form says what is wrong, beside the field it is about', async ({ page }) => {
  await mockProvider(page)
  await fillBoard(page)
  await openDialog(page, 'Settings')
  await page.getByRole('tab', { name: 'Integrations' }).click()
  await page.getByLabel('Zernio API key').fill('pasted-key-ending-abcd')
  await page.getByRole('button', { name: 'Save key' }).click()
  await page.getByText(/Key ending abcd/).waitFor()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await grid(page).first().hover()
  await grid(page).first().getByRole('button', { name: 'Schedule', exact: true }).click()
  await settled(page)
  expect(await violations(page)).toEqual([])

  const dialog = page.getByRole('dialog', { name: 'Schedule a post' })
  await dialog.getByLabel('Caption').fill('x'.repeat(2201))
  await dialog.getByLabel('Date and time').fill('2020-01-01T10:00')
  await dialog.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(dialog.getByLabel('Caption')).toHaveAccessibleDescription('1 over the limit of 2200')
  await expect(dialog.getByLabel('Date and time')).toHaveAccessibleDescription(
    'Pick a time that is still to come.'
  )
  expect(await violations(page)).toEqual([])
})

test.describe('in dark', () => {
  test.use({ colorScheme: 'dark' })

  test('the confirmation before clearing the board', async ({ page }) => {
    await openClear(page)
    expect(await violations(page)).toEqual([])
  })

  test('a planner with images, its grid and tray filled', async ({ page }) => {
    await fillBoard(page)
    expect(await violations(page)).toEqual([])
  })
})
