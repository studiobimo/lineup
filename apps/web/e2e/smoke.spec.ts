import { expect, test } from '@playwright/test'

test('the shell runs under the content security policy', async ({ page }) => {
  // The browser reports a blocked script, style, font or image as a console error.
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  const response = await page.goto('/')
  const policy = response?.headers()['content-security-policy']
  expect(policy).toContain("default-src 'none'")
  expect(response?.headers()['cache-control']).toContain('no-transform')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveClass('dark')
  await page.evaluate('document.fonts.ready')

  const stylesheet = await page.locator('link[rel="stylesheet"]').getAttribute('href')
  const asset = await page.request.get(stylesheet!)
  expect(asset.headers()['content-security-policy']).toBe(policy)
  expect(asset.headers()['cache-control'] ?? '').not.toContain('no-transform')

  expect(errors).toEqual([])
})
