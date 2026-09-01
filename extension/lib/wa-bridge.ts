import { useEffect, useState } from 'react'
import type { ChatMessage, ChatSnapshot } from './wa-chat'

/**
 * wa-bridge — the panel's half of the WhatsApp conversation.
 *
 * Every call here is a question the panel asks the content script about the tab
 * the rep is already looking at. There is no write path to WhatsApp except
 * `insertSnippet`, which fills the composer and stops.
 *
 * All four helpers resolve to a null / false / empty answer when WhatsApp is not
 * open, when the tab has not loaded the content script yet, or when the rep is
 * on a page that never matched. A missing WhatsApp tab is the normal state of
 * this extension, not an error to surface.
 */

const WA_TAB = 'https://web.whatsapp.com/*'

async function activeChatTab(): Promise<number | null> {
  // Ordered so the tab the rep is actually looking at wins when several are open.
  const tabs = await chrome.tabs.query({ url: WA_TAB })
  const focused = tabs.find((tab) => tab.active) ?? tabs[0]
  return focused?.id ?? null
}

async function ask<T>(message: Record<string, unknown>): Promise<T | null> {
  const tabId = await activeChatTab()
  if (tabId === null) return null
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T
  } catch {
    // No receiver: WhatsApp is mid-reload, or this tab predates the install.
    return null
  }
}

/** Turn the content script's observer on or off. Off is the default at rest. */
export function watchChat(on: boolean): Promise<unknown> {
  return ask({ type: 'rep.wa.watch', on })
}

export function readOpenChat(): Promise<ChatSnapshot | null> {
  return ask<ChatSnapshot>({ type: 'rep.wa.read' })
}

export async function readChatMessages(): Promise<ChatMessage[]> {
  const result = await ask<{ messages: ChatMessage[] }>({ type: 'rep.wa.messages' })
  return result?.messages ?? []
}

/** Put text in the composer. False means the rep must paste it themselves. */
export async function insertSnippet(text: string): Promise<boolean> {
  const result = await ask<{ ok: boolean }>({ type: 'rep.wa.insert', text })
  return result?.ok ?? false
}

/**
 * The chat currently open in WhatsApp Web, or null.
 *
 * `enabled` is the rep's Following toggle: false disconnects the observer on the
 * page, so turning following off genuinely stops the DOM being read rather than
 * only hiding the chip.
 */
export function useOpenChatSnapshot(enabled: boolean): ChatSnapshot | null {
  const [snapshot, setSnapshot] = useState<ChatSnapshot | null>(null)

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null)
      void watchChat(false)
      return
    }
    let alive = true
    void watchChat(true)
    void readOpenChat().then((initial) => { if (alive) setSnapshot(initial) })

    const onMessage = (message: unknown) => {
      const request = message as { type?: string; snapshot?: ChatSnapshot }
      if (request.type === 'rep.wa.changed' && request.snapshot && alive) {
        setSnapshot(request.snapshot)
      }
    }
    chrome.runtime.onMessage.addListener(onMessage)

    // The side panel is a document: closing it unloads this listener, but the
    // content script would keep observing until told otherwise. Rule 4's "no DOM
    // reads while the panel is closed" is only true if this fires.
    const stop = () => { void watchChat(false) }
    window.addEventListener('pagehide', stop)

    return () => {
      alive = false
      chrome.runtime.onMessage.removeListener(onMessage)
      window.removeEventListener('pagehide', stop)
      void watchChat(false)
    }
  }, [enabled])

  return snapshot
}
