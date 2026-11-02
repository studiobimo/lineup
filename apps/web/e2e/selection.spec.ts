import { expect, type Page, test } from '@playwright/test'

import { addImages, image, watchErrors } from './fixtures'

const tray = (page: Page) => page.locator('aside').getByRole('group', { name: /^Image \d+$/ })
const grid = (page: Page) => page.locator('section').getByRole('group', { name: /^Image \d+$/ })
const bar = (page: Page) => page.getByRole('toolbar', { name: 'Selected cells' })
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'

async function boardOfFour(page: Page) {
  await page.goto('/')
  await addImages(page, ['a.png', 'b.png', 'c.png', 'd.png'].map(image))
  await expect(tray(page)).toHaveCount(4)
}

test('several cells move together, in one undoable step', async ({ page }) => {
  const errors = watchErrors(page)
  await boardOfFour(page)
  await tray(page)
    .nth(0)
    .click({ modifiers: [modifier] })
  await tray(page)
    .nth(2)
    .click({ modifiers: [modifier] })
  await expect(bar(page).getByText('2 selected')).toBeVisible()

  await bar(page).getByRole('button', { name: 'Move to the grid' }).click()
  await expect(grid(page)).toHaveCount(2)
  await expect(bar(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(tray(page)).toHaveCount(4)
  expect(errors).toEqual([])
})

test('Shift selects a range, and the bar deletes it', async ({ page }) => {
  await boardOfFour(page)
  await tray(page)
    .nth(0)
    .click({ modifiers: [modifier] })
  await tray(page)
    .nth(2)
    .click({ modifiers: ['Shift'] })
  await expect(bar(page).getByText('3 selected')).toBeVisible()

  await bar(page).getByRole('button', { name: 'Delete' }).click()
  await expect(tray(page)).toHaveCount(1)
})

test('the cell’s own button starts a selection that plain clicks carry on', async ({ page }) => {
  await boardOfFour(page)
  await tray(page).nth(1).hover()
  await tray(page).nth(1).getByRole('button', { name: 'Select' }).click()
  await tray(page).nth(3).click()
  await expect(bar(page).getByText('2 selected')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(bar(page)).toHaveCount(0)
})

test('the keyboard selects from the cell’s menu, and Delete takes the selection', async ({
  page
}) => {
  await boardOfFour(page)
  const select = async (index: number) => {
    await tray(page).nth(index).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Select' }).click()
  }
  await select(0)
  await select(1)
  await expect(bar(page).getByText('2 selected')).toBeVisible()
  await tray(page).nth(1).focus()
  await page.keyboard.press('Delete')
  await expect(tray(page)).toHaveCount(2)
})
