import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom implements no media queries at all. src/shell/theme.ts reads
// prefers-color-scheme on first render, so without this every test that mounts
// a shell dies in TopBar. Defaults to light; a test that cares about dark can
// override this stub itself.
// Deliberately a PLAIN function, not vi.fn(): `restoreMocks` in vitest.config.ts
// resets spy implementations between tests, which would strip this one after
// the first test in a file and make every later test fail on
// `.matches of undefined`.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

// RTL leaves mounted trees behind between tests; without this a query like
// getByText can match a node from a previous test's render and pass for the
// wrong reason.
afterEach(() => {
  cleanup()
})
