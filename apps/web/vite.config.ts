import { rm } from 'node:fs/promises'

import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, mergeConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { app } from '../../.devtools/vite/vite.ts'
import { site } from './src/config/site.ts'

const report = process.env.ANALYZE
  ? [visualizer({ filename: 'dist/bundle-report.html', gzipSize: true, template: 'treemap' })]
  : []

const vendors = {
  tanstack: /[\\/]node_modules[\\/]@tanstack[\\/](?!react-form|form-core|react-query|query-core)/
}

const noReferenceInProduction = (): Plugin => ({
  name: 'no-reference-in-production',
  apply: 'build',
  async closeBundle() {
    if (process.env.CLOUDFLARE_ENV !== 'production') return
    await rm('dist/client/api-docs/index.html', { force: true })
    await rm('dist/client/api-docs/start.js', { force: true })
  }
})

export default defineConfig(
  mergeConfig(await app({ site, vendors }), {
    build: { assetsInlineLimit: 0 },
    plugins: [
      ...report,
      noReferenceInProduction(),
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
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
          globIgnores: ['api-docs/**'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/api-docs\//]
        }
      })
    ],
    optimizeDeps: { entries: ['src/**/*.{ts,tsx}'] },
    worker: { format: 'es' }
  })
)
