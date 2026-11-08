/// <reference lib="dom" />

import { existsSync, readFileSync } from 'node:fs'

import { type Browser, expect, type Page, test } from '@playwright/test'

import { savedBoard } from './fixtures'

const BUDGET_MB = 150
const IMAGES = 300

test.skip(process.platform !== 'linux', 'reads the renderer process from /proc')

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

async function settle(page: Page) {
  const session = await page.context().newCDPSession(page)
  await session.send('HeapProfiler.collectGarbage')
  await session.detach()
  await page.waitForTimeout(1000)
}

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

  const fresh = () => browser.newContext({ serviceWorkers: 'block' })
  const empty = await (await fresh()).newPage()
  await empty.goto('/')
  await expect(empty.getByRole('button', { name: 'Add images' })).toBeVisible()
  await settle(empty)
  const baseline = (await largestRenderer(browser)).mb
  await closeAndWait(empty)

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
