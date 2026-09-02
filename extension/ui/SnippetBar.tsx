import { useEffect, useState } from 'react'
import { ChevronDown, Quote } from 'lucide-react'
import type { Snippet } from '../lib/contracts'
import { loadSnippets } from '../lib/prefs'
import { insertSnippet } from '../lib/wa-bridge'
import { renderSnippet } from '../lib/snippet'
import { SnippetPicker } from './SnippetPicker'

type Props = {
  /** Approved shared scripts, already loaded by the screen that owns them. */
  scripts: Snippet[]
  vars: Record<string, string>
  onResult: (message: string) => void
}

/**
 * Put `text` in the composer, or as close as we can get, and say which happened.
 *
 * The insert path stops at the composer, by construction: it fills the box and
 * returns. There is no send here and no timer that could become one — the rep
 * reads what landed and presses Enter. When WhatsApp Web isn't open, or the
 * composer isn't there to fill, the text goes to the clipboard instead so the
 * rep is never left with a dead button.
 *
 * Every insert in the panel — snippets, scripts, rebuttals, the token ask —
 * comes through here, so the three sentences a rep learns to recognise stay
 * exactly three sentences.
 */
export async function insertWithFallback(text: string): Promise<string> {
  if (await insertSnippet(text)) return 'Added to the WhatsApp box. Read it, then press Enter.'
  try {
    await navigator.clipboard.writeText(text)
    return 'Copied — paste it into the chat.'
  } catch {
    return 'Couldn’t reach WhatsApp Web. Open the chat, then try again.'
  }
}

export function SnippetBar({ scripts, vars, onResult }: Props) {
  const [personal, setPersonal] = useState<Snippet[]>([])

  useEffect(() => {
    let alive = true
    void loadSnippets().then((saved) => {
      if (!alive) return
      setPersonal(saved.map((item) => ({ ...item, scope: 'personal' as const })))
    })
    return () => { alive = false }
  }, [])

  async function insert(snippet: Snippet) {
    onResult(await insertWithFallback(renderSnippet(snippet.body, vars)))
  }

  return (
    <details className="group overflow-hidden rounded-lg border border-border bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 select-none hover:bg-surface-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <Quote aria-hidden size={14} strokeWidth={1.9} className="shrink-0 text-fg-subtle" />
        <span className="label-caps">Snippets</span>
        <span className="text-2xs text-fg-subtle tnum">{scripts.length + personal.length}</span>
        <ChevronDown
          aria-hidden
          size={15}
          className="ml-auto shrink-0 text-fg-subtle transition-transform duration-[var(--motion-fast)] group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-border">
        <SnippetPicker snippets={[...personal, ...scripts]} vars={vars} onInsert={(snippet) => void insert(snippet)} />
      </div>
    </details>
  )
}
