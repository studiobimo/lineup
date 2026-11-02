import { expect, type Locator, type Page, test } from '@playwright/test'

import { addImages, grid, groupCells, image, png, tray, watchErrors } from './fixtures'
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

const IN_A_WEEK = new Date(Date.now() + 7 * 86_400_000)
/** As a date and time field wants it, here and in the zone the test runs in. */
const fieldTime = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

async function planOnGrid(page: Page, count = 1) {
  await page.goto('/')
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()
  await addImages(
    page,
    Array.from({ length: count }, (_, index) => image(`${index}.png`))
  )
  await expect(tray(page)).toHaveCount(count)
  await page.getByRole('button', { name: 'Move all to the grid' }).click()
  await expect(grid(page)).toHaveCount(count)
}

async function openSchedule(page: Page, position = 0) {
  const cell = grid(page).nth(position)
  await cell.hover()
  await cell.getByRole('button', { name: 'Schedule', exact: true }).click()
  return page.getByRole('dialog', { name: 'Schedule a post' })
}

async function schedule(dialog: Locator, when = IN_A_WEEK, caption = 'Hello') {
  await dialog.getByLabel('Caption').fill(caption)
  await dialog.getByLabel('Date and time').fill(fieldTime(when))
  await dialog.getByRole('button', { name: 'Schedule', exact: true }).click()
}

test('no key, no way to schedule', async ({ page }) => {
  await mockProvider(page)
  await planOnGrid(page)
  await grid(page).first().hover()
  await expect(grid(page).first().getByRole('button', { name: 'Move to the tray' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Schedule', exact: true })).toHaveCount(0)
})

test('a planned image is sent, scheduled and held in place', async ({ page }) => {
  const errors = watchErrors(page)
  const provider = await mockProvider(page)
  await planOnGrid(page)
  await connect(page)

  const dialog = await openSchedule(page)
  await expect(dialog.getByText(/sent to Zernio and Instagram/)).toBeVisible()
  await schedule(dialog)
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: /^Scheduled for/ })).toBeVisible()

  const at = provider.requests.indexOf('POST /scheduled-posts')
  expect(provider.bodies[at]).toMatchObject({
    accountId: 'account-1',
    caption: 'Hello',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
  expect(provider.bodies[at].mediaUrls).toHaveLength(1)
  expect(provider.headers[provider.requests.indexOf('PUT storage')]['content-type']).toBe(
    'image/jpeg'
  )
  expect(provider.requests.indexOf('POST /uploads')).toBeLessThan(at)

  const cell = grid(page).first()
  await cell.hover()
  await expect(cell.getByRole('button', { name: /^Scheduled for/ })).toBeVisible()
  await expect(cell.getByRole('button', { name: 'Open full size' })).toBeVisible()
  await expect(cell.getByRole('button', { name: 'Move to the tray' })).toHaveCount(0)
  await expect(cell.getByRole('button', { name: 'Schedule', exact: true })).toHaveCount(0)
  await expect(cell.getByRole('button', { name: /lock/i })).toHaveCount(0)

  await page.reload()
  await expect(
    grid(page)
      .first()
      .getByRole('button', { name: /^Scheduled for/ })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('an album goes as one post, and each image on its own', async ({ page }) => {
  const provider = await mockProvider(page)
  await planOnGrid(page, 2)
  await groupCells(page, grid(page), 2)
  await connect(page)

  const dialog = await openSchedule(page)
  await expect(dialog.getByText(/2 images go out as a carousel/)).toBeVisible()
  await schedule(dialog)
  await expect(dialog).toBeHidden()

  expect(provider.requests.filter((request) => request === 'PUT storage')).toHaveLength(2)
  const at = provider.requests.indexOf('POST /scheduled-posts')
  expect(provider.bodies[at].mediaUrls).toHaveLength(2)
})

test('a time that has passed is refused before anything leaves', async ({ page }) => {
  const provider = await mockProvider(page)
  await planOnGrid(page)
  await connect(page)
  const dialog = await openSchedule(page)
  await schedule(dialog, new Date(Date.now() - 86_400_000))
  await expect(dialog.getByText('Pick a time that is still to come.')).toBeVisible()
  expect(provider.requests).not.toContain('POST /uploads')
})

test('a caption past the limit is refused before anything leaves', async ({ page }) => {
  const provider = await mockProvider(page)
  await planOnGrid(page)
  await connect(page)
  const dialog = await openSchedule(page)
  await schedule(dialog, IN_A_WEEK, 'x'.repeat(2201))
  await expect(dialog.getByText('2201 of 2200')).toBeVisible()
  await expect(dialog).toBeVisible()
  expect(provider.requests).not.toContain('POST /uploads')
})

test('a retry after a lost answer does not post twice', async ({ page }) => {
  const provider = await mockProvider(page, { loseNextAnswer: true })
  await planOnGrid(page)
  await connect(page)
  const dialog = await openSchedule(page)
  await schedule(dialog)
  await expect(dialog.getByText(/Could not reach the server/)).toBeVisible()

  await dialog.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(provider.scheduled).toHaveLength(1)
  expect(provider.requests.filter((request) => request === 'PUT storage')).toHaveLength(1)
  const keys = provider.requests.flatMap((request, index) =>
    request === 'POST /scheduled-posts' ? [provider.headers[index]['idempotency-key']] : []
  )
  expect(keys).toHaveLength(2)
  expect(new Set(keys).size).toBe(1)
})

test('storage turning an image down says so, and trying again picks up', async ({ page }) => {
  const provider = await mockProvider(page, { storageFails: true })
  await planOnGrid(page)
  await connect(page)
  const dialog = await openSchedule(page)
  await schedule(dialog)
  await expect(dialog.getByText(/Could not reach the server/)).toBeVisible()
  expect(provider.requests).not.toContain('POST /scheduled-posts')

  provider.storageFails = false
  await dialog.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(provider.scheduled).toHaveLength(1)
})

test('a time out of grid order warns, and does not stop anyone', async ({ page }) => {
  const provider = await mockProvider(page)
  await planOnGrid(page, 2)
  await connect(page)
  const first = await openSchedule(page, 0)
  await schedule(first)
  await expect(first).toBeHidden()

  const later = await openSchedule(page, 1)
  await later.getByLabel('Date and time').fill(fieldTime(new Date(IN_A_WEEK.getTime() + 3_600_000)))
  await expect(later.getByText(/will not go out in the order of your grid/)).toBeVisible()
  await later.getByLabel('Date and time').fill(fieldTime(new Date(IN_A_WEEK.getTime() - 3_600_000)))
  await expect(later.getByText(/will not go out in the order of your grid/)).toBeHidden()

  await later.getByLabel('Date and time').fill(fieldTime(new Date(IN_A_WEEK.getTime() + 3_600_000)))
  await later.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(later).toBeHidden()
  expect(provider.scheduled).toHaveLength(2)
})

/** A cell on the grid with a post at the provider, ready for what happens to the post next. */
async function scheduledCell(page: Page) {
  const provider = await mockProvider(page)
  await planOnGrid(page)
  await connect(page)
  const dialog = await openSchedule(page)
  await schedule(dialog)
  await expect(dialog).toBeHidden()
  return provider
}

const postBadge = (page: Page, name: RegExp | string) =>
  grid(page).first().getByRole('button', { name })

test('a post that goes out says so, links to it, and is not shown twice', async ({ page }) => {
  const provider = await scheduledCell(page)
  const url = 'https://www.instagram.com/p/abc/'
  provider.scheduled[0] = { ...provider.scheduled[0], status: 'published', url }
  provider.published.push({ id: provider.scheduled[0].id, url, publishedAt: YESTERDAY })
  await page.reload()

  await postBadge(page, 'Published').click()
  const dialog = page.getByRole('dialog', { name: 'Your post' })
  await expect(dialog.getByRole('link', { name: 'View on Instagram' })).toHaveAttribute('href', url)
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(publishedCells(page)).toHaveCount(0)

  await postBadge(page, 'Published').click()
  await dialog.getByRole('button', { name: 'Free this cell' }).click()
  await expect(dialog).toBeHidden()
  await expect(publishedCells(page)).toHaveCount(1)
})

test('a post that failed gives the reason, and a new time tries again', async ({ page }) => {
  const provider = await scheduledCell(page)
  const failure = 'The image is too wide'
  provider.scheduled[0] = { ...provider.scheduled[0], status: 'failed', failure }
  await page.reload()

  await postBadge(page, `Did not go out: ${failure}`).click()
  const dialog = page.getByRole('dialog', { name: 'Your post' })
  await expect(dialog.getByText(failure)).toBeVisible()
  await dialog.getByLabel('Date and time').fill(fieldTime(IN_A_WEEK))
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toBeHidden()
  await expect(postBadge(page, /^Scheduled for/)).toBeVisible()
})

test('a post can be rescheduled and its caption changed', async ({ page }) => {
  const provider = await scheduledCell(page)
  await postBadge(page, /^Scheduled for/).click()
  const dialog = page.getByRole('dialog', { name: 'Your post' })
  await expect(dialog.getByLabel('Caption')).toHaveValue('Hello')
  await dialog.getByLabel('Caption').fill('Hello again')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toBeHidden()

  const at = provider.requests.findIndex((request) => request.startsWith('PATCH'))
  expect(provider.bodies[at]).toMatchObject({ caption: 'Hello again' })
  await postBadge(page, /^Scheduled for/).click()
  await expect(dialog.getByLabel('Caption')).toHaveValue('Hello again')
})

test('cancelling asks first, then frees the cell', async ({ page }) => {
  const provider = await scheduledCell(page)
  await postBadge(page, /^Scheduled for/).click()
  await page.getByRole('button', { name: 'Cancel post' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Cancel this post?' })
  await confirm.getByRole('button', { name: 'Keep it' }).click()
  await expect(confirm).toBeHidden()
  expect(provider.scheduled).toHaveLength(1)

  await page.getByRole('button', { name: 'Cancel post' }).click()
  await confirm.getByRole('button', { name: 'Cancel post' }).click()
  await expect(confirm).toBeHidden()
  await expect(postBadge(page, /^Scheduled for/)).toHaveCount(0)
  expect(provider.scheduled).toHaveLength(0)

  await grid(page).first().hover()
  await expect(grid(page).first().getByRole('button', { name: 'Move to the tray' })).toBeVisible()
})

test('a post cancelled elsewhere frees its cell', async ({ page }) => {
  const provider = await scheduledCell(page)
  provider.scheduled[0] = { ...provider.scheduled[0], status: 'cancelled' }
  await page.reload()
  await expect(postBadge(page, /^Scheduled for/)).toHaveCount(0)
})

test('a post the provider has lost stays as it was, and cancelling clears it', async ({ page }) => {
  const provider = await scheduledCell(page)
  provider.scheduled.length = 0
  provider.failures.set(`/scheduled-posts/post-1`, { status: 404, code: 'not_found' })
  await page.reload()
  await postBadge(page, /^Scheduled for/).click()
  await page.getByRole('button', { name: 'Cancel post' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel post' }).click()
  await expect(postBadge(page, /^Scheduled for/)).toHaveCount(0)
})

test('a refused cancel says why, and the cell stays', async ({ page }) => {
  const provider = await scheduledCell(page)
  const detail = 'This post has already gone out'
  provider.failures.set('/scheduled-posts/post-1', {
    status: 409,
    code: 'provider_refused',
    detail
  })
  await postBadge(page, /^Scheduled for/).click()
  await page.getByRole('button', { name: 'Cancel post' }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Cancel post' }).click()
  await expect(confirm.getByText(detail)).toBeVisible()
  await confirm.getByRole('button', { name: 'Keep it' }).click()
  await page.keyboard.press('Escape')
  await expect(postBadge(page, /^Scheduled for/)).toBeVisible()
})

test('without a key a post can still be let go, and the cell is never stuck', async ({ page }) => {
  const provider = await scheduledCell(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.getByRole('button', { name: 'Forget key' }).click()
  await expect(settings.getByLabel('Zernio API key')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(settings).toBeHidden()

  await postBadge(page, /^Scheduled for/).click()
  const dialog = page.getByRole('dialog', { name: 'Your post' })
  await expect(dialog.getByText(/does not stop the post/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Free this cell' }).click()
  await expect(postBadge(page, /^Scheduled for/)).toHaveCount(0)
  expect(provider.requests.filter((request) => request.startsWith('DELETE /sch'))).toEqual([])
})
