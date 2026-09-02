import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { playbookLibrary } from '../../fixtures'
import { DEFAULT_PREFS, PREFS_KEY, loadPrefs } from '../../lib/prefs'

vi.mock('../../lib/panel-client', () => ({
  panelSupabase: {},
  HUB_URL: 'https://hub.test',
  hubPlaybookUrl: (id: string) => `https://hub.test/docs?workspace=playbook&taxonomy=${id}`,
}))
const library = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('../../lib/panel-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/panel-data')>()),
  usePlaybookLibrary: () => library.current,
}))
vi.mock('../../lib/wa-bridge', () => ({ insertSnippet: async () => true }))

import LibraryScreen from './LibraryScreen'
import SettingsScreen from './SettingsScreen'
import { CACHE_KEYS, cached } from '../../lib/cache'

const identity = {
  userId: 'user-1', clientId: 'client-1', displayName: 'Ravi',
  clientName: 'Bright Academy', role: 'agent', timezone: 'Asia/Kolkata',
}

beforeEach(() => {
  library.current = { ...playbookLibrary, loading: false, error: null, staleAt: null, reload: vi.fn() }
})

describe('LibraryScreen', () => {
  it('groups the playbook the three ways a rep looks for a script', async () => {
    render(<LibraryScreen identity={identity} />)
    expect(await screen.findByText('Call roadmap')).toBeInTheDocument()
    expect(screen.getByText('Objections')).toBeInTheDocument()
    expect(screen.getByText('Composed texts')).toBeInTheDocument()
    expect(screen.getByText('Seat token text')).toBeInTheDocument()
  })

  it('marks a script the rep has rewritten, and shows the counted win rate', async () => {
    render(<LibraryScreen identity={identity} />)
    const card = (await screen.findByText('The offer')).closest('button')!
    expect(within(card).getByText('Custom')).toBeInTheDocument()
    expect(within(card).getByText('61%')).toBeInTheDocument()
  })

  it('searches over labels and bodies', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen identity={identity} />)
    await screen.findByText('Call roadmap')

    await user.type(screen.getByLabelText('Search scripts'), 'loaded rate')
    await waitFor(() => expect(screen.queryByText('Call roadmap')).not.toBeInTheDocument())
    expect(screen.getByText('Too expensive')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Search scripts'))
    await user.type(screen.getByLabelText('Search scripts'), 'zzz')
    expect(await screen.findByText('No script matches')).toBeInTheDocument()
  })

  it('opening a card opens the full script sheet', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen identity={identity} />)
    await user.click(await screen.findByText('Too expensive'))
    expect(await screen.findByRole('dialog', { name: 'Too expensive' })).toBeInTheDocument()
    expect(screen.getByLabelText('Company standard')).toBeInTheDocument()
  })

  it('hides archived taxonomy from the shelves', async () => {
    library.current = {
      ...playbookLibrary,
      scripts: playbookLibrary.scripts.map((script) =>
        script.taxonomy_key === 'price' ? { ...script, status: 'archived' as const } : script),
      loading: false, error: null, staleAt: null, reload: vi.fn(),
    }
    render(<LibraryScreen identity={identity} />)
    await screen.findByText('Objections')
    expect(screen.queryByText('Too expensive')).not.toBeInTheDocument()
  })

  it('shows the stale chip rather than an error when it is serving cache', async () => {
    library.current = {
      ...playbookLibrary, loading: false, error: null,
      staleAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), reload: vi.fn(),
    }
    render(<LibraryScreen identity={identity} />)
    expect(await screen.findByRole('status')).toHaveTextContent(/Cached/)
  })

  it('the dialect choice is the same preference the HUD reads', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen identity={identity} />)
    await user.click(await screen.findByRole('button', { name: 'MN' }))
    await waitFor(async () => expect((await loadPrefs()).defaultLang).toBe('mn'))
  })
})

describe('SettingsScreen', () => {
  it('keeps every pre-existing preference at its old default', async () => {
    expect(DEFAULT_PREFS).toMatchObject({
      followChat: true, quietFrom: '21:00', quietTo: '09:00', activeClientId: null,
    })
  })

  it('persists the rep-local script choices and links out for the rest', async () => {
    await chrome.storage.local.set({
      [CACHE_KEYS.library]: cached(playbookLibrary, new Date(), 'client-1'),
    })
    const user = userEvent.setup()
    render(<SettingsScreen clientId="client-1" />)

    await user.click(await screen.findByRole('button', { name: 'My version' }))
    await user.click(screen.getByLabelText(/Show the call roadmap/))
    await waitFor(async () => {
      const prefs = await loadPrefs()
      expect(prefs.useMine).toBe(true)
      expect(prefs.showRoadmap).toBe(false)
    })

    expect(screen.getByRole('link', { name: /Manage my script voice and company settings/ }))
      .toHaveAttribute('href', 'https://hub.test/more')
    // Chat mode is untouched by any of this.
    expect(screen.getByRole('button', { name: 'WhatsApp Web' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers the dialects the cached library actually has', async () => {
    await chrome.storage.local.set({
      [CACHE_KEYS.library]: cached(playbookLibrary, new Date(), 'client-1'),
      [PREFS_KEY]: { defaultLang: 'mn' },
    })
    render(<SettingsScreen clientId="client-1" />)
    const group = await screen.findByRole('group', { name: 'Default dialect' })
    expect(within(group).getByRole('button', { name: 'MN' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false')
  })
})
