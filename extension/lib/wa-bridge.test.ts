import { describe, expect, it, vi } from 'vitest'
import { insertSnippet } from './wa-bridge'

/**
 * AT-09 — the one behaviour the full-tab HUD could have broken.
 *
 * From the side panel the WhatsApp tab is the ACTIVE tab, so "insert into the
 * composer" is unambiguous. From the call tab it is not: the rep is looking at
 * the HUD, and WhatsApp is a background tab. If insert only ever targeted the
 * active tab, every Insert in the new lane would silently do nothing.
 */
describe('insert reaches WhatsApp from a tab that is not WhatsApp', () => {
  it('sends to the WhatsApp tab while the rep is looking at the call HUD', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('chrome', {
      tabs: {
        // The rep is on the call tab; WhatsApp is open but inactive.
        query: vi.fn(async () => [{ id: 31, active: false }]),
        sendMessage,
      },
    })

    await expect(insertSnippet('Shall I block a seat?')).resolves.toBe(true)
    expect(sendMessage).toHaveBeenCalledWith(31, { type: 'rep.wa.insert', text: 'Shall I block a seat?' })
  })

  it('still prefers the focused WhatsApp tab when the rep has two open', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn(async () => [{ id: 31, active: false }, { id: 32, active: true }]),
        sendMessage,
      },
    })

    await insertSnippet('hello')
    expect(sendMessage).toHaveBeenCalledWith(32, expect.anything())
  })

  it('reports false rather than throwing when WhatsApp is not open at all', async () => {
    vi.stubGlobal('chrome', { tabs: { query: vi.fn(async () => []), sendMessage: vi.fn() } })
    await expect(insertSnippet('hello')).resolves.toBe(false)
  })
})
