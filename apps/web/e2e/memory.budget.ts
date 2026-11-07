/// <reference lib="dom" />

import { existsSync, readFileSync } from 'node:fs'

import { type Browser, expect, type Page, test } from '@playwright/test'

import { savedBoard } from './fixtures'

// The PRD's memory budget: a 300-image board adds under 150 MB to the page. It is measured as the
// resident memory of the page's renderer process, which holds the JavaScript heap, decoded images
// and canvases alike, so an image kept anywhere shows. Taken with the board open after a reload,
// because a board is what the PRD budgets: an import's own peak is not given back to the system
// straight away, and would be counted as the board's.
const BUDGET_MB = 150
const IMAGES = 300

test.skip(process.platform !== 'linux', 'reads the renderer process from /proc')

// Wider than a publish copy, so what is stored is what a phone's photos would leave, and small
// enough that making 300 of them stays quick.
const PHOTO = { width: 2048, height: 1536 }

async function largestRenderer(browser: Browser) {
  const session = await browser.newBrowserCDPSession()
  try {
    const { processInfo } = await session.send('SystemInfo.getProcessInfo')
    const sizes = processInfo
      .filter((process) => process.type === 'renderer' && existsSync(`/proc/${process.id}`))
      .map((process) => {
        const status = readFileSync(`/proc/${process.id}/status`, 'utf8')
        return { pid: process.id, mb: Number(/VmRSS:\s+(\d+) kB/.exec(status)?.[1] ?? 0) / 1024 }
      })
    return sizes.reduce((largest, next) => (next.mb > largest.mb ? next : largest))
  } finally {
    await session.detach()
  }
}

/** Collects garbage and lets the page go quiet, so the reading is what stays. */
async function settle(page: Page) {
  const session = await page.context().newCDPSession(page)
  await session.send('HeapProfiler.collectGarbage')
  await session.detach()
  await page.waitForTimeout(1000)
}

/** Closes a page and waits for its process to end, so it cannot be mistaken for the next one. */
async function closeAndWait(page: Page) {
  const { pid } = await largestRenderer(page.context().browser()!)
  await page.close()
  await expect.poll(() => existsSync(`/proc/${pid}`), { timeout: 10_000 }).toBe(false)
}

async function importPhotos(page: Page) {
  await page.evaluate(
    async ({ count, width, height }) => {
      const canvas = new OffscreenCanvas(width, height)
      const context = canvas.getContext('2d')!
      const transfer = new DataTransfer()
      for (let index = 0; index < count; index++) {
        // Blocks of colour, so each file compresses like a photo and not like a flat fill.
        const hue = (index * 37) % 360
        context.fillStyle = `hsl(${hue} 60% 50%)`
        context.fillRect(0, 0, width, height)
        for (let block = 0; block < 200; block++) {
          context.fillStyle = `hsl(${(hue + block * 7) % 360} 70% ${20 + (block % 60)}%)`
          context.fillRect(Math.random() * width, Math.random() * height, 120, 120)
        }
        const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
        transfer.items.add(new File([jpeg], `photo-${index}.jpg`, { type: 'image/jpeg' }))
      }
      const input = document.querySelector<HTMLInputElement>('input[type=file][accept="image/*"]')!
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    },
    { count: IMAGES, ...PHOTO }
  )
  await expect
    .poll(async () => (await savedBoard(page))?.tray.length, { timeout: 240_000 })
    .toBe(IMAGES)
}

/** Scrolls the tray end to end, so every cell has been drawn and let go once. */
async function scrollTray(page: Page) {
  await page
    .locator('aside')
    .first()
    .evaluate(async (tray) => {
      const scroller = [tray, ...tray.querySelectorAll<HTMLElement>('*')].find(
        (element) => element.scrollHeight > element.clientHeight + 100
      )
      if (!scroller) throw new Error('The tray does not scroll')
      for (let top = 0; top <= scroller.scrollHeight; top += scroller.clientHeight) {
        scroller.scrollTop = top
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    })
}

test(`a ${IMAGES}-image board adds under ${BUDGET_MB} MB to the page`, async ({ browser }) => {
  test.setTimeout(360_000)

  // The service worker would keep a closed page's process alive, and the next page would join it.
  const fresh = () => browser.newContext({ serviceWorkers: 'block' })
  const empty = await (await fresh()).newPage()
  await empty.goto('/')
  await expect(empty.getByRole('button', { name: 'Add images' })).toBeVisible()
  await settle(empty)
  const baseline = (await largestRenderer(browser)).mb
  await closeAndWait(empty)

  // One context, so the page that opens the board finds what the first one saved.
  const context = await fresh()
  const importer = await context.newPage()
  await importer.goto('/')
  await importPhotos(importer)
  await closeAndWait(importer)

  const page = await context.newPage()
  await page.goto('/')
  await expect(
    page
      .locator('aside')
      .getByRole('group', { name: /^Image \d+$/ })
      .first()
  ).toBeVisible()
  await scrollTray(page)
  await settle(page)
  const added = (await largestRenderer(browser)).mb - baseline

  console.log(`memory: ${baseline.toFixed(0)} MB empty, ${added.toFixed(0)} MB added by the board`)
  expect(added).toBeLessThan(BUDGET_MB)
})
