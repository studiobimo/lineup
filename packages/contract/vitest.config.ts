import { defineConfig, mergeConfig } from 'vitest/config'

import { base } from '../../.devtools/vite/vitest.ts'

// The first tests arrive with the first route, in M4.
export default mergeConfig(base, defineConfig({ test: { passWithNoTests: true } }))
