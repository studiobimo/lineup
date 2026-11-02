import { defineConfig } from 'vitest/config'

import { projects } from '../../.devtools/vite/vitest.ts'

export default defineConfig({
  test: { projects: await projects() }
})
