import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

vi.mock('../lib/session', () => ({
  checkPanelSession: vi.fn(async () => ({ ok: false, reason: 'refresh_failed', message: 'forced refresh failure' })),
  signOutExtension: vi.fn(),
}))
vi.mock('../lib/outbox-store', () => ({ drainOutbox: vi.fn() }))
vi.mock('../lib/panel-client', () => ({
  panelSupabase: { auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi.fn(),
  } },
}))

import App from './App'

it('shows a re-sign-in card after refresh failure and says offline changes remain queued', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Sign in again' })).toBeTruthy()
  expect(screen.getByText(/Offline changes are still safely queued/)).toBeTruthy()
})
