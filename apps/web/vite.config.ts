import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, mergeConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

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
    plugins: [
      ...report,
      VitePWA({
        injectRegister: 'script',
        registerType: 'autoUpdate',
        manifest: {
          name: site.name,
          short_name: site.name,
          description: site.description,
          display: 'standalone',
          start_url: '/',
          theme_color: site.themeColor,
          background_color: site.themeColor,
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          // From the first visit, not the second, so that a first visit can already go offline.
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//]
        }
      })
    ],
    // Every source file, not just what the first page reaches. Otherwise a lazy dialog's new
    // dependency is found while it loads, and the dev server fails that request with a 504.
    optimizeDeps: { entries: ['src/**/*.{ts,tsx}'] },
    // The default worker format inlines dynamic imports, which would load the metadata reader and
    // the city list with every import, for people who have not turned either on.
    worker: { format: 'es' }
  })
)
