import { expect, type Locator, type Page, test } from '@playwright/test'

import { addImages, grid, groupCells, image, png, tray, watchErrors } from './fixtures'
import { mockProvider } from './provider-mock'

const KEY = 'pasted-key-ending-abcd'

async function openSettings(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await dialog.getByRole('tab', { name: 'Integrations' }).click()
  return dialog
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
  await expect(settings.getByRole('combobox', { name: 'Account' })).toHaveText(/@studio/)
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

test('forgetting the key clears it from this browser', async ({ page }) => {
  const provider = await mockProvider(page)
  const settings = await addKey(page)
  await settings.getByRole('button', { name: 'Key options' }).click()
  await page.getByRole('menuitem', { name: 'Forget key' }).click()
  await expect(settings.getByLabel('Zernio API key')).toBeVisible()
  expect(provider.requests).toContain('DELETE /key')
  const stored = await page.evaluate(() => localStorage.getItem('provider-connection'))
  expect(stored).not.toContain('abcd')
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

const PICTURE = 'https://media.zernio.com/one.png'
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString()
const post = (id: string, thumbnailUrl?: string) => ({ id, thumbnailUrl, publishedAt: YESTERDAY })
const publishedCells = (page: Page) => page.getByRole('img', { name: /^Published/ })

async function connect(page: Page) {
  const settings = await addKey(page)
  await expect(settings.getByRole('combobox', { name: 'Account' })).toBeVisible()
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

const IN_A_WEEK = new Date(Date.now() + 7 * 86_400_000)
const pad = (n: number) => String(n).padStart(2, '0')

// Drives the custom date and time picker: Playwright runs in en-US, so it has a 12-hour clock. ~keep
async function pickTime(dialog: Locator, when: Date) {
  const page = dialog.page()
  await dialog.getByLabel('Date and time').click()
  const day = page.locator(
    `[data-day="${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}"] button`
  )
  while (!(await day.isVisible())) await page.getByRole('button', { name: 'Next month' }).click()
  await day.click()
  await page
    .getByRole('option', { name: pad(when.getHours() % 12 || 12), exact: true })
    .first()
    .click()
  await page
    .getByRole('listbox', { name: 'Minute' })
    .getByRole('option', { name: pad(when.getMinutes()), exact: true })
    .click()
  await page.getByRole('option', { name: when.getHours() < 12 ? 'AM' : 'PM', exact: true }).click()
  await page.keyboard.press('Escape')
}

async function planOnGrid(page: Page, count = 1) {
  await page.goto('/')
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
  await pickTime(dialog, when)
  await dialog.getByRole('button', { name: 'Schedule', exact: true }).click()
}

test('alt text is written under Accessibility and sent with the picture', async ({ page }) => {
  const provider = await mockProvider(page)
  await planOnGrid(page)
  await connect(page)

  const dialog = await openSchedule(page)
  const section = dialog.getByRole('button', { name: 'Accessibility' })
  await expect(section).toHaveAttribute('aria-expanded', 'false')
  await section.click()
  await dialog.getByLabel('Alt text for slide 1').fill('A grey cat on a sofa')
  await schedule(dialog)
  await expect(dialog).toBeHidden()

  const at = provider.requests.indexOf('POST /scheduled-posts')
  expect(provider.bodies[at]).toMatchObject({ altTexts: ['A grey cat on a sofa'] })
})

test('a planned image is sent, scheduled and held in place', async ({ page }) => {
  const errors = watchErrors(page)
  const provider = await mockProvider(page)
  await planOnGrid(page)
  await connect(page)

  const dialog = await openSchedule(page)
  await expect(dialog.getByText(/sent to Zernio and Instagram/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Tag accounts', exact: true }).click()
  await dialog.getByTestId('tag-picture').click()
  await dialog.getByRole('textbox', { name: 'Username for the new tag' }).fill('friend')
  await page.keyboard.press('Enter')
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(dialog.getByText('Tagged: @friend')).toBeVisible()
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

test('the schedule dialog steps through every slide of an album', async ({ page }) => {
  await mockProvider(page)
  await planOnGrid(page, 3)
  await groupCells(page, grid(page), 3)
  await connect(page)

  const dialog = await openSchedule(page)
  const viewer = dialog.getByRole('group', { name: "The post's slides" })
  await expect(viewer.getByRole('tab', { name: /^Show slide/ })).toHaveCount(3)
  await expect(viewer.locator('canvas')).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Next slide' }).click()
  await viewer.getByRole('tab', { name: 'Show slide 2 of 3' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('button', { name: 'Next slide' })).toBeDisabled()
  await expect(viewer.locator('canvas')).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Tag accounts', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /^Slide 3/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

test('a single image shows no slide controls', async ({ page }) => {
  await mockProvider(page)
  await planOnGrid(page)
  await connect(page)
  const dialog = await openSchedule(page)
  await expect(dialog.getByRole('button', { name: 'Next slide' })).toHaveCount(0)
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

test('a post that goes out leaves the board and shows only as the provider’s copy', async ({
  page
}) => {
  const provider = await scheduledCell(page)
  const url = 'https://www.instagram.com/p/abc/'
  await expect(grid(page)).toHaveCount(1)
  provider.scheduled[0] = {
    ...provider.scheduled[0],
    status: 'published',
    url,
    publishedAt: new Date(
      Date.parse(String(provider.scheduled[0].scheduledFor)) + 90_000
    ).toISOString()
  }
  provider.published.push({ id: provider.scheduled[0].id, url, publishedAt: YESTERDAY })
  await page.reload()

  await expect(page.getByText('Your post is published.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'View post' })).toBeVisible()
  await expect(publishedCells(page)).toHaveCount(1)
  await expect(grid(page)).toHaveCount(0)
  await expect(postBadge(page, 'Published')).toHaveCount(0)

  await page.reload()
  await expect(publishedCells(page)).toHaveCount(1)
  await expect(grid(page)).toHaveCount(0)

  // ~keep
  // One anonymous event, sent once and not again after the reloads, with nothing of the post in it.
  expect(provider.telemetry).toHaveLength(1)
  expect(provider.telemetry[0]).toMatchObject({
    kind: 'image',
    images: 1,
    videos: 0,
    delaySeconds: 90,
    account: 'studio'
  })
  expect(JSON.stringify(provider.telemetry)).not.toContain(url)
  expect(JSON.stringify(provider.telemetry)).not.toContain('Hello')
  expect(JSON.stringify(provider.telemetry)).not.toContain(String(provider.scheduled[0].id))
})

const MINUTES = 60_000
const later = (minutes: number) => new Date(IN_A_WEEK.getTime() + minutes * MINUTES)

// The first cell of the grid is the newest post, so the second is scheduled earlier. ~keep
async function scheduleTwo(page: Page, minutes: number) {
  const provider = await mockProvider(page)
  await planOnGrid(page, 2)
  await connect(page)
  const first = await openSchedule(page)
  await schedule(first, IN_A_WEEK, 'First')
  await expect(first).toBeHidden()
  const second = await openSchedule(page, 1)
  await second.getByLabel('Caption').fill('Second')
  await pickTime(second, later(-minutes))
  return { provider, second }
}

// Schedules the second post, then how far apart the two were sent. ~keep
async function gapScheduled({ provider, second }: Awaited<ReturnType<typeof scheduleTwo>>) {
  await second.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(second).toBeHidden()
  const [one, two] = provider.bodies.filter((body) => body.scheduledFor)
  return Date.parse(String(one.scheduledFor)) - Date.parse(String(two.scheduledFor))
}

test('a post too close to the one before warns, suggests a time, and can still be scheduled', async ({
  page
}) => {
  const { provider, second } = await scheduleTwo(page, 2)
  await expect(
    second.getByText(/about 5 minutes to go live before the post at position 1 on your grid/)
  ).toBeVisible()
  await expect(second.getByRole('button', { name: 'Schedule', exact: true })).toBeEnabled()

  await second.getByRole('button', { name: /^Use / }).click()
  await expect(second.getByText(/about 5 minutes to go live/)).toHaveCount(0)
  expect(await gapScheduled({ provider, second })).toBe(5 * MINUTES)
})

test('a warning can be ignored, and the post is scheduled as chosen', async ({ page }) => {
  const { provider, second } = await scheduleTwo(page, 2)
  await expect(second.getByText(/about 5 minutes to go live/)).toBeVisible()
  expect(await gapScheduled({ provider, second })).toBe(2 * MINUTES)
})

test('posts that went live in a different order are explained once', async ({ page }) => {
  const { provider, second } = await scheduleTwo(page, 10)
  await expect(second.getByText(/about \d+ minutes to go live/)).toHaveCount(0)
  await second.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(second).toBeHidden()

  const at = (minutes: number) => new Date(Date.now() - 3_600_000 + minutes * MINUTES).toISOString()
  provider.scheduled = provider.scheduled.map((post) => ({ ...post, status: 'published' }))
  provider.published.push(
    { id: 'post-1', publishedAt: at(12) },
    { id: 'post-2', publishedAt: at(20) }
  )
  await page.reload()

  const notice = page.getByRole('alertdialog', {
    name: 'Some posts went live in a different order'
  })
  await expect(notice).toBeVisible()
  await expect(notice.getByText(/orders your posts by when they actually went live/)).toBeVisible()
  await notice.getByRole('button', { name: 'Got it' }).click()
  await expect(notice).toBeHidden()

  await page.reload()
  await expect(publishedCells(page)).toHaveCount(2)
  await expect(notice).toBeHidden()
})

test('a post that failed gives the reason, and a new time tries again', async ({ page }) => {
  const provider = await scheduledCell(page)
  const failure = 'The image is too wide'
  provider.scheduled[0] = { ...provider.scheduled[0], status: 'failed', failure }
  await page.reload()

  await postBadge(page, `Did not go out: ${failure}`).click()
  const dialog = page.getByRole('dialog', { name: 'Your post' })
  await expect(dialog.getByText(failure)).toBeVisible()
  await pickTime(dialog, IN_A_WEEK)
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
