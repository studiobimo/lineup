import { defineConfig, globalIgnores } from 'eslint/config'

import { app } from '../../.devtools/vite/eslint.js'

// coss ui's components are copied in by the shadcn CLI and keep their upstream code.
export default defineConfig([app, globalIgnores(['src/components/ui'])])
