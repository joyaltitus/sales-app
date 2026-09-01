import { defineContentScript } from '#imports'
import type { ChatMessage, ChatSnapshot } from '../lib/wa-chat'
import { parsePrePlainText } from '../lib/wa-chat'

/**
 * whatsapp.content — the ONLY code in this extension that touches WhatsApp Web.
 *
 * What it does: reads the chat the rep already has open, on demand, and puts
 * text into the composer when the rep clicks a snippet.
 *
 * What it must never do, and does not:
 *   · send. There is no click of a send button, no Enter key, no scheduling,
 *     no queue. `insertText` fills the composer and stops; the rep presses Enter.
 *   · enumerate. It reads inside `#main` — the open conversation — and nowhere
 *     else. The chat list, contacts, groups and media are never walked, and no
 *     chat is ever opened programmatically.
 *   · run unasked. Everything is gated on `watching`, which only the panel turns
 *     on, so a rep with the panel closed has a content script that has parsed
 *     exactly nothing.
 *
 * Selectors are listed in one block below because they are the part that breaks:
 * WhatsApp ships markup changes without notice, and when following goes quiet
 * this list is the thing to re-check first.
 */

// ── The WhatsApp DOM surface, in full ────────────────────────────────────────
const SEL = {
  /** The open conversation pane. Absent = no chat open. */
  main: '#main',
  /** Chat header — observed for the change that means "the rep switched chat". */
  header: '#main header',
  /** Header title. WhatsApp puts the contact name here, or the raw number when unsaved. */
  title: '#main header span[title]',
  /** Any message row. data-id is `<fromMe>_<chatJid>_<msgId>[_<author>]`. */
  row: '#main [data-id]',
  /** Direction, as WhatsApp's own row classes. */
  incoming: '.message-in',
  outgoing: '.message-out',
  /** `[8:42 pm, 02/09/2026] Anjali: ` — the only timestamp WhatsApp puts in the DOM as text. */
  prePlain: '[data-pre-plain-text]',
  /** The message body span. */
  text: 'span.selectable-text',
  /** Voice-note rows carry a play control; the duration sits in the row's own text. */
  voice: '[data-icon="audio-play"], [data-icon="audio-pause"], [data-icon="ptt-play"]',
  /** The composer. Focused before insertText so execCommand has a target. */
  composer: '#main footer div[contenteditable="true"]',
} as const

const DEBOUNCE_MS = 500
const MAX_MESSAGES = 50
const DURATION = /\b(\d{1,2}:\d{2})\b/

let watching = false
let observer: MutationObserver | null = null
let timer: number | undefined
let last = ''

/** The chat jid, from the first message row that carries one. */
function readJid(): string | null {
  const id = document.querySelector(SEL.row)?.getAttribute('data-id') ?? ''
  // `false_919876543210@c.us_3EB0…` — the jid is the segment holding the '@'.
  return id.split('_').find((part) => part.includes('@')) ?? null
}

function readSnapshot(): ChatSnapshot {
  if (!document.querySelector(SEL.main)) return { title: null, jid: null }
  return {
    title: document.querySelector(SEL.title)?.getAttribute('title') ?? null,
    jid: readJid(),
  }
}

/**
 * The visible text messages of the OPEN chat, oldest first, newest 50 kept.
 *
 * "Visible" is literal: this reads the rows WhatsApp has rendered, and never
 * scrolls, clicks or fetches to reveal more. Media is not downloaded — a voice
 * note becomes a placeholder carrying its duration, nothing else.
 */
function readMessages(): ChatMessage[] {
  const rows = [...document.querySelectorAll<HTMLElement>(SEL.row)]
  const messages: ChatMessage[] = []
  for (const row of rows) {
    const incoming = row.querySelector(SEL.incoming) ?? row.closest(SEL.incoming)
    const outgoing = row.querySelector(SEL.outgoing) ?? row.closest(SEL.outgoing)
    if (!incoming && !outgoing) continue // system notice, date divider, unread marker

    const { at, author } = parsePrePlainText(
      row.querySelector(SEL.prePlain)?.getAttribute('data-pre-plain-text'),
    )
    const isVoice = !!row.querySelector(SEL.voice)
    const text = isVoice ? '' : (row.querySelector(SEL.text)?.textContent ?? '').trim()
    // A row with no text and no voice control is media or a poll — skipped rather
    // than saved as a blank line the rep cannot vouch for.
    if (!isVoice && !text) continue

    messages.push({
      id: row.getAttribute('data-id') ?? `row-${messages.length}`,
      direction: incoming ? 'in' : 'out',
      text,
      voice: isVoice ? (DURATION.exec(row.textContent ?? '')?.[1] ?? '0:00') : null,
      at,
      author,
    })
  }
  return messages.slice(-MAX_MESSAGES)
}

/** Fill the composer. Returns false when WhatsApp has no composer focused//open. */
function insertIntoComposer(text: string): boolean {
  const composer = document.querySelector<HTMLElement>(SEL.composer)
  if (!composer) return false
  composer.focus()
  // execCommand is deprecated and still the only call that produces an edit
  // WhatsApp's editor observes; setting textContent leaves the send button
  // disabled because React never sees an input event.
  return document.execCommand('insertText', false, text)
}

function emitIfChanged(): void {
  if (!watching) return
  const snapshot = readSnapshot()
  const key = `${snapshot.title ?? ''}|${snapshot.jid ?? ''}`
  if (key === last) return
  last = key
  void chrome.runtime.sendMessage({ type: 'rep.wa.changed', snapshot }).catch(() => {
    // The panel closed between the mutation and this send. Not an error.
  })
}

function schedule(): void {
  if (!watching) return
  window.clearTimeout(timer)
  timer = window.setTimeout(emitIfChanged, DEBOUNCE_MS)
}

function startWatching(): void {
  if (observer) return
  // Observed on the document because WhatsApp replaces #main wholesale on every
  // chat switch, so an observer bound to the header dies with the first switch.
  // Every callback does nothing but restart a 500 ms timer, so the cost of the
  // wide scope is one clearTimeout per mutation batch; no DOM is read until it fires.
  observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  schedule()
}

function stopWatching(): void {
  observer?.disconnect()
  observer = null
  window.clearTimeout(timer)
  last = ''
}

export default defineContentScript({
  matches: ['https://web.whatsapp.com/*'],
  main() {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      const request = message as { type?: string; on?: boolean; text?: string }
      switch (request.type) {
        case 'rep.wa.watch':
          watching = !!request.on
          if (watching) startWatching()
          else stopWatching()
          sendResponse({ ok: true })
          return false
        case 'rep.wa.read':
          // Answered even when not watching: this is the panel asking once, on
          // open, for the chat already in front of the rep.
          sendResponse(readSnapshot())
          return false
        case 'rep.wa.messages':
          sendResponse({ messages: readMessages() })
          return false
        case 'rep.wa.insert':
          sendResponse({ ok: insertIntoComposer(request.text ?? '') })
          return false
        default:
          return false
      }
    })
  },
})
