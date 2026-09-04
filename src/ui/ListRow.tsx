import type { ReactNode } from 'react'
import { Chip } from './Chip'

type Props = {
  name: string
  snippet?: string
  channel?: 'WA' | 'IG'
  assignee?: string
  unread?: boolean
  selected?: boolean
  timestamp?: string
  onClick?: () => void
  trailing?: ReactNode
}

export function ListRow({
  name,
  snippet,
  channel,
  assignee,
  unread,
  selected,
  timestamp,
  onClick,
  trailing,
}: Props) {
  return (
    <button
      onClick={onClick}
      className={[
        'relative flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-[background-color,color] duration-[var(--motion-fast)] last:border-b-0',
        selected ? 'signal-edge bg-accent-subtle' : 'bg-surface hover:bg-surface-sunk active:bg-surface-sunk',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={['truncate text-sm text-fg', unread ? 'font-bold' : 'font-medium'].join(' ')}>
            {name}
          </span>
          {channel && (
            <span className="label-caps shrink-0" aria-label={channel === 'WA' ? 'WhatsApp' : 'Instagram'}>
              {channel}
            </span>
          )}
          {timestamp && <span className="ml-auto shrink-0 text-2xs text-fg-subtle tnum">{timestamp}</span>}
        </div>
        {snippet && (
          <div className="mt-0.5 flex items-center gap-2">
            <span className={['truncate text-xs', unread ? 'text-fg-muted' : 'text-fg-subtle'].join(' ')}>
              {snippet}
            </span>
            {assignee && (
              <Chip tone="neutral" className="ml-auto shrink-0">
                {assignee}
              </Chip>
            )}
          </div>
        )}
      </div>
      {trailing}
    </button>
  )
}
