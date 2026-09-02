import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CallHud } from './CallHud'
import { playbookLibrary, queueItems } from '../fixtures'
import { OUTBOX_KEY, readOutbox } from '../lib/outbox-store'
import { PREFS_KEY } from '../lib/prefs'
import type { OutboxEntry } from '../lib/contracts'

vi.mock('../lib/panel-client', () => ({
  panelSupabase: {},
  HUB_URL: 'https://hub.test',
  hubPlaybookUrl: (id: string) => `https://hub.test/docs?workspace=playbook&taxonomy=${id}`,
}))
// The composer double: "inserted" rather than "sent", which is the only thing
// the panel is ever allowed to do.
const insertSnippet = vi.fn(async (_text: string) => true)
vi.mock('../lib/wa-bridge', () => ({ insertSnippet: (text: string) => insertSnippet(text) }))

const identity = {
  userId: 'user-1', clientId: 'client-1', displayName: 'Ravi',
  clientName: 'Bright Academy', role: 'agent', timezone: 'Asia/Kolkata',
}

function hud(over: Partial<Parameters<typeof CallHud>[0]> = {}) {
  return (
    <CallHud
      identity={identity}
      lead={queueItems[0]!}
      library={playbookLibrary}
      calls={[]}
      callSessionId="call-1"
      ratingOpen={false}
      onResult={() => {}}
      onLockCallback={async () => true}
      {...over}
    />
  )
}

/** Walk the roadmap to the step whose script quotes course numbers. */
async function goToOffer(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Opener — follow-up')
  await user.click(screen.getByRole('button', { name: /Next/ }))
  await user.click(screen.getByRole('button', { name: /Next/ }))
  return screen.findByText('The offer')
}

beforeEach(() => {
  insertSnippet.mockClear()
  insertSnippet.mockResolvedValue(true)
})

describe('CallHud', () => {
  it('opens on the follow-up hook for a lead that is overdue', async () => {
    render(hud())
    expect(await screen.findByText('Opener — follow-up')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Follow-up' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1/4')).toBeInTheDocument()
  })

  // ★ B8: course unpicked → tokens visible, warn chip, Insert still allowed.
  it('leaves course tokens visible and Insert live when no course is picked', async () => {
    const user = userEvent.setup()
    render(hud())
    await goToOffer(user)

    expect(screen.getByText(/Pick a course to fill numbers/)).toBeInTheDocument()
    expect(screen.getByText(/\{\{course\.fee\}\}/)).toBeInTheDocument()
    const insert = screen.getByRole('button', { name: 'Insert' })
    expect(insert).toBeEnabled()

    await user.click(insert)
    expect(insertSnippet).toHaveBeenCalledTimes(1)
    expect(insertSnippet.mock.calls[0]![0]).toContain('{{course.fee}}')
  })

  it('fills the numbers — and drops the warning — once a course is picked', async () => {
    const user = userEvent.setup()
    render(hud())
    await goToOffer(user)

    await user.selectOptions(screen.getByLabelText('Course'), 'item-0003')
    await waitFor(() => expect(screen.queryByText(/Pick a course to fill numbers/)).not.toBeInTheDocument())
    expect(screen.getByText(/₹85,000/)).toBeInTheDocument()
    expect(screen.queryByText(/\{\{course\.fee\}\}/)).not.toBeInTheDocument()
  })

  // ★ B8: double-tap Insert → ONE script_used row.
  it('writes one usage row however many times Insert is tapped', async () => {
    const user = userEvent.setup()
    render(hud())
    await screen.findByText('Opener — follow-up')

    const insert = screen.getByRole('button', { name: 'Insert' })
    await user.click(insert)
    await user.click(insert)
    await user.click(insert)

    await waitFor(async () => {
      const used = (await readOutbox()).filter((entry) => entry.kind === 'script_used')
      expect(used).toHaveLength(1)
    })
    expect(insertSnippet).toHaveBeenCalledTimes(3)
  })

  it('carries the call session, dialect and whose-words onto the usage row', async () => {
    const user = userEvent.setup()
    render(hud())
    await screen.findByText('Opener — follow-up')
    await user.click(screen.getByRole('button', { name: 'Insert' }))

    await waitFor(async () => {
      const used = (await readOutbox()).find((entry) => entry.kind === 'script_used')
      expect(used?.args).toMatchObject({
        call_session_id: 'call-1', lang: 'en', used_personal: false, client_id: 'client-1',
      })
    })
  })

  // ★ B8: a dialect with no variant falls back and says so, never blank.
  it('falls back to the default body with a language badge', async () => {
    const user = userEvent.setup()
    render(hud())
    await screen.findByText('Opener — follow-up')

    await user.click(screen.getByRole('button', { name: 'MN' }))
    // The opener has no Manglish variant: English text, flagged EN.
    expect(await screen.findByTestId('lang-fallback')).toHaveTextContent('EN')
    expect(screen.getByText(/picking up where we left off/)).toBeInTheDocument()
  })

  it('uses the Manglish variant where one exists, with no badge', async () => {
    const user = userEvent.setup()
    render(hud())
    await goToOffer(user)
    await user.click(screen.getByRole('button', { name: 'MN' }))

    expect(await screen.findByText(/complete full-stack development bootcamp aanu/)).toBeInTheDocument()
    expect(screen.queryByTestId('lang-fallback')).not.toBeInTheDocument()
  })

  // ★ B8: lead switch resets the roadmap and the rate-these strip.
  it('resets progress and the used-scripts strip when the lead changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(hud({ ratingOpen: true }))
    await goToOffer(user)
    await user.click(screen.getByRole('button', { name: 'Insert' }))
    expect(await screen.findByRole('group', { name: 'Rate the scripts you used' })).toBeInTheDocument()
    expect(screen.getByText('3/4')).toBeInTheDocument()

    rerender(hud({ ratingOpen: true, lead: queueItems[1]! }))

    await waitFor(() => expect(screen.getByText('1/4')).toBeInTheDocument())
    expect(screen.queryByRole('group', { name: 'Rate the scripts you used' })).not.toBeInTheDocument()
  })

  it('an objection chip swaps the roadmap for its rebuttal, and back', async () => {
    const user = userEvent.setup()
    render(hud())
    await screen.findByText('Opener — follow-up')

    await user.click(screen.getByRole('button', { name: /Too expensive/ }))
    expect(await screen.findByText('Anchor on per-square-foot value, not total price')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /back to Opener — follow-up/ }))
    expect(await screen.findByText(/picking up where we left off/)).toBeInTheDocument()
  })

  it('a missed rebuttal asks what they said and files it as a gap', async () => {
    const user = userEvent.setup()
    render(hud())
    await screen.findByText('Opener — follow-up')
    await user.click(screen.getByRole('button', { name: /Too expensive/ }))
    await user.click(screen.getByRole('button', { name: 'Insert to WA' }))
    await user.click(screen.getByRole('button', { name: 'Missed' }))

    await user.type(await screen.findByLabelText('What did they say?'), 'my brother got it for half')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(async () => {
      const gap = (await readOutbox()).find((entry) => entry.kind === 'playbook_gap')
      expect(gap?.args).toMatchObject({
        taxonomy_id: 'tax-price', script_version_id: 'sv-price', exact_customer_words: 'my brother got it for half',
      })
    })
  })

  it('rating a script from the strip queues the feedback update on its usage id', async () => {
    const user = userEvent.setup()
    render(hud({ ratingOpen: true }))
    await screen.findByText('Opener — follow-up')
    await user.click(screen.getByRole('button', { name: 'Insert' }))

    const strip = await screen.findByRole('group', { name: 'Rate the scripts you used' })
    await user.click(within(strip).getByRole('button', { name: /worked$/ }))

    await waitFor(async () => {
      const entries = await readOutbox()
      const used = entries.find((entry) => entry.kind === 'script_used')
      const rated = entries.find((entry) => entry.kind === 'script_feedback')
      expect(rated?.args).toMatchObject({ usage_id: used?.id, feedback: 'worked' })
    })
    // Rated rows never come back to ask again.
    expect(screen.queryByRole('group', { name: 'Rate the scripts you used' })).not.toBeInTheDocument()
  })

  it('offers the seat link with the course token amount and logs a received token', async () => {
    const user = userEvent.setup()
    render(hud())
    await screen.findByText('Opener — follow-up')
    await user.selectOptions(screen.getByLabelText('Course'), 'item-0003')

    const seat = await screen.findByRole('button', { name: /₹5,000 seat link/ })
    await user.click(seat)
    await waitFor(() => expect(insertSnippet).toHaveBeenCalled())
    expect(insertSnippet.mock.calls.at(-1)![0]).toContain('bright@okhdfcbank')

    await user.click(screen.getByRole('button', { name: /Token received/ }))
    await waitFor(async () => {
      const token = (await readOutbox()).find((entry) => entry.kind === 'token_received')
      expect(token?.args).toMatchObject({ lead_id: queueItems[0]!.lead_id, amount: 5000 })
    })
    expect(screen.getByText('Token logged')).toBeInTheDocument()
  })

  it('disables the seat link, with the reason, when nobody set up UPI', async () => {
    render(hud({ library: { ...playbookLibrary, config: { languages: ['en'], default_lang: 'en' } } }))
    expect(await screen.findByRole('button', { name: /Seat link/ })).toBeDisabled()
    expect(screen.getByText(/Ask your manager to set UPI in Sales Hub/)).toBeInTheDocument()
  })

  it('will not confirm a callback until a time is given, then inserts the confirmation', async () => {
    const user = userEvent.setup()
    const onLockCallback = vi.fn(async () => true)
    render(hud({ onLockCallback }))
    await screen.findByText('Opener — follow-up')

    await user.click(screen.getByRole('button', { name: /Lock callback/ }))
    const date = await screen.findByLabelText('Callback date')
    await user.type(date, '2026-09-04')
    expect(screen.getByRole('button', { name: 'Lock' })).toBeDisabled()

    await user.type(screen.getByLabelText('Callback time'), '16:00')
    await user.click(screen.getByRole('button', { name: 'Lock' }))

    // The rep typed the CUSTOMER's clock, and the fixture's client is on
    // Asia/Kolkata — so 16:00 is 10:30Z wherever this suite happens to run.
    await waitFor(() => expect(onLockCallback).toHaveBeenCalledWith('2026-09-04T10:30:00.000Z'))
    expect(onLockCallback).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(insertSnippet.mock.calls.at(-1)![0]).toContain('I will call you Fri 4:00 pm'))
  })

  it('hides Mine when the rep has no spins, and offers it when they do', async () => {
    const { rerender } = render(hud({ library: { ...playbookLibrary, spins: [] } }))
    expect(await screen.findByRole('button', { name: 'Mine' })).toBeDisabled()
    rerender(hud())
    expect(await screen.findByRole('button', { name: 'Mine' })).toBeEnabled()
  })

  it('reads the rep spin when Mine is on, and marks the step as theirs', async () => {
    await chrome.storage.local.set({ [PREFS_KEY]: { useMine: true } })
    const user = userEvent.setup()
    render(hud())
    await goToOffer(user)

    expect(await screen.findByText('My words')).toBeInTheDocument()
    expect(screen.getByText(/I did this course myself/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Insert' }))
    await waitFor(async () => {
      const used = (await readOutbox()).find((entry) => entry.kind === 'script_used')
      expect(used?.args).toMatchObject({ used_personal: true })
    })
  })

  it('hides an archived objection but keeps the rep spin behind it', async () => {
    const archived = playbookLibrary.scripts.map((script) =>
      script.taxonomy_key === 'price' ? { ...script, status: 'archived' as const } : script)
    render(hud({ library: { ...playbookLibrary, scripts: archived } }))
    await screen.findByText('Opener — follow-up')
    expect(screen.queryByRole('button', { name: /Too expensive/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Wrong time/ })).toBeInTheDocument()
  })

  it('queues nothing but still fills the composer when WhatsApp is not reachable', async () => {
    insertSnippet.mockResolvedValue(false)
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(hud({ onResult }))
    await screen.findByText('Opener — follow-up')
    await user.click(screen.getByRole('button', { name: 'Insert' }))

    await waitFor(() => expect(onResult).toHaveBeenCalled())
    expect(onResult.mock.calls.at(-1)![0]).toMatch(/Copied — paste it into the chat\.|Couldn’t reach WhatsApp Web/)
  })

  // ★ B8 (structure half): nothing in the HUD may widen the 380px column. The
  // measured half runs in scripts/ext-playbook-shots.mjs, which asserts
  // scrollWidth <= clientWidth against a real layout.
  it('contains its own overflow so a long Manglish line cannot widen the panel', async () => {
    const user = userEvent.setup()
    render(hud())
    await goToOffer(user)
    await user.click(screen.getByRole('button', { name: 'MN' }))

    const root = screen.getByTestId('call-hud')
    expect(root.className).toContain('overflow-hidden')
    expect(root.className).toContain('min-w-0')
    const long = await screen.findByText(/complete full-stack development bootcamp aanu/)
    expect(long.className).toMatch(/break-words/)
    expect(long.className).toMatch(/line-clamp/)
  })
})

describe('offline', () => {
  // ★ B8: everything the rep does mid-call survives a dead connection, in order.
  it('queues usage, feedback and a spin in the order they happened', async () => {
    const user = userEvent.setup()
    render(hud({ ratingOpen: true }))
    await screen.findByText('Opener — follow-up')

    await user.click(screen.getByRole('button', { name: 'Insert' }))
    const strip = await screen.findByRole('group', { name: 'Rate the scripts you used' })
    await user.click(within(strip).getByRole('button', { name: /worked$/ }))

    await user.click(screen.getByRole('button', { name: /Open Opener — follow-up in full/ }))
    await user.type(await screen.findByLabelText('My spin in en'), 'Hi, me again.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      const kinds = (await readOutbox()).map((entry: OutboxEntry) => entry.kind)
      expect(kinds).toEqual(['script_used', 'script_feedback', 'save_spin'])
    })
    // Nothing was lost to a cleared store: the outbox IS the durable record.
    expect((await chrome.storage.local.get(OUTBOX_KEY))[OUTBOX_KEY]).toHaveLength(3)
  })
})

describe('CallHud layout', () => {
  it('AT-05: the panel keeps its single column — a rebuttal REPLACES the roadmap', async () => {
    const user = userEvent.setup()
    render(hud({ layout: 'column' }))
    await screen.findByText('Opener — follow-up')
    expect(screen.getByTestId('call-hud')).toHaveAttribute('data-layout', 'column')

    await user.click(screen.getByRole('button', { name: /Too expensive/ }))
    expect(await screen.findByText('Anchor on per-square-foot value, not total price')).toBeInTheDocument()
    // The roadmap is gone: 380px cannot hold both, and that is the panel's contract.
    expect(screen.queryByText(/picking up where we left off/)).not.toBeInTheDocument()
  })

  it('AT-06: the tab shows the roadmap and the rebuttal at once, objections in their own zone', async () => {
    const user = userEvent.setup()
    render(hud({ layout: 'wide' }))
    await screen.findByText('Opener — follow-up')
    expect(screen.getByTestId('call-hud')).toHaveAttribute('data-layout', 'wide')

    await user.click(screen.getByRole('button', { name: /Too expensive/ }))
    expect(await screen.findByText('Anchor on per-square-foot value, not total price')).toBeInTheDocument()
    // The whole point: handling an objection no longer loses your place in the call.
    expect(screen.getByText(/picking up where we left off/)).toBeInTheDocument()
    expect(within(screen.getByTestId('call-hud-objections')).getByRole('button', { name: /Too expensive/ })).toBeInTheDocument()
  })

  it('AT-07: digits fire the objections in the order they render', async () => {
    const user = userEvent.setup()
    render(hud({ layout: 'wide' }))
    await screen.findByText('Opener — follow-up')

    await user.keyboard('1')
    expect(await screen.findByText('Anchor on per-square-foot value, not total price')).toBeInTheDocument()

    // Same digit again is the way back out — one key, both directions.
    await user.keyboard('1')
    await waitFor(() => {
      expect(screen.queryByText('Anchor on per-square-foot value, not total price')).not.toBeInTheDocument()
    })
  })

  it('AT-08: a digit typed into a field is text, not a shortcut', async () => {
    const user = userEvent.setup()
    render(hud({ layout: 'wide' }))
    await screen.findByText('Opener — follow-up')

    await user.click(screen.getByRole('button', { name: /Too expensive/ }))
    await user.click(screen.getByRole('button', { name: 'Insert to WA' }))
    await user.click(screen.getByRole('button', { name: 'Missed' }))

    const said = await screen.findByLabelText('What did they say?')
    await user.type(said, '2 friends got it for 3000')

    // The digits are text. Had they been swallowed as shortcuts, the field would
    // be short and objection 2 and 3 would have fired underneath the rep.
    expect(said).toHaveValue('2 friends got it for 3000')
    expect(screen.getByText('Anchor on per-square-foot value, not total price')).toBeInTheDocument()
  })

  it('AT-07/AT-10: no keyboard shortcuts and no tab button in the panel by default', async () => {
    const user = userEvent.setup()
    render(hud({ layout: 'column' }))
    await screen.findByText('Opener — follow-up')

    await user.keyboard('1')
    expect(screen.queryByText('Anchor on per-square-foot value, not total price')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open in tab' })).not.toBeInTheDocument()
  })
})
