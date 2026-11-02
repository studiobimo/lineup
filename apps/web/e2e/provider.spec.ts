import { expect, type Page, test } from '@playwright/test'

import { watchErrors } from './fixtures'
import { mockProvider } from './provider-mock'

const KEY = 'pasted-key-ending-abcd'

async function openSettings(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  return page.getByRole('dialog', { name: 'Settings' })
}

async function addKey(page: Page, key = KEY) {
  const settings = await openSettings(page)
  await settings.getByLabel('Zernio API key').fill(key)
  await settings.getByRole('button', { name: 'Save key' }).click()
  return settings
}

test('someone with no key sends nothing to the provider', async ({ page }) => {
  const provider = await mockProvider(page)
  await openSettings(page)
  await expect(page.getByRole('link', { name: 'Zernio', exact: true })).toBeVisible()
  expect(provider.requests).toEqual([])
})

test('a key is saved, its account chosen, and only its end is ever shown', async ({ page }) => {
  const errors = watchErrors(page)
  const provider = await mockProvider(page)
  const settings = await addKey(page)
  await expect(settings.getByText(/Key ending abcd, good until/)).toBeVisible()
  await expect(settings.getByRole('combobox', { name: 'Instagram account' })).toHaveText(/@studio/)
  await expect(settings.getByLabel('Zernio API key')).toHaveCount(0)
  expect(provider.requests).toContain('PUT /key')

  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }))
  expect(stored).toContain('abcd')
  expect(stored).not.toContain(KEY)
  expect(errors).toEqual([])
})

test('a refused key says so, and stays to be corrected', async ({ page }) => {
  await mockProvider(page)
  const settings = await addKey(page, 'a-bad-pasted-key')
  await expect(settings.getByText('That key was refused.', { exact: false })).toBeVisible()
  await expect(settings.getByLabel('Zernio API key')).toHaveValue('a-bad-pasted-key')
})

test('a key that sees several profiles asks which one', async ({ page }) => {
  const provider = await mockProvider(page, {
    profiles: [
      { id: 'one', name: 'Personal' },
      { id: 'two', name: 'Studio' }
    ]
  })
  const settings = await addKey(page)
  const save = settings.getByRole('button', { name: 'Save key' })
  await expect(save).toBeDisabled()

  await settings.getByRole('combobox', { name: 'Profile' }).click()
  await page.getByRole('option', { name: 'Studio' }).click()
  await save.click()
  await expect(settings.getByText(/Key ending abcd/)).toBeVisible()
  expect(provider.bodies[provider.requests.lastIndexOf('PUT /key')]).toMatchObject({
    key: KEY,
    profileId: 'two'
  })
})

test('several accounts wait to be chosen, and the choice is kept', async ({ page }) => {
  await mockProvider(page, {
    accounts: [
      { id: 'one', username: 'first' },
      { id: 'two', username: 'second' }
    ]
  })
  const settings = await addKey(page)
  await settings.getByRole('combobox', { name: 'Instagram account' }).click()
  await page.getByRole('option', { name: '@second' }).click()

  await page.reload()
  const again = page.getByRole('dialog', { name: 'Settings' })
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(again.getByRole('combobox', { name: 'Instagram account' })).toHaveText(/@second/)
})

test('a key with no account offers to connect one', async ({ page }) => {
  await mockProvider(page, { accounts: [] })
  const settings = await addKey(page)
  await expect(settings.getByText('This key has no Instagram account yet.')).toBeVisible()
  await settings.getByRole('button', { name: 'Connect Instagram' }).click()
  await expect(page).toHaveURL(/\/connected$/)
})

test('forgetting the key clears it from this browser', async ({ page }) => {
  const provider = await mockProvider(page)
  const settings = await addKey(page)
  await settings.getByRole('button', { name: 'Forget key' }).click()
  await expect(settings.getByLabel('Zernio API key')).toBeVisible()
  expect(provider.requests).toContain('DELETE /key')
  const stored = await page.evaluate(() => localStorage.getItem('provider-connection'))
  expect(stored).not.toContain('abcd')
})

test('a cookie that has gone turns the settings back to adding a key', async ({ page }) => {
  await mockProvider(page)
  await addKey(page)
  // A new page with the hint but with the mock's key state gone, as a cleared cookie leaves it.
  const fresh = await page.context().newPage()
  await mockProvider(fresh)
  await fresh.goto('/')
  await fresh.getByRole('button', { name: 'Settings' }).click()
  await expect(fresh.getByLabel('Zernio API key')).toBeVisible()
  await fresh.close()
})

test('an expired key says so, and is asked for again', async ({ page }) => {
  await mockProvider(page)
  await page.addInitScript(() =>
    localStorage.setItem(
      'provider-connection',
      JSON.stringify({ last4: 'abcd', expiresAt: '2020-01-01T00:00:00.000Z' })
    )
  )
  const settings = await openSettings(page)
  await expect(settings.getByText(/Your key has expired/)).toBeVisible()
  await expect(settings.getByLabel('Zernio API key')).toBeVisible()
})

test('an account that cannot be loaded offers to try again', async ({ page }) => {
  const provider = await mockProvider(page)
  provider.failures.set('/accounts', { status: 502, code: 'provider_failed' })
  const settings = await addKey(page)
  await expect(settings.getByText(/did not answer/)).toBeVisible()

  provider.failures.clear()
  await settings.getByRole('button', { name: 'Try again' }).click()
  await expect(settings.getByRole('combobox', { name: 'Instagram account' })).toHaveText(/@studio/)
})
