import type { FileChooser, Page } from '@playwright/test'

// A 2 x 2 PNG, so these run through the real decoder and the real worker.
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4zwAE/xkgFAAb8gP91pbyKwAAAABJRU5ErkJggg==',
  'base64'
)

export const image = (name: string) => ({ name, mimeType: 'image/png', buffer: png })

type Chosen = Parameters<FileChooser['setFiles']>[0]

export async function choose(page: Page, button: string, files: Chosen) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: button }).click()
  await (await chooser).setFiles(files)
}

export const addImages = (page: Page, files: Chosen) => choose(page, 'Add images', files)
