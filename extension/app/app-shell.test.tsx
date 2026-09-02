import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { QueueItem } from '../lib/contracts'

const lead: QueueItem = {
  lead_id: 'lead-1', contact_id: 'contact-1', person_id: null, display_name: 'Anjali Nair',
  phone_e164: '919876543210', channel: 'whatsapp', stage_key: 'new', stage_label: 'New',
  status: 'open', owner: null, due_at: null, follow_up_id: null, last_activity_at: null, reason: 'new',
}

vi.mock('../lib/panel-client', () => ({
  panelSupabase: { auth: {} },
  HUB_URL: 'https://hub.test',
  hubPlaybookUrl: (id: string) => `https://hub.test/docs?workspace=playbook&taxonomy=${id}`,
}))
vi.mock('../lib/panel-data', () => ({
  useRepQueue: () => ({ items: [lead], loading: false, error: null, staleAt: null, reload: vi.fn() }),
  usePlaybookLibrary: () => ({
    scripts: [], courses: [], config: null, spins: [], loading: false, error: null, staleAt: null, reload: vi.fn(),
  }),
  spinsFor: () => new Map(),
}))
vi.mock('@app/lib/targets-data', () => ({
  firstOfMonth: () => '2026-08-01',
  useTarget: () => ({ item: null, loading: false, error: null, reload: vi.fn() }),
  useOwnWonValue: () => ({ value: 0, loading: false, error: null, reload: vi.fn() }),
}))
vi.mock('@app/lib/leads-data', () => ({
  useLeadStages: () => ({ stages: [], loading: false }),
  moveLeadStage: vi.fn(),
}))
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
vi.mock('@app/lib/crm-actions', () => ({ addNote: vi.fn(), saveLead: vi.fn(), createLead: vi.fn() }))

import { AppShell, getRootMounts } from './App'

const identity = {
  userId: 'user-1', clientId: 'client-1', displayName: 'Rep',
  clientName: 'Bright Academy', role: 'agent', timezone: 'Asia/Kolkata',
}

beforeEach(() => vi.clearAllMocks())

it('lands on Home, pushes the lead as a view, and keeps Lead out of the tab bar', async () => {
  const user = userEvent.setup()
  render(<AppShell identity={identity} />)

  // Home is the landing route: the one next action, not the whole queue.
  expect(await screen.findByText('Do this next')).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Lead' })).toBeNull()

  await user.click(screen.getByRole('button', { name: /Open Anjali Nair/ }))
  expect(await screen.findByRole('button', { name: 'Back to queue' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Back to queue' }))
  expect(await screen.findByText('Do this next')).toBeTruthy()

  for (const label of ['CRM', 'Library', 'Settings', 'Home']) {
    await user.click(screen.getByRole('link', { name: label }))
    if (label === 'Settings') expect(screen.getByText(/keeps the panel visible beside the chat/)).toBeTruthy()
    else if (label === 'Library') expect(screen.getByText('No scripts yet')).toBeTruthy()
    // The CRM is a book, not a queue: search and Add, never a "next lead" nudge.
    else if (label === 'CRM') {
      expect(screen.getByLabelText('Search leads')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Open next lead/ })).toBeNull()
    }
    else expect(screen.getByText('Do this next')).toBeTruthy()
  }

  expect(getRootMounts()).toBe(1)
})

it('does not read the WhatsApp page while following is off', async () => {
  const query = vi.spyOn(chrome.tabs, 'query')
  render(<AppShell identity={identity} />)
  await screen.findByText('Do this next')

  // The Following switch defaults ON, so the panel asks for the tab; what must
  // never happen is a read while the rep has turned it off.
  const user = userEvent.setup()
  await user.click(screen.getByRole('switch', { name: /Following|Not following/ }))
  query.mockClear()
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(query).not.toHaveBeenCalled()
})

it('restores the selected lead and pushed route from session storage', async () => {
  await chrome.storage.session.set({ 'rep.panelNavigation': { route: '/lead', selected: lead } })
  render(<AppShell identity={identity} />)

  expect(await screen.findByRole('button', { name: 'Back to queue' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Anjali Nair' })).toBeTruthy()
})
