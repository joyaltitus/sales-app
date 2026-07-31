import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { SendHorizontal, Inbox as InboxIcon } from 'lucide-react'
import { useTheme } from '../../shell/theme'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Chip } from '../../ui/Chip'
import { Skeleton } from '../../ui/Skeleton'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { LoginCard, Wordmark } from '../../auth/LoginPage'
import { ApprovalCard } from '../../ui/agent/ApprovalCard'
import { FactCard } from '../../ui/agent/FactCard'
import { VoiceButton } from '../../ui/agent/VoiceButton'
import { DocumentCard } from '../../ui/agent/DocumentCard'
import { MOCK_PROPOSALS, MOCK_FACTS, MOCK_DOCS } from '../../lib/mock-wave3'
import { QueueRow } from '../inbox/QueueRow'
import { Thread } from '../inbox/Thread'
import { Panel, StatTile, HeroStat, Funnel } from '../dashboard/charts'
import {
  MOCK_QUEUE,
  MOCK_MESSAGES,
  MOCK_TRACES,
  MOCK_FUNNEL,
  MOCK_HERO,
  MOCK_TILES,
} from './preview-mocks'

// /preview — the UI-DESIGN-01 direction gallery. PUBLIC route, mock data ONLY
// (preview-mocks.ts), no live read anywhere in this chunk. Joyal opens this in
// the morning, flips directions/themes, and picks one — the apply is a single
// data-direction attribute in index.html (docs/ui-audit.md §Direction swap).

type Direction = '' | 'graphite' | 'evergreen' | 'ledger'

const DIRECTIONS: { key: Direction; label: string; note: string }[] = [
  { key: '', label: 'Frozen', note: 'SA-00 tokens as shipped today' },
  { key: 'graphite', label: 'Graphite', note: 'restrained-neutral · cool greys, sharpened radii' },
  { key: 'evergreen', label: 'Evergreen', note: 'warm-professional · paper neutrals, deep green' },
  { key: 'ledger', label: 'Ledger', note: 'bold-minimal · pure contrast, hairline depth' },
]

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {note && <p className="mb-3 text-xs text-fg-muted">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** A 390px device frame so phone surfaces are judged at phone width. */
function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-[390px] max-w-full shrink-0 overflow-hidden rounded-md border border-border-strong bg-canvas shadow-elev-2">
      {children}
    </div>
  )
}

function MockComposer() {
  return (
    <div className="flex items-center gap-2 border-t border-border bg-surface p-3">
      <Input placeholder="Type a reply" className="h-9" readOnly />
      <Button size="sm" aria-label="Send">
        <SendHorizontal aria-hidden size={16} />
      </Button>
    </div>
  )
}

export default function PreviewGallery() {
  const { theme, toggle } = useTheme()
  // ?d=graphite deep-links a direction (screenshot harness + shareable looks)
  const [direction, setDirection] = useState<Direction>(() => {
    const d = new URLSearchParams(window.location.search).get('d') ?? ''
    return (['graphite', 'evergreen', 'ledger'] as const).includes(d as never)
      ? (d as Direction)
      : ''
  })

  useEffect(() => {
    if (direction) document.documentElement.setAttribute('data-direction', direction)
    else document.documentElement.removeAttribute('data-direction')
    return () => document.documentElement.removeAttribute('data-direction')
  }, [direction])

  const active = DIRECTIONS.find((d) => d.key === direction)!

  return (
    <div className="min-h-full bg-canvas text-fg">
      {/* Control bar (non-sticky: full-page screenshots stay clean) */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Wordmark size={28} />
          <div className="mr-auto">
            <div className="text-sm font-semibold">Design preview</div>
            <div className="text-2xs text-fg-subtle">{active.note}</div>
          </div>
          <div className="flex rounded-md border border-border bg-surface-sunk p-0.5">
            {DIRECTIONS.map((d) => (
              <button
                key={d.key || 'frozen'}
                onClick={() => setDirection(d.key)}
                aria-pressed={direction === d.key}
                className={[
                  'rounded-sm px-3 py-1.5 text-xs transition-colors',
                  direction === d.key
                    ? 'bg-surface font-semibold text-fg shadow-elev-1'
                    : 'text-fg-muted hover:text-fg',
                ].join(' ')}
              >
                {d.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={toggle}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Section
          title="Sign in"
          note="First impression — seam motif, nameless mark (working-name law), raised card."
        >
          <div className="relative flex justify-center rounded-md border border-border bg-canvas px-4 py-10">
            <span aria-hidden className="absolute inset-x-0 top-[38%] h-px bg-border" />
            <LoginCard
              email="priya@example.com"
              password="········"
              error={null}
              busy={false}
              onEmail={() => {}}
              onPassword={() => {}}
              onSubmit={(e) => e.preventDefault()}
            />
          </div>
        </Section>

        <Section
          title="Dashboard"
          note="One number first (hero band); tiles and panels defer to it."
        >
          <div className="space-y-3">
            <HeroStat {...MOCK_HERO} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MOCK_TILES.map((t) => (
                <StatTile key={t.label} {...t} />
              ))}
            </div>
            <Panel title="Funnel" caption="Lead stages, last 30 days">
              <Funnel stages={MOCK_FUNNEL} />
            </Panel>
          </div>
        </Section>

        <Section
          title="Inbox queue"
          note="SA-06 hierarchy: customer leads, urgency in the spine and stamp tone. Judged at 390px."
        >
          <PhoneFrame>
            {MOCK_QUEUE.map(({ item, preview, assignee }) => (
              <QueueRow
                key={item.id}
                item={item}
                preview={preview}
                selected={false}
                onSelect={() => {}}
                assigneeLabel={assignee}
              />
            ))}
          </PhoneFrame>
        </Section>

        <Section
          title="Thread + the seam"
          note="The signature (§1.3): control passing from machine to human, drawn as a legend break."
        >
          <PhoneFrame>
            <div className="bg-canvas">
              <Thread messages={MOCK_MESSAGES} traces={MOCK_TRACES} />
              <MockComposer />
            </div>
          </PhoneFrame>
        </Section>

        <Section
          title="AI surface kit"
          note="UI-BUILD-02: approval ladder, Lead Brain facts, voice states — the vocabulary every agent surface reuses."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ApprovalCard proposal={MOCK_PROPOSALS[0]} />
            <ApprovalCard proposal={MOCK_PROPOSALS[1]} />
            <FactCard fact={MOCK_FACTS[1]} />
            <FactCard fact={MOCK_FACTS[3]} />
            <div className="space-y-2">
              <VoiceButton />
              <VoiceButton lowConfidenceDemo />
            </div>
            <div className="space-y-2">
              {MOCK_DOCS.slice(0, 2).map((d) => (
                <DocumentCard key={d.id} doc={d} />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Primitives" note="Buttons, chips, inputs, and the designed states.">
          <div className="space-y-5 rounded-md border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Send</Button>
              <Button variant="secondary">Snooze</Button>
              <Button variant="ghost">Move stage</Button>
              <Button variant="danger">Delete note</Button>
              <Button loading>Sending</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip>Neutral</Chip>
              <Chip tone="accent">Accent</Chip>
              <Chip tone="success">Won</Chip>
              <Chip tone="warn">Overdue</Chip>
              <Chip tone="danger">Failed</Chip>
            </div>
            <div className="grid gap-2 sm:max-w-sm">
              <Input placeholder="Default" />
              <Input placeholder="Invalid" invalid />
            </div>
            <div className="grid gap-2 sm:max-w-sm">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
            <div className="grid sm:grid-cols-2">
              <EmptyState
                icon={InboxIcon}
                title="Nothing waiting."
                body="New customer messages land here the moment they arrive."
              />
              <ErrorState
                title="Couldn't load the queue."
                body="Check connection and try again."
                onRetry={() => {}}
              />
            </div>
          </div>
        </Section>
      </main>
    </div>
  )
}
