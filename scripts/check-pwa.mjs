// Deterministic PWA installability check (no headless Chrome — Lighthouse 12
// removed the PWA category upstream, Jan 2024). Asserts the build emitted the
// manifest, a service worker, and both icon sizes. Full Lighthouse install
// audit is run manually at deploy read-back.
import { existsSync, readdirSync } from 'node:fs'

const need = [
  'dist/manifest.webmanifest',
  'dist/icons/icon-192.png',
  'dist/icons/icon-512.png',
]
const missing = need.filter((p) => !existsSync(p))

// SW is emitted as sw.js (vite-plugin-pwa / workbox).
const hasSW = readdirSync('dist').some((f) => f === 'sw.js')

if (missing.length || !hasSW) {
  console.error('✗ PWA assets missing:')
  for (const m of missing) console.error('  ' + m)
  if (!hasSW) console.error('  dist/sw.js')
  process.exit(1)
}
console.log('✓ PWA installable assets present (manifest + sw + icons)')
