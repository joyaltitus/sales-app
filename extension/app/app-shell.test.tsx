import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { QueueItem } from '../lib/contracts'

const lead: QueueItem = {
  lead_id: 'lead-1', contact_id: 'contact-1', person_id: null, display_name: 'Anjali Nair',
  phone_e164: '919876543210', channel: 'whatsapp', stage_key: 'new', stage_label: 'New',
  status: 'open', owner: null, due_at: null, follow_up_id: null, last_activity_at: null, reason: 'new',
}

vi.mock('../lib/panel-client', () => ({ panelSupabase: { auth: {} } }))
vi.mock('../lib/panel-data', () => ({
  useRepQueue: () => ({ items: [lead], loading: false, error: null, staleAt: null, reload: vi.fn() }),
  useCachedScriptLibrary: () => ({ scripts: [], loading: false, error: null, reload: vi.fn(), staleAt: null }),
}))
vi.mock('@app/lib/targets-data', () => ({
  firstOfMonth: () => '2026-08-01',
  useTarget: () => ({ item: null, loading: false, error: null, reload: vi.fn() }),
  useOwnWonValue: () => ({ value: 0, loading: false, error: null, reload: vi.fn() }),
}))
vi.mock('@app/lib/leads-data', () => ({ useLeadStages: () => ({ stages: [] }), moveLeadStage: vi.fn() }))
vi.mock('@app/lib/objections-data', () => ({
  useObjectionTaxonomy: () => ({ items: [] }),
  useObjectionLogs: () => ({ items: [], loading: false, error: null, reload: vi.fn() }),
  logObjection: vi.fn(),
}))
vi.mock('@app/lib/calls-data', () => ({
  useCallLogs: () => ({ items: [], loading: false, error: null, reload: vi.fn() }),
  startCallSession: vi.fn(), completeCall: vi.fn(),
}))
vi.mock('@app/lib/crm-data', () => ({
  useLeadMemory: () => ({ facts: [], loading: false, error: null, reload: vi.fn() }),
  useNotes: () => ({ items: [], loading: false, error: null, reload: vi.fn() }),
}))
vi.mock('@app/lib/crm-actions', () => ({ addNote: vi.fn(), saveLead: vi.fn() }))

import { AppShell, getRootMounts } from './App'

const identity = { userId: 'user-1', clientId: 'client-1', displayName: 'Rep' }

beforeEach(() => vi.clearAllMocks())

it('uses queue → lead as a pushed view and keeps only secondary destinations in the tab bar', async () => {
  const user = userEvent.setup()
  render(<AppShell identity={identity} />)

  expect(await screen.findByText('Anjali Nair')).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Lead' })).toBeNull()
  await user.click(screen.getByText('Anjali Nair'))
  expect(await screen.findByRole('button', { name: 'Back to queue' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Back to queue' }))
  expect(await screen.findByRole('button', { name: /Open next lead/ })).toBeTruthy()

  for (const label of ['Library', 'Settings', 'Queue']) {
    await user.click(screen.getByRole('link', { name: label }))
    if (label === 'Settings') expect(screen.getByText(/keeps the panel visible beside the chat/)).toBeTruthy()
    else if (label === 'Library') expect(screen.getByText('No scripts yet')).toBeTruthy()
    else expect(screen.getByText('Anjali Nair')).toBeTruthy()
  }

  expect(getRootMounts()).toBe(1)
})

it('restores the selected lead and pushed route from session storage', async () => {
  await chrome.storage.session.set({ 'rep.panelNavigation': { route: '/lead', selected: lead } })
  render(<AppShell identity={identity} />)

  expect(await screen.findByRole('button', { name: 'Back to queue' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Anjali Nair' })).toBeTruthy()
})
