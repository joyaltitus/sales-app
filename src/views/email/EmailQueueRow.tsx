import { Mail } from 'lucide-react'
import { Avatar } from '../../ui/Avatar'
import { EMAIL_THREAD } from './emailMocks'

export function EmailQueueRow({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return <button onClick={onSelect} aria-current={selected ? 'true' : undefined} className={['flex min-h-[84px] w-full border-b border-border text-left', selected ? 'bg-accent-subtle' : 'bg-surface hover:bg-surface-sunk'].join(' ')}><span className="w-[var(--spine-w)] shrink-0 bg-accent" /><div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3"><Avatar name={EMAIL_THREAD.contactName} size="md" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-bold text-fg">{EMAIL_THREAD.contactName}</span><span className="flex items-center gap-1 text-2xs font-semibold text-info"><Mail aria-hidden size={11} /> Email</span><span className="tnum text-xs text-fg-subtle">{EMAIL_THREAD.lastActivityAt}</span></div><p className="mt-0.5 truncate text-xs font-semibold text-fg-muted">{EMAIL_THREAD.subject}</p><p className="mt-0.5 truncate text-2xs text-fg-subtle">Annual option and 19 August onboarding</p></div><span className="h-2 w-2 shrink-0 rounded-pill bg-accent" aria-label="Unread" /></div></button>
}

