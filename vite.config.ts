import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// PWA: installable + cached shell offline (workbox precache of the app shell).
// No brand name — neutral placeholder title (MASTER-PLAN §A: never invent one).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // S12 SA-PUSH-01: generateSW has no hook for a hand-written push/notificationclick
      // listener — injectManifest lets src/sw.ts own that while still precaching the app
      // shell (self.__WB_MANIFEST, injected at build time) exactly as generateSW's
      // globPatterns did below.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Sales App',
        short_name: 'Sales',
        description: 'Sales workspace',
        theme_color: '#0f1211',
        background_color: '#0f1211',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  build: {
    // JS budget (§C speed budget) enforced post-build by check-bundle-size.mjs.
    reportCompressedSize: true,
  },
})
