import { defineConfig } from 'vite'

import { app } from '../../.devtools/vite/vite.ts'
import { site } from './src/config/site.ts'

// The hosting profile's plugin, if there is one, comes in through app().
export default defineConfig(await app({ site }))
