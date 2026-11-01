import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, mergeConfig } from 'vite'

import { app } from '../../.devtools/vite/vite.ts'
import { site } from './src/config/site.ts'

// Only when asked for, with make bundle-report: gzipping every module slows a build.
const report = process.env.ANALYZE
  ? [visualizer({ filename: 'dist/bundle-report.html', gzipSize: true, template: 'treemap' })]
  : []

// The hosting profile's plugin, if there is one, comes in through app().
export default defineConfig(
  // public/_headers allows no data: URIs, so a small font or image has to stay a file.
  mergeConfig(await app({ site }), {
    build: { assetsInlineLimit: 0 },
    plugins: report,
    // Every source file, not just what the first page reaches. Otherwise a lazy dialog's new
    // dependency is found while it loads, and the dev server fails that request with a 504.
    optimizeDeps: { entries: ['src/**/*.{ts,tsx}'] },
    // The default worker format inlines dynamic imports, which would load the metadata reader and
    // the city list with every import, for people who have not turned either on.
    worker: { format: 'es' }
  })
)
