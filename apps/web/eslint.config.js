import { defineConfig, globalIgnores } from 'eslint/config'

import { app } from '../../.devtools/vite/eslint.js'

export default defineConfig([
  app,
  globalIgnores(['src/components/ui']),
  {
    files: ['src/**/*.tsx'],
    rules: { 'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['region', 'tabpanel'] }] }
  }
])
