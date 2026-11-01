import { defineConfig, devices } from '@playwright/test'

const port = 4173

// Against the built app in workerd, because the dev server sends none of public/_headers.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  // A cell in mid-glide is a moving target for a real mouse. The animation has its own check.
  use: { baseURL: `http://localhost:${port}`, contextOptions: { reducedMotion: 'reduce' } },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: `pnpm exec vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI
  }
})
