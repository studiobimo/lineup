import { expect, test } from '@playwright/test'

import { watchErrors } from './fixtures'

test('the legal pages open from Help in their own tab, leaving the board alone', async ({
  context,
  page
}) => {
  await page.goto('/')
  const errors = watchErrors(page)
  await page.getByRole('button', { name: 'Help' }).click()

  const opening = context.waitForEvent('page')
  await page.getByRole('link', { name: 'Privacy' }).click()
  const privacy = await opening
  const legalErrors = watchErrors(privacy)

  await expect(privacy.getByRole('heading', { level: 1 })).toHaveText('Privacy policy')
  await expect(privacy).toHaveTitle('Privacy policy · Lineup')

  await privacy.getByRole('link', { name: 'Terms of use' }).click()
  await expect(privacy.getByRole('heading', { level: 1 })).toHaveText('Terms of use')
  await privacy.close()

  await page.keyboard.press('Escape')
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()
  expect(errors).toEqual([])
  expect(legalErrors).toEqual([])
})
