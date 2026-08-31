import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { vi } from 'vitest'

vi.mock('../lib/panel-client', () => ({ panelSupabase: { auth: {} } }))
vi.mock('../lib/panel-data', () => ({
  useRepQueue: () => ({ items: [], loading: false, error: null, reload: vi.fn() }),
  useCachedScriptLibrary: () => ({ scripts: [], loading: false, error: null, reload: vi.fn(), staleAt: null }),
}))
vi.mock('@app/lib/targets-data', () => ({
  firstOfMonth: () => '2026-08-01',
  useTarget: () => ({ item: null, loading: false, error: null }),
  useOwnWonValue: () => ({ value: 0, loading: false, error: null }),
}))
vi.mock('@app/lib/scripts-data', () => ({
  useScriptLibrary: () => ({ scripts: [], loading: false, error: null }),
}))
import { AppShell, getRootMounts } from './App'

it('navigates all four screens without remounting the app root', async () => {
  const user = userEvent.setup()
  render(<AppShell identity={{ userId: 'user-1', clientId: 'client-1', displayName: 'Rep' }} />)

  expect(getRootMounts()).toBe(1)
  expect(screen.getByText('Nothing due — nice.')).toBeTruthy()

  for (const label of ['Lead', 'Library', 'Settings', 'Queue']) {
    await user.click(screen.getByRole('link', { name: label }))
    if (label === 'Settings') {
      expect(screen.getByText(/keeps the panel visible beside the chat/)).toBeTruthy()
    } else if (label === 'Lead') expect(screen.getByText('Open a lead from your queue')).toBeTruthy()
    else if (label === 'Library') expect(screen.getByText('No scripts yet')).toBeTruthy()
    else expect(screen.getByText('Nothing due — nice.')).toBeTruthy()
  }

  expect(getRootMounts()).toBe(1)
})
