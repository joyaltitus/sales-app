import { Eye, EyeOff } from 'lucide-react'

type Props = {
  enabled: boolean
  chatName: string | null
  onToggle: (on: boolean) => void
}

/**
 * The panel header's one control: is this panel watching the open chat?
 *
 * Deliberately a switch and not a status line. A rep beside a customer's chat
 * should be able to see, and stop, the reading in one tap — and the label says
 * which chat, so "following" is never an abstract claim.
 */
export function FollowingChip({ enabled, chatName, onToggle }: Props) {
  const Icon = enabled ? Eye : EyeOff
  const label = !enabled
    ? 'Not following chats'
    : chatName
      ? `Following ${chatName}`
      : 'Following — open a chat'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onToggle(!enabled)}
      className={[
        'flex min-h-8 w-full items-center gap-1.5 border-b border-border px-3 py-1.5 text-2xs transition-colors select-none',
        enabled ? 'bg-accent-subtle text-accent' : 'bg-surface text-fg-subtle hover:text-fg-muted',
      ].join(' ')}
    >
      <Icon aria-hidden size={12} strokeWidth={2} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left font-medium">{label}</span>
      <span className="shrink-0 opacity-70">{enabled ? 'On' : 'Off'}</span>
    </button>
  )
}
