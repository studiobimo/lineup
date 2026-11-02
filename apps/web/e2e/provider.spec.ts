import { expect, type Page, test } from '@playwright/test'

import { addImages, grid, image, png, watchErrors } from './fixtures'
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

const PICTURE = 'https://media.zernio.com/one.png'
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString()
const post = (id: string, thumbnailUrl?: string) => ({ id, thumbnailUrl, publishedAt: YESTERDAY })
const publishedCells = (page: Page) => page.getByRole('img', { name: /^Published/ })

async function connect(page: Page) {
  const settings = await addKey(page)
  await expect(settings.getByRole('combobox', { name: 'Instagram account' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(settings).toBeHidden()
}

test('published posts carry on after the planned cells, and stay after a reload', async ({
  page
}) => {
  const errors = watchErrors(page)
  await page.route(PICTURE, (route) => route.fulfill({ contentType: 'image/png', body: png }))
  const provider = await mockProvider(page, { published: [post('one', PICTURE), post('two')] })
  await page.goto('/')
  await addImages(page, [image('planned.png')])
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await connect(page)

  await expect(publishedCells(page)).toHaveCount(2)
  const planned = await grid(page).first().boundingBox()
  const first = await publishedCells(page).first().boundingBox()
  expect(first?.x).toBeGreaterThan(planned?.x ?? Infinity)
  expect(first?.y).toBeCloseTo(planned?.y ?? Infinity, 0)
  await expect(publishedCells(page).first()).toHaveJSProperty('complete', true)

  await page.reload()
  await expect(publishedCells(page)).toHaveCount(2)
  expect(provider.requests).toContain('GET /accounts/account-1/posts')
  expect(errors).toEqual([])
})

test('published posts show on an empty grid, under its empty note', async ({ page }) => {
  await mockProvider(page, { published: [post('one')] })
  await connect(page)
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()
  await expect(publishedCells(page)).toHaveCount(1)
})

test('a picture that will not load leaves a marked cell, not a broken image', async ({ page }) => {
  await page.route(PICTURE, (route) => route.abort())
  await mockProvider(page, { published: [post('one', PICTURE)] })
  await connect(page)
  await expect(page.getByRole('img', { name: /^Published/ }).locator('svg')).toBeVisible()
})

test('published posts that cannot be loaded offer to try again', async ({ page }) => {
  const provider = await mockProvider(page, { published: [post('one')] })
  provider.failures.set('/posts', { status: 502, code: 'provider_failed' })
  await connect(page)
  await expect(page.getByText(/Could not load your published posts/)).toBeVisible()

  provider.failures.clear()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(publishedCells(page)).toHaveCount(1)
})

test('a key past its date asks for nothing', async ({ page }) => {
  const provider = await mockProvider(page, { published: [post('one')] })
  await connect(page)
  await expect(publishedCells(page)).toHaveCount(1)

  await page.evaluate(() => {
    const connection = JSON.parse(localStorage.getItem('provider-connection') ?? '{}') as object
    const expiresAt = new Date(0).toISOString()
    localStorage.setItem('provider-connection', JSON.stringify({ ...connection, expiresAt }))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Grid' })).toBeVisible()
  await expect(publishedCells(page)).toHaveCount(0)
  expect(provider.requests.filter((request) => request.endsWith('/posts'))).toHaveLength(1)
})

test('the phone preview shows the connected account and its posts', async ({ page }) => {
  await mockProvider(page, {
    accounts: [{ id: 'account-1', username: 'studio', displayName: 'The Studio', followers: 1234 }],
    published: [post('one'), post('two')]
  })
  await connect(page)
  await page.getByRole('button', { name: 'Preview on a phone' }).click()
  const phone = page.getByRole('dialog', { name: 'Preview on a phone' })
  const profile = phone.locator('[data-phone]')
  await expect(profile.getByText('studio', { exact: true })).toBeAttached()
  await expect(profile.getByText('The Studio')).toBeAttached()
  await expect(profile.getByText('1234')).toBeAttached()
  await expect(profile.getByText('2', { exact: true })).toBeAttached()
  await expect(phone.locator('[data-empty-slot]')).toHaveCount(7)
})
