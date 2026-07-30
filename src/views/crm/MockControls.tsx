import { useState } from 'react'
import { MOCK_REPS, OBJECTION_TYPES } from '../../lib/mock-data'

// SA-04 SAMPLE controls — the Wave-1 backlog UI (conversation assignment,
// objection capture) rendered so the wiring session is mechanical. They hold
// local state for the session and WRITE NOWHERE. The dashed border is the
// visual contract for "not wired yet"; when a control gains a real write path
// it loses the dash. Never reuse this style for a live control.

const sampleSelect =
  'rounded-sm border border-dashed border-border-strong bg-transparent py-0.5 pr-1 text-2xs text-fg-subtle uppercase hover:text-fg-muted'

const capsStyle = {
  fontWeight: 'var(--weight-caps)',
  letterSpacing: 'var(--tracking-caps)',
} as const

export function AssignSelect({ leadName }: { leadName: string }) {
  const [repId, setRepId] = useState('')
  return (
    <select
      value={repId}
      onChange={(e) => setRepId(e.target.value)}
      aria-label={`Assign ${leadName} (sample, not saved)`}
      title="Sample control — assignment isn't saved yet"
      className={sampleSelect}
      style={capsStyle}
    >
      <option value="">Unassigned</option>
      {MOCK_REPS.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  )
}

const OBJECTION_LABEL: Record<(typeof OBJECTION_TYPES)[number], string> = {
  price: 'Price',
  timing: 'Timing',
  trust: 'Trust',
  competitor: 'Competitor',
  no_need: 'No need',
  other: 'Other',
}

export function ObjectionSelect({
  leadName,
  current,
}: {
  leadName: string
  /** Free-text `leads.objection` already exists; preselect Other when set. */
  current: string | null
}) {
  const [value, setValue] = useState(current ? 'other' : '')
  return (
    <select
      value={value}
      onChange={(e) => setValue(e.target.value)}
      aria-label={`Objection for ${leadName} (sample, not saved)`}
      title="Sample control — objection type isn't saved yet"
      className={sampleSelect}
      style={capsStyle}
    >
      <option value="">No objection</option>
      {OBJECTION_TYPES.map((t) => (
        <option key={t} value={t}>
          {OBJECTION_LABEL[t]}
        </option>
      ))}
    </select>
  )
}
