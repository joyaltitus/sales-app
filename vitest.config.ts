import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Test config is deliberately SEPARATE from vite.config.ts: the app config
// carries the PWA plugin, which generates a service worker and precache
// manifest on every run. Tests need React transform and nothing else.
//
// Standing up a runner at all is S5's recorded amendment 1 — sales-app shipped
// SA-00 through SA-02 with no test runner, which S4-AMENDMENT #3 flagged as
// something S5 would have to absorb rather than pretend around.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@app': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // src/lib/supabase.ts calls createClient() at module scope, and
    // createClient throws "supabaseUrl is required" on an empty value. Any test
    // that transitively imports it therefore needs these present — including a
    // pure-function test that only wanted a type.
    //
    // These are placeholders, not credentials: every test mocks the client
    // itself, so nothing here is ever dialled. They live in the config rather
    // than in CI's env block so that `npm test` behaves identically on a fresh
    // clone, in CI, and on a machine that happens to have a local .env. This
    // branch's first CI run went red exactly there — green locally off a local
    // .env, red on a runner with none.
    env: {
      VITE_SUPABASE_URL: 'https://test.invalid',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'extension/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
