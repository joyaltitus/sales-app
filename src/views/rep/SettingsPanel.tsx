import { useMemo, useState } from 'react'
import { AlertTriangle, Bell, Check, ChevronRight, Mail, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { ScriptVoiceSection } from './ScriptVoiceSection'
import type { GmailConnectionPreview } from '../email/emailMocks'

export type AutonomyConfigPreview = {
  clientId: string
  mode: 'suggest_only' | 'approve_each' | 'safe_auto'
  safeActions: ('add_note' | 'schedule_follow_up' | 'draft_reply')[]
  updatedBy: string
  sample: true
}

const AUTONOMY: AutonomyConfigPreview = { clientId: 'preview-client', mode: 'approve_each', safeActions: ['add_note', 'schedule_follow_up', 'draft_reply'], updatedBy: 'Meera Nair', sample: true }

function Toggle({ label, detail, initial = true }: { label: string; detail: string; initial?: boolean }) {
  const [on, setOn] = useState(initial)
  return <button onClick={() => setOn((value) => !value)} aria-pressed={on} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunk"><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-fg">{label}</span><span className="mt-0.5 block text-2xs text-fg-muted">{detail}</span></span><span className={['relative h-6 w-10 rounded-pill transition-colors', on ? 'bg-accent' : 'bg-border-strong'].join(' ')}><span className={['absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform', on ? 'translate-x-5' : 'translate-x-1'].join(' ')} /></span></button>
}

export default function SettingsPanel() {
  const [query, setQuery] = useState('')
  const [gmail, setGmail] = useState<GmailConnectionPreview>({ account: null, status: 'disconnected', scopes: [], lastSyncAt: null, sample: true })
  const [mode, setMode] = useState(AUTONOMY.mode)
  const show = useMemo(() => (label: string) => !query.trim() || label.toLowerCase().includes(query.trim().toLowerCase()), [query])

  const connect = () => {
    setGmail({ account: null, status: 'connecting', scopes: [], lastSyncAt: null, sample: true })
    window.setTimeout(() => setGmail({ account: 'priya@acme.in', status: 'connected', scopes: ['read', 'send'], lastSyncAt: 'Just now', sample: true }), 650)
  }

  const any =
    show('gmail email channel') ||
    show('copilot autonomy approval') ||
    show('notifications assignment overdue deals') ||
    show('my script voice spin dialect wording')
  return <section className="mt-5 space-y-4" aria-labelledby="settings-title"><div><p className="label-caps text-accent">Settings</p><h2 id="settings-title" className="mt-1 text-lg font-semibold text-fg">Connections and control</h2><div className="relative mt-3"><Search aria-hidden size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a setting" aria-label="Find a setting" className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle" /></div></div>

    <ScriptVoiceSection show={show} />

    {!any && <div className="rounded-xl border border-dashed border-border-strong p-6 text-center"><p className="text-sm font-semibold text-fg">No setting matches.</p><p className="mt-1 text-xs text-fg-muted">Try Gmail, copilot, notifications or script voice.</p></div>}

    {show('gmail email channel') && <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1"><header className="flex items-center gap-3 border-b border-border p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-subtle text-info"><Mail aria-hidden size={18} /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-fg">Gmail</h3><p className="mt-0.5 text-2xs text-fg-muted">Bring email into the unified Inbox.</p></div><Chip tone={gmail.status === 'connected' ? 'success' : gmail.status === 'error' ? 'danger' : gmail.status === 'connecting' ? 'warn' : 'neutral'}>{gmail.status}</Chip></header><div className="p-4">{gmail.status === 'disconnected' && <><p className="text-xs leading-relaxed text-fg-muted">Connect a workspace Gmail account to read threads and send reviewed drafts.</p><div className="mt-3 flex gap-2"><Button onClick={connect}>Connect Gmail</Button><Button variant="ghost" onClick={() => setGmail({ account: null, status: 'error', scopes: [], lastSyncAt: null, error: 'Google authorization was cancelled.', sample: true })}>Preview error</Button></div></>}{gmail.status === 'connecting' && <div className="flex items-center gap-3 text-xs text-fg-muted"><span className="h-4 w-4 animate-spin rounded-pill border-2 border-accent border-t-transparent" />Waiting for Google authorization…</div>}{gmail.status === 'connected' && <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-success-subtle text-success"><Check aria-hidden size={15} /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-fg">{gmail.account}</p><p className="mt-0.5 text-2xs text-fg-muted">Read + send · synced {gmail.lastSyncAt}</p></div><button onClick={() => setGmail({ account: null, status: 'disconnected', scopes: [], lastSyncAt: null, sample: true })} className="text-2xs font-semibold text-fg-muted hover:text-danger">Disconnect</button></div>}{gmail.status === 'error' && <div><div className="flex gap-2 rounded-lg bg-danger-subtle p-3 text-xs text-danger"><AlertTriangle aria-hidden size={15} className="shrink-0" />{gmail.error}</div><Button variant="secondary" size="sm" className="mt-3" onClick={connect}>Try again</Button></div>}<p className="mt-3 text-2xs text-fg-subtle">OAuth affordance only — not wired</p></div></article>}

    {show('copilot autonomy approval') && <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1"><header className="flex items-center gap-3 border-b border-border p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent"><ShieldCheck aria-hidden size={18} /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-fg">Copilot autonomy</h3><p className="mt-0.5 text-2xs text-fg-muted">Visible trust policy for this client.</p></div></header><div className="p-3"><div className="grid gap-2">{([['suggest_only', 'Suggest only', 'Copilot explains; a person performs every action.'], ['approve_each', 'Approve each', 'Copilot prepares work and waits for one-tap approval.'], ['safe_auto', 'Auto for safe actions', 'Only allowlisted reversible actions execute automatically.']] as const).map(([key, label, detail]) => <button key={key} onClick={() => setMode(key)} aria-pressed={mode === key} className={['flex items-center gap-3 rounded-lg border p-3 text-left', mode === key ? 'border-accent bg-accent-subtle' : 'border-border hover:border-border-strong'].join(' ')}><span className={['h-3 w-3 rounded-pill border-2', mode === key ? 'border-accent bg-accent' : 'border-border-strong'].join(' ')} /><span className="min-w-0 flex-1"><strong className="block text-xs text-fg">{label}</strong><span className="mt-0.5 block text-2xs leading-relaxed text-fg-muted">{detail}</span></span></button>)}</div><p className="mt-3 flex items-center gap-1.5 text-2xs text-fg-subtle"><SlidersHorizontal aria-hidden size={12} />Preview — per-client manager setting, not saved</p></div></article>}

    {show('notifications assignment overdue deals') && <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1"><header className="flex items-center gap-3 border-b border-border p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-warn-subtle text-warn"><Bell aria-hidden size={18} /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-fg">Notifications</h3><p className="mt-0.5 text-2xs text-fg-muted">Only work that changes the next action.</p></div><ChevronRight aria-hidden size={15} className="text-fg-subtle" /></header><div className="divide-y divide-border"><Toggle label="Manager assignments" detail="New todos and due changes" /><Toggle label="Overdue promises" detail="Callbacks and follow-ups that slipped" /><Toggle label="Team wins" detail="Deal-won feed with value and account" /></div></article>}
  </section>
}

