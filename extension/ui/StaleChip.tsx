import { Chip } from '../../src/ui/Chip'
import { STALE_AFTER_MS, staleAgeLabel } from './time'

type Props = {
  fetched_at: string
  /** Injectable clock for deterministic tests; defaults to Date.now(). */
  now?: number
}

export function StaleChip({ fetched_at, now }: Props) {
  const reference = now ?? Date.now()
  const age = reference - Date.parse(fetched_at)
  if (!Number.isFinite(age) || age < STALE_AFTER_MS) return null
  return (
    <Chip tone="warn" role="status">
      Cached {staleAgeLabel(age)} ago
    </Chip>
  )
}
