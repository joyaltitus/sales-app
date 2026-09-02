import {
  AlertTriangle, BadgeCheck, BanknoteIcon, BookOpen, CalendarDays, ClipboardCheck, Clock3, CreditCard,
  Flag, GraduationCap, HelpCircle, MapPin, MessageCircle, Phone, ShieldAlert, Sparkles, Target,
  ThumbsDown, TrendingUp, UserCheck, Users, Wallet, Zap, type LucideIcon,
} from 'lucide-react'
import type { Rebuttal } from '../lib/contracts'
import { winRateLabel } from '../lib/script-text'

/**
 * The icons a taxonomy row may name.
 *
 * A registry rather than `import * as lucide`: the namespace import pulls all
 * 1,500 icons into the panel bundle and defeats tree-shaking. Anything not
 * listed renders as text, which is also how an emoji icon renders — so a
 * manager can type 💳 and it just works.
 */
const ICONS: Record<string, LucideIcon> = {
  'alert-triangle': AlertTriangle, 'badge-check': BadgeCheck, banknote: BanknoteIcon, 'book-open': BookOpen,
  calendar: CalendarDays, 'calendar-days': CalendarDays, 'clipboard-check': ClipboardCheck, clock: Clock3,
  'credit-card': CreditCard, flag: Flag, 'graduation-cap': GraduationCap, 'help-circle': HelpCircle,
  'map-pin': MapPin, 'message-circle': MessageCircle, phone: Phone, 'shield-alert': ShieldAlert,
  sparkles: Sparkles, target: Target, 'thumbs-down': ThumbsDown, 'trending-up': TrendingUp,
  'user-check': UserCheck, users: Users, wallet: Wallet, zap: Zap,
}

export function PlaybookIcon({ name, size = 14 }: { name: string | null; size?: number }) {
  if (!name) return null
  const Icon = ICONS[name.trim().toLowerCase()]
  if (Icon) return <Icon aria-hidden size={size} strokeWidth={1.9} className="shrink-0" />
  return <span aria-hidden className="shrink-0 text-xs leading-none">{name}</span>
}

/** "68%" once ten calls rated it, "early" while it is still a hunch, else
 *  "untested". A percentage from three uses is a lie with a decimal point. */
export function WinRateChip({ script }: { script: Pick<Rebuttal, 'rated' | 'won'> }) {
  const label = winRateLabel(script.rated, script.won)
  const tone = label.endsWith('%')
    ? 'border-[color-mix(in_srgb,var(--success)_20%,transparent)] bg-success-subtle text-success'
    : 'border-border bg-surface-sunk text-fg-subtle'
  return (
    <span className={['shrink-0 rounded-pill border px-1.5 py-px text-2xs leading-none font-semibold tnum', tone].join(' ')}>
      {label}
    </span>
  )
}

type Props = {
  scripts: Rebuttal[]
  activeKey: string | null
  onPick: (script: Rebuttal) => void
}

/**
 * The objection row.
 *
 * Wraps to two rows; never scrolls sideways. A horizontal scroller hides half
 * the objections behind a gesture the rep has to discover mid-call, and the one
 * they need is always the hidden one.
 */
export function ObjectionChips({ scripts, activeKey, onPick }: Props) {
  if (scripts.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Objections">
      {scripts.map((script) => {
        const active = script.taxonomy_key === activeKey
        return (
          <button
            key={script.taxonomy_id}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(script)}
            className={[
              'flex min-h-9 max-w-full min-w-0 items-center gap-1.5 rounded-pill border px-2.5 text-xs font-medium transition-colors select-none',
              active
                ? 'border-accent bg-accent-subtle text-accent'
                : 'border-border bg-surface-raised text-fg-muted hover:border-border-strong hover:text-fg',
            ].join(' ')}
          >
            <PlaybookIcon name={script.icon} />
            <span className="min-w-0 truncate">{script.label}</span>
            <WinRateChip script={script} />
          </button>
        )
      })}
    </div>
  )
}
