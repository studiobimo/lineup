import { defineConfig, devices } from '@playwright/test'

const port = 4173

// Against the built app in workerd, because the dev server sends none of public/_headers.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  // Every test makes its own context, so tests share nothing and spread across workers by test,
  // not by file. The runner has two cores, and Playwright would pick one worker for them.
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  // A cell in mid-glide is a moving target for a real mouse. The animation has its own check.
  use: { baseURL: `http://localhost:${port}`, contextOptions: { reducedMotion: 'reduce' } },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    // The PRD's budgets, run alone by `make memory-budget`: slow, and never beside other tests,
    // which would share the machine's memory and time.
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
