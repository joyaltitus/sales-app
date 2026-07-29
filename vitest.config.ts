import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Test config is deliberately SEPARATE from vite.config.ts: the app config
// carries the PWA plugin, which generates a service worker and precache
// manifest on every run. Tests need React transform and nothing else.
//
// Standing up a runner at all is S5's recorded amendment 1 — sales-app shipped
// SA-00 through SA-02 with no test runner, which S4-AMENDMENT #3 flagged as
// something S5 would have to absorb rather than pretend around.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
