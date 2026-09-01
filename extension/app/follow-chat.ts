import { useEffect, useMemo, useState } from 'react'
import type { QueueItem } from '../lib/contracts'
import { useOpenChatSnapshot } from '../lib/wa-bridge'
import { matchChat, parseChat, type ChatMatch, type OpenChat } from '../lib/wa-chat'
import { loadPrefs, savePrefs } from '../lib/prefs'

export type FollowState = {
  /** True while the panel is allowed to look at the WhatsApp tab at all. */
  enabled: boolean
  setEnabled: (on: boolean) => void
  /** The open one-to-one chat, or null (no WhatsApp tab, no chat, or a group). */
  chat: OpenChat | null
  match: ChatMatch<QueueItem>
}

/**
 * The Following-chat feature, as one hook.
 *
 * `enabled` is persisted so a rep who turns following off keeps it off, and it
 * is threaded all the way down to the content script's observer rather than
 * only hiding the chip — off means the page is genuinely not being read.
 */
export function useFollowedChat(leads: QueueItem[]): FollowState {
  const [enabled, setEnabledState] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    void loadPrefs().then((prefs) => {
      if (!alive) return
      setEnabledState(prefs.followChat)
      setReady(true)
    })
    return () => { alive = false }
  }, [])

  const snapshot = useOpenChatSnapshot(ready && enabled)
  const chat = useMemo(() => (snapshot ? parseChat(snapshot) : null), [snapshot])
  const match = useMemo<ChatMatch<QueueItem>>(
    () => (chat ? matchChat(chat, leads) : { lead: null, how: 'none' }),
    [chat, leads],
  )

  return {
    enabled,
    setEnabled: (on: boolean) => {
      setEnabledState(on)
      void savePrefs({ followChat: on })
    },
    chat,
    match,
  }
}
