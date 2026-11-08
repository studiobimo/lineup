import { defineConfig, devices } from '@playwright/test'

const port = 4173

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${port}`, contextOptions: { reducedMotion: 'reduce' } },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    {
      name: 'budget',
      use: devices['Desktop Chrome'],
      testMatch: '*.budget.ts',
      fullyParallel: false
    }
  ],
  webServer: {
    command: `pnpm exec vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI
  }
})
