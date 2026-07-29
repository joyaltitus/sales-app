import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL leaves mounted trees behind between tests; without this a query like
// getByText can match a node from a previous test's render and pass for the
// wrong reason.
afterEach(() => {
  cleanup()
})
