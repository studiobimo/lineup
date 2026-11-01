/// <reference lib="dom" />

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, type Locator, type Page, test } from '@playwright/test'

import { addImages, choose, image, png, watchErrors } from './fixtures'

// A board is written as soon as it changes, but a reload can still beat the write.
const savedGridSize = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const opening = indexedDB.open('lineup')
        opening.onsuccess = () => {
          const reading = opening.result.transaction('board').objectStore('board').get('current')
          reading.onsuccess = () => {
            opening.result.close()
            resolve((reading.result as { grid: string[] }).grid.length)
          }
        }
      })
  )

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

  await expect.poll(() => savedGridSize(page)).toBe(1)
  await page.reload()
  await expect(images).toHaveCount(3)
  await expect(grid.getByRole('img')).toHaveJSProperty('width', 2)

  expect(errors).toEqual([])
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
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
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

interface Board {
  tray: string[]
  grid: string[]
  locked?: string[]
}

const order = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Board>((resolve) => {
        const opening = indexedDB.open('lineup')
        opening.onsuccess = () => {
          const reading = opening.result.transaction('board').objectStore('board').get('current')
          reading.onsuccess = () => {
            opening.result.close()
            resolve(reading.result as Board)
          }
        }
      })
  )

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
  return { before: await order(page), cells: page.locator('section').getByRole('img') }
}

test('dragging a cell onto another swaps them, and undo puts them back', async ({ page }) => {
  const errors = watchErrors(page)
  const { before, cells } = await boardOfFour(page)
  const [a, b, c] = before.grid

  await drag(page, cells.nth(0), cells.nth(2))
  await expect(page.locator('[data-mark="swap"]')).toHaveCount(1)
  await page.mouse.up()
  await expect.poll(async () => (await order(page)).grid).toEqual([c, b, a])

  // The library swallows clicks for 50 ms after a drag, which only a script can be fast enough for.
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await order(page)).grid).toEqual([a, b, c])
  expect(errors).toEqual([])
})

test('a locked cell holds its place until it is unlocked', async ({ page }) => {
  const errors = watchErrors(page)
  const { before, cells } = await boardOfFour(page)
  const [a, b, c] = before.grid
  const middle = page.locator('section').getByRole('group', { name: 'Image 2' })

  await middle.hover()
  await middle.getByRole('button', { name: 'Lock in place' }).click()
  await expect(middle).toHaveAttribute('aria-roledescription', 'locked image')

  await expect.poll(async () => (await order(page)).locked).toEqual([b])
  await page.reload()
  await expect(cells).toHaveCount(3)
  await expect(middle).toHaveAttribute('aria-roledescription', 'locked image')

  // Dragging the cell does nothing, and dropping on it inserts rather than swapping.
  await drag(page, cells.nth(1), cells.nth(2))
  await expect(page.locator('[data-ghost]')).toHaveCount(0)
  await page.mouse.up()
  await drag(page, cells.nth(0), cells.nth(1))
  await expect(page.locator('[data-mark="swap"]')).toHaveCount(0)
  await page.mouse.up()
  await expect.poll(async () => (await order(page)).grid[1]).toBe(b)

  await middle.focus()
  await page.keyboard.press('Delete')
  await expect(cells).toHaveCount(3)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Unlock' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Move all to the tray' }).click()
  await expect.poll(async () => (await order(page)).grid).toEqual([b])

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await order(page)).grid.sort()).toEqual([a, b, c].sort())
  await middle.hover()
  await middle.getByRole('button', { name: 'Unlock' }).click()
  await expect(middle).toHaveAttribute('aria-roledescription', 'movable image')
  await drag(page, cells.nth(0), cells.nth(1))
  await expect(page.locator('[data-mark="swap"]')).toHaveCount(1)
  await page.mouse.up()
  expect(errors).toEqual([])
})

test('a cell swaps across containers', async ({ page }) => {
  const { before, cells } = await boardOfFour(page)
  const [a, b, c] = before.grid
  const [t] = before.tray

  await drag(page, page.locator('aside').getByRole('img').first(), cells.nth(1))
  await page.mouse.up()
  await expect.poll(async () => (await order(page)).grid).toEqual([a, t, c])
  expect((await order(page)).tray).toEqual([b])
})

test('dropping near the edge of a cell inserts without Shift', async ({ page }) => {
  const { before, cells } = await boardOfFour(page)
  const [a, b, c] = before.grid

  await drag(page, cells.nth(0), cells.nth(2), { x: 0.1 })
  await expect(page.locator('[data-mark="before"]')).toHaveCount(1)
  await expect(page.locator('[data-mark="swap"]')).toHaveCount(0)
  await page.mouse.up()
  await expect.poll(async () => (await order(page)).grid).toEqual([b, a, c])
})

test('either side of a gap draws one line, in the middle of it', async ({ page }) => {
  const { cells } = await boardOfFour(page)
  const line = page.locator('[data-insert-line]')
  const left = (await cells.nth(0).boundingBox())!
  const right = (await cells.nth(1).boundingBox())!

  await drag(page, page.locator('aside').getByRole('img').first(), cells.nth(0), { x: 0.9 })
  await expect(page.locator('[data-mark="after"]')).toHaveCount(1)
  await expect(line).toHaveCount(1)
  const fromLeft = (await line.boundingBox())!

  await page.mouse.move(right.x + right.width * 0.1, right.y + right.height / 2)
  await expect(page.locator('[data-mark="before"]')).toHaveCount(1)
  await expect(line).toHaveCount(1)
  const fromRight = (await line.boundingBox())!
  await page.mouse.up()

  expect(fromRight.x).toBe(fromLeft.x)
  expect(fromLeft.x + fromLeft.width / 2).toBe((left.x + left.width + right.x) / 2)
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

  await expect.poll(async () => (await order(page)).grid).toEqual([c, b, a])
  await expect(cells).toHaveCount(3)
})

test('Escape puts a cell carried by keyboard back', async ({ page }) => {
  const { before } = await boardOfFour(page)

  await pickUpWithKeyboard(page)
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-mark="swap"]')).toHaveCount(1)
  await page.keyboard.press('Escape')

  await expect(page.locator('[data-ghost]')).toHaveCount(0)
  expect(await order(page)).toEqual(before)
})

test('Space on a button inside a cell does not pick the cell up', async ({ page }) => {
  await boardOfFour(page)
  const remove = page.getByRole('button', { name: 'Delete' }).first()
  await remove.focus()
  await page.keyboard.press('Space')
  await expect(page.locator('[data-ghost]')).toHaveCount(0)
})

test('a container is one tab stop, and arrow keys move inside it', async ({ page }) => {
  await boardOfFour(page)
  const grid = page.locator('section').getByRole('group', { name: /^Image/ })

  await expect(page.locator('[data-drop-id][tabindex="0"]')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Delete' }).first()).toHaveAttribute(
    'tabindex',
    '-1'
  )

  await grid.nth(0).focus()
  await page.keyboard.press('ArrowRight')
  await expect(grid.nth(1)).toBeFocused()
  await page.keyboard.press('End')
  await expect(grid.nth(2)).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(grid.nth(2)).toBeFocused()
  await page.keyboard.press('Home')
  await expect(grid.nth(0)).toBeFocused()

  // Tab leaves the grid at once, and coming back lands where focus was.
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Tab')
  await expect(page.locator('section [data-drop-id]:focus')).toHaveCount(0)
  await page.keyboard.press('Shift+Tab')
  await expect(grid.nth(1)).toBeFocused()
})

test("Enter opens a cell's actions, and focus carries on from them", async ({ page }) => {
  const { before } = await boardOfFour(page)
  const grid = page.locator('section').getByRole('group', { name: /^Image/ })

  await grid.nth(0).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Open full size' })).toBeVisible()
  await expect(page.locator('[data-ghost]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(grid.nth(0)).toBeFocused()

  await page.keyboard.press('Enter')
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(grid).toHaveCount(2)
  await expect(grid.nth(0)).toBeFocused()
  expect((await order(page)).grid).toEqual(before.grid.slice(1))
})

test('clearing asks first, says how many, and can be undone', async ({ page }) => {
  const errors = watchErrors(page)
  const { before } = await boardOfFour(page)

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByRole('button', { name: 'Tray (1)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Grid (3)' })).toBeVisible()
  await page.getByRole('button', { name: 'Both (4)' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect.poll(() => order(page)).toEqual({ tray: [], grid: [] })

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => order(page)).toEqual(before)
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
  expect((await order(page)).grid).toHaveLength(3)

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
  expect(await order(page)).toEqual(before)
  expect(errors).toEqual([])
})

test('the phone preview keeps its shape in a short window, and a click outside closes it', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 600 })
  await boardOfFour(page)
  await page.getByRole('button', { name: 'Preview on a phone' }).click()
  const phone = page.locator('[data-phone]')

  await expect.poll(async () => (await phone.boundingBox())?.height).toBeLessThanOrEqual(568)
  const box = await phone.boundingBox()
  expect((box?.height ?? 0) / (box?.width ?? 1)).toBeCloseTo(864 / 410, 2)

  await page.mouse.click(20, 300)
  await expect(phone).toHaveCount(0)
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

test('the introduction shows once, and comes back from Help', async ({ page }) => {
  const intro = page.getByRole('region', { name: 'Plan your feed before it goes live' })
  await page.goto('/')
  await expect(intro).toBeVisible()

  await page.getByRole('button', { name: 'Dismiss the introduction' }).click()
  await expect(intro).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Move images here to plan your feed.')).toBeVisible()
  await expect(intro).toHaveCount(0)

  await page.getByRole('button', { name: 'Help' }).click()
  await expect(page.getByText('Keyboard shortcuts')).toBeVisible()
  await page.getByRole('button', { name: 'Show the introduction' }).click()
  await expect(intro).toBeVisible()
})

test('settings show the theme and what is stored', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByText(/ used$/)).toBeVisible()

  await page.getByRole('button', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: 'Light' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(errors).toEqual([])
})

test('holding Shift inserts on the side the pointer is on', async ({ page }) => {
  const { before, cells } = await boardOfFour(page)
  const [a, b, c] = before.grid

  await drag(page, cells.nth(0), cells.nth(2), { shift: true, x: 0.9 })
  await expect(page.getByText(/^Hold .+ to insert instead of swap$/)).toBeVisible()
  await expect(page.locator('[data-mark="after"]')).toHaveCount(1)
  await expect(page.locator('[data-mark="swap"]')).toHaveCount(0)
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect.poll(async () => (await order(page)).grid).toEqual([b, c, a])
})

test('the empty part of a container takes a drop at the nearest position', async ({ page }) => {
  const { before } = await boardOfFour(page)
  const [t] = before.tray

  const source = page.locator('aside').getByRole('img').first()
  const section = page.locator('section')
  await drag(page, source, section, { x: 0.5, y: 0.97 })
  await page.mouse.up()
  await expect.poll(async () => (await order(page)).grid).toContain(t)
  expect((await order(page)).tray).toEqual([])
})

test('Escape puts a dragged cell back, and a click still works', async ({ page }) => {
  const { before, cells } = await boardOfFour(page)

  await drag(page, cells.nth(0), cells.nth(2))
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.getByText(/^Hold .+ to insert instead of swap$/)).toBeHidden()
  expect(await order(page)).toEqual(before)

  await cells.nth(0).hover()
  await page.getByRole('button', { name: 'Move to the tray' }).first().click()
  await expect(cells).toHaveCount(2)
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

test('the import buttons say what they do on hover', async ({ page }) => {
  await page.goto('/')
  for (const name of ['Add images', 'Add a folder']) {
    await page.getByRole('button', { name }).hover()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
})

test('adding a folder takes the images in it and its subfolders', async ({ page }, testInfo) => {
  const folder = testInfo.outputPath('holiday')
  mkdirSync(join(folder, 'day two'), { recursive: true })
  writeFileSync(join(folder, 'one.png'), png)
  writeFileSync(join(folder, 'notes.txt'), 'not an image')
  writeFileSync(join(folder, 'day two', 'two.png'), png)

  await page.goto('/')
  await choose(page, 'Add a folder', folder)

  await expect(page.getByRole('img')).toHaveCount(2)
})
