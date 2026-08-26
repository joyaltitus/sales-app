import { useMemo, useState } from 'react'
import type { Snippet } from '../lib/contracts'
import { Chip } from '../../src/ui/Chip'
import { EmptyState } from '../../src/ui/EmptyState'
import { Input } from '../../src/ui/Input'

type Props = {
  snippets: Snippet[]
  /** Sample values for {{var}} substitution in the preview, e.g. { name: 'Anjali' }. */
  vars?: Record<string, string>
  onInsert: (snippet: Snippet) => void
}

export function applyVars(body: string, vars: Record<string, string> = {}): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => vars[key] ?? match)
}

export function SnippetPicker({ snippets, vars, onInsert }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return snippets
    return snippets.filter(
      (snippet) =>
        snippet.title.toLowerCase().includes(q) || snippet.body.toLowerCase().includes(q),
    )
  }, [snippets, query])

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-border bg-surface px-3 py-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search snippets…"
          aria-label="Search snippets"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No snippet matches" body="Try a shorter search." />
      ) : (
        <ul aria-label="Snippets">
          {filtered.map((snippet) => (
            <li key={snippet.id}>
              <button
                type="button"
                onClick={() => onInsert(snippet)}
                className="flex min-h-11 w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-surface-sunk active:bg-surface-sunk"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="truncate text-sm font-medium text-fg">{snippet.title}</span>
                  <Chip tone={snippet.scope === 'personal' ? 'neutral' : 'accent'} className="ml-auto shrink-0 capitalize">
                    {snippet.scope}
                  </Chip>
                </span>
                <span className="line-clamp-2 text-xs text-fg-subtle">{applyVars(snippet.body, vars)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
