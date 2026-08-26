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

// MV3 surfaces under extension/** read chrome.storage.local, and jsdom has no
// `chrome` global at all. SettingsScreen calls loadChatMode() on mount, so without
// this the call throws an UNHANDLED REJECTION that fails the whole run even though
// the test itself passes — which is exactly how it slipped through α1's CI.
// A small in-memory store rather than a no-op, so set -> get round-trips and a test
// can assert persistence instead of only asserting "did not throw".
// Deliberately PLAIN functions, not vi.fn(), for the same reason as matchMedia above:
// `restoreMocks` would strip the implementation after the first test in a file.
const chromeLocalStore = new Map<string, unknown>()
;(globalThis as { chrome?: unknown }).chrome = {
  storage: {
    local: {
      get: async (key?: string | string[] | null) => {
        const keys =
          key === null || key === undefined
            ? [...chromeLocalStore.keys()]
            : Array.isArray(key)
              ? key
              : [key]
        return Object.fromEntries(
          keys.filter((k) => chromeLocalStore.has(k)).map((k) => [k, chromeLocalStore.get(k)]),
        )
      },
      set: async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) chromeLocalStore.set(k, v)
      },
      remove: async (key: string | string[]) => {
        for (const k of Array.isArray(key) ? key : [key]) chromeLocalStore.delete(k)
      },
      clear: async () => {
        chromeLocalStore.clear()
      },
    },
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
}

// RTL leaves mounted trees behind between tests; without this a query like
// getByText can match a node from a previous test's render and pass for the
// wrong reason.
afterEach(() => {
  cleanup()
  chromeLocalStore.clear()
})
