/// <reference lib="dom" />

import { expect, type Locator, type Page, test } from '@playwright/test'

import {
  addImages,
  image,
  png,
  reloadWhenSaved,
  savedBoard,
  savedGridSize,
  watchErrors
} from './fixtures'

test('imports, arranges, undoes and comes back after a reload', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')

  await addImages(page, [
    image('one.png'),
    image('two.png'),
    image('three.png'),
    { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') }
  ])

  const images = page.getByRole('img')
  await expect(images).toHaveCount(3)
  await expect(page.getByText('1 image could not be read.')).toBeVisible()
  // An empty canvas is 300 wide, and it counts as an image before anything is drawn.
  await expect(images.first()).toHaveJSProperty('width', 2)

  await page.getByRole('button', { name: 'Move to the grid' }).first().click()
  const grid = page.locator('section')
  await expect(grid.getByRole('img')).toHaveCount(1)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(grid.getByRole('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(grid.getByRole('img')).toHaveCount(1)

  await reloadWhenSaved(page, ({ grid }) => grid.length === 1)
  await expect(images).toHaveCount(3)
  await expect(grid.getByRole('img')).toHaveJSProperty('width', 2)

  expect(errors).toEqual([])
})

test('undo reaches past a reload, and brings back a deleted image', async ({ page }) => {
  const { before, cells } = await boardOfFour(page)
  const remove = page.locator('section').getByRole('button', { name: 'Delete' })
  await remove.first().evaluate((button) => (button as HTMLElement).click())
  await expect(cells).toHaveCount(2)

  await reloadWhenSaved(page, ({ grid }) => grid.length === 2)
  await expect(cells).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(cells).toHaveCount(3)
  await expect.poll(async () => (await savedBoard(page)).grid).toEqual(before.grid)
  await expect(cells.first()).toHaveJSProperty('width', 2)

  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(cells).toHaveCount(2)
})

test('one tab at a time changes a board', async ({ context, page }) => {
  await page.goto('/')
  await addImages(page, [image('one.png'), image('two.png')])
  await expect(page.getByRole('img')).toHaveCount(2)

  const notice = 'This board is open in another tab'
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.getByRole('heading', { name: notice })).toBeVisible()
  await expect(second.getByRole('img')).toHaveCount(0)

  // Opening a second tab must not have touched the first one's board or its images.
  await page.getByRole('button', { name: 'Delete' }).first().click()
  await expect(page.getByRole('img')).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('img')).toHaveCount(2)

  await second.getByRole('button', { name: 'Use it here' }).click()
  await expect(second.getByRole('img')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: notice })).toBeVisible()

  await second.close()
  await expect(page.getByRole('img')).toHaveCount(2)

  // The history moved between the tabs with the board, so the delete undone above can be redone.
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(page.getByRole('img')).toHaveCount(1)
})

// Builds real files in the page, because a drop or a paste can only be dispatched from inside it.
const fileData = (page: Page, base64: string, names: string[]) =>
  page.evaluateHandle(
    ([data, list]) => {
      const bytes = Uint8Array.from(atob(data as string), (char) => char.charCodeAt(0))
      const transfer = new DataTransfer()
      for (const name of list as string[]) {
        const type = name.endsWith('.png') ? 'image/png' : 'text/plain'
        transfer.items.add(new File([bytes], name, { type }))
      }
      return transfer
    },
    [base64, names]
  )

test('dropping files shows the overlay and adds the images, with one note on the rest', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()
  const data = await fileData(page, png.toString('base64'), ['a.png', 'b.png', 'notes.txt'])

  await page.dispatchEvent('html', 'dragenter', { dataTransfer: data })
  await expect(page.getByText('Drop to add to the tray')).toBeVisible()

  await page.dispatchEvent('html', 'drop', { dataTransfer: data })
  await expect(page.getByText('Drop to add to the tray')).toBeHidden()
  await expect(page.getByRole('img')).toHaveCount(2)
  await expect(page.getByText('1 file was not an image.')).toBeVisible()
})

test('pasting an image adds it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()
  const data = await fileData(page, png.toString('base64'), ['pasted.png'])
  // dispatchEvent sends a paste as a plain Event, which would drop clipboardData.
  await data.evaluate((clipboardData) => {
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData }))
  })
  await expect(page.getByRole('img')).toHaveCount(1)
})

// A real mouse, in steps, because the drag only starts once the pointer has travelled.
async function drag(
  page: Page,
  from: Locator,
  to: Locator,
  { shift = false, x = 0.5, y = 0.5 } = {}
) {
  const start = await from.boundingBox()
  const end = await to.boundingBox()
  if (!start || !end) throw new Error('both ends of a drag have to be on screen')
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2, { steps: 3 })
  await page.mouse.move(end.x + end.width * x, end.y + end.height * y, { steps: 5 })
  if (shift) await page.keyboard.down('Shift')
  // The next frame, so the indicator is up when a test looks at it.
  await page.mouse.move(end.x + end.width * x + 1, end.y + end.height * y)
}

/** The sensor starts listening for arrow keys on the tick after a cell is picked up. */
async function pickUpWithKeyboard(page: Page) {
  await page.getByRole('group', { name: 'Image 1' }).last().focus()
  await page.keyboard.press('Space')
  await expect(page.locator('[data-ghost]')).toBeVisible()
  await page.waitForTimeout(50)
}

async function boardOfFour(page: Page) {
  await page.goto('/')
  await addImages(page, [image('a.png'), image('b.png'), image('c.png'), image('d.png')])
  const move = page.getByRole('button', { name: 'Move to the grid' })
  await expect(move).toHaveCount(4)
  for (let cell = 0; cell < 3; cell += 1)
    await move.first().evaluate((el) => (el as HTMLElement).click())
  await expect(page.locator('section').getByRole('img')).toHaveCount(3)
  await expect.poll(() => savedGridSize(page)).toBe(3)
  return { before: await savedBoard(page), cells: page.locator('section').getByRole('img') }
}

test('dragging a cell onto another swaps them, and undo puts them back', async ({ page }) => {
  const errors = watchErrors(page)
  const { before, cells } = await boardOfFour(page)
  const [a, b, c] = before.grid

  await drag(page, cells.nth(0), cells.nth(2))
  await expect(page.locator('[data-mark="swap"]')).toHaveCount(1)
  await page.mouse.up()
  await expect.poll(async () => (await savedBoard(page)).grid).toEqual([c, b, a])

  // The library swallows clicks for 50 ms after a drag, which only a script can be fast enough for.
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await savedBoard(page)).grid).toEqual([a, b, c])
  expect(errors).toEqual([])
})

test('a cell can be picked up, moved and dropped with the keyboard', async ({ page }) => {
  const { before, cells } = await boardOfFour(page)
  const [a, b, c] = before.grid

  await pickUpWithKeyboard(page)
  await expect(page.getByRole('status').filter({ hasText: 'Picked up image 1' })).toHaveCount(1)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-mark="swap"]')).toHaveCount(1)
  await page.keyboard.press('Space')

  await expect.poll(async () => (await savedBoard(page)).grid).toEqual([c, b, a])
  await expect(cells).toHaveCount(3)
})

test('clearing asks first, says how many, and can be undone', async ({ page }) => {
  const errors = watchErrors(page)
  const { before } = await boardOfFour(page)

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByRole('button', { name: 'Tray (1)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Grid (3)' })).toBeVisible()
  await page.getByRole('button', { name: 'Both (4)' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect.poll(() => savedBoard(page)).toEqual({ tray: [], grid: [] })

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => savedBoard(page)).toEqual(before)
  expect(errors).toEqual([])
})

test('an image opens full size, steps along, zooms, and closes', async ({ page }) => {
  const errors = watchErrors(page)
  const { cells } = await boardOfFour(page)
  const dialog = page.getByRole('dialog')
  const zoom = dialog.locator('[data-zoom]')

  await cells.nth(0).dblclick()
  await expect(dialog.getByText('1 of 3')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Previous image' })).toBeDisabled()
  // A canvas with nothing drawn on it is 300 wide, and these images are 2.
  await expect
    .poll(() => dialog.locator('canvas').evaluate((c: HTMLCanvasElement) => c.width))
    .toBe(2)

  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByText('2 of 3')).toBeVisible()

  await dialog.getByRole('button', { name: 'Zoom in' }).click()
  await expect(zoom).toHaveAttribute('data-zoom', '2')
  await dialog.getByRole('button', { name: 'Zoom out' }).click()
  await expect(zoom).toHaveAttribute('data-zoom', '1')

  // Zoom out is disabled now, and focus was on it. The keyboard has to keep working regardless.
  await page.keyboard.press('ArrowLeft')
  await expect(dialog.getByText('1 of 3')).toBeVisible()

  // Undo belongs to the board, which the lightbox covers. Give a save the time to land if it ran.
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(200)
  expect((await savedBoard(page)).grid).toHaveLength(3)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the phone preview shows the planned grid, and changes nothing', async ({ page }) => {
  const errors = watchErrors(page)
  const { before } = await boardOfFour(page)

  await page.getByRole('button', { name: 'Preview on a phone' }).click()
  const phone = page.locator('[data-phone]')
  await expect(phone.getByRole('img')).toHaveCount(3)
  await expect(phone.getByText('posts')).toBeVisible()
  await expect(phone.locator('[data-empty-slot]')).toHaveCount(6)
  await expect(phone.locator('[data-drop-id]')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(phone).toHaveCount(0)
  expect(await savedBoard(page)).toEqual(before)
  expect(errors).toEqual([])
})

test('a handle and name from Settings fill the phone preview, and survive a reload', async ({
  page
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Handle').fill('https://www.instagram.com/some.name/')
  await expect(page.getByLabel('Handle')).toHaveValue('some.name')
  await page.getByLabel('Name').fill('Some Name')
  await page.keyboard.press('Escape')

  await page.reload()
  await page.getByRole('button', { name: 'Preview on a phone' }).click()
  const phone = page.locator('[data-phone]')
  await expect(phone.getByText('some.name')).toBeVisible()
  await expect(phone.getByText('Some Name')).toBeVisible()
})

// What a full device does to a write, so the app's own handling of it runs for real.
const fillStorage = (page: Page) =>
  page.evaluateHandle(() => {
    const { put } = IDBObjectStore.prototype
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    return () => {
      IDBObjectStore.prototype.put = put
    }
  })

test('a full device is explained, and the next import still works', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()
  const free = await fillStorage(page)

  await addImages(page, [image('one.png')])
  await expect(page.getByText('This device is out of room for images')).toBeVisible()
  await expect(page.getByRole('img')).toHaveCount(0)

  await free.evaluate((restore) => restore())
  await addImages(page, [image('two.png')])
  await expect(page.getByRole('img')).toHaveCount(1)
})

test('a save that fails is reported until one goes through', async ({ page }) => {
  await page.goto('/')
  await addImages(page, [image('one.png'), image('two.png')])
  await expect(page.getByRole('img')).toHaveCount(2)
  const free = await fillStorage(page)

  await page.getByRole('button', { name: 'Move to the grid' }).first().click()
  const warning = page.getByText('Your latest changes are not saved yet')
  await expect(warning).toBeVisible()

  await free.evaluate((restore) => restore())
  await page.getByRole('button', { name: 'Move to the grid' }).first().click()
  await expect(warning).toBeHidden()
  await expect.poll(() => savedGridSize(page)).toBe(2)
})

test('dropping a folder takes the images in it and its subfolders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()

  // A script cannot make a real folder drag, so these stand in for the entries the browser gives.
  await page.evaluate((base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const file = (name: string, type: string) => ({
      isFile: true,
      isDirectory: false,
      file: (done: (file: File) => void) => done(new File([bytes], name, { type }))
    })
    const folder = (children: unknown[]) => ({
      isFile: false,
      isDirectory: true,
      createReader() {
        let batch = children
        return {
          readEntries(done: (entries: unknown[]) => void) {
            done(batch)
            batch = []
          }
        }
      }
    })
    const holiday = folder([
      file('one.png', 'image/png'),
      file('notes.txt', 'text/plain'),
      folder([file('two.png', 'image/png')])
    ])
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', {
      value: {
        types: ['Files'],
        items: [{ kind: 'file', webkitGetAsEntry: () => holiday, getAsFile: () => null }]
      }
    })
    window.dispatchEvent(drop)
  }, png.toString('base64'))

  await expect(page.getByRole('img')).toHaveCount(2)
  await expect(page.getByText('1 file was not an image.')).toBeVisible()
})
