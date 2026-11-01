import { defineConfig, mergeConfig } from 'vite'

import { app } from '../../.devtools/vite/vite.ts'
import { site } from './src/config/site.ts'

// The hosting profile's plugin, if there is one, comes in through app().
export default defineConfig(
  // public/_headers allows no data: URIs, so a small font or image has to stay a file.
  mergeConfig(await app({ site }), { build: { assetsInlineLimit: 0 } })
)
