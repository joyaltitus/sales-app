import { useState, type CSSProperties } from 'react'
import '@fontsource-variable/geist'
import { Button } from './Button'
import { Chip } from './Chip'
import { ListRow } from './ListRow'
import { useTheme } from '../shell/theme'

// SA-00 design-decision board (mid-session pause). Joyal picks accent hue +
// workhorse font from faithful renders; the choice is then FROZEN into
// tokens.css. A hue is a token, never a brand name (§C).

type Hue = {
  key: string
  label: string
  vars: Record<string, string>
}

// Candidate accent families (light-mode values). All deep + WhatsApp-adjacent
// per §C; spread across brightness/hue so the choice is real.
const HUES: Hue[] = [
  {
    key: 'teal-green',
    label: 'Teal-green',
    vars: {
      '--accent': '#0d7a63',
      '--accent-hover': '#0a6853',
      '--accent-active': '#085643',
      '--accent-fg': '#ffffff',
      '--accent-subtle': '#e6f3ef',
    },
  },
  {
    key: 'emerald',
    label: 'Emerald',
    vars: {
      '--accent': '#059669',
      '--accent-hover': '#048257',
      '--accent-active': '#036e49',
      '--accent-fg': '#ffffff',
      '--accent-subtle': '#e3f4ee',
    },
  },
  {
    key: 'pine',
    label: 'Pine (deep)',
    vars: {
      '--accent': '#14624f',
      '--accent-hover': '#105444',
      '--accent-active': '#0d4638',
      '--accent-fg': '#ffffff',
      '--accent-subtle': '#e5efeb',
    },
  },
]

const FONTS = {
  inter: "'Inter Variable', system-ui, sans-serif",
  geist: "'Geist Variable', system-ui, sans-serif",
}

function MiniBoard({ hue, font }: { hue: Hue; font: string }) {
  const style = { ...hue.vars, fontFamily: font } as CSSProperties
  return (
    <div
      style={style}
      className="w-full overflow-hidden rounded-md border border-border bg-canvas"
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="text-sm font-semibold text-fg">Acme Tutorials</span>
        <Chip tone="success">AI on</Chip>
        <span className="label-caps ml-auto">{hue.label}</span>
      </div>

      <div className="border-b border-border">
        <ListRow name="Priya Nair" preview="Is the fee negotiable?" channel="WA" timestamp="2m" assignee="You" />
        <ListRow name="Rahul Das" preview="Sent the brochure" channel="IG" timestamp="1h" unread />
        <ListRow name="Meera Iyer" preview="Call tomorrow 4pm" channel="WA" timestamp="3h" selected assignee="Anil" />
      </div>

      <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-3">
        <div>
          <div className="label-caps">Fees collected</div>
          <div className="text-lg font-semibold text-fg tnum">₹1,84,500</div>
        </div>
        <Chip tone="accent" className="ml-auto">▲ 12%</Chip>
        <Chip tone="warn">3 overdue</Chip>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-3">
        <Button size="sm">Reply</Button>
        <Button size="sm" variant="secondary">Snooze</Button>
        <Button size="sm" variant="ghost">Done</Button>
        <span className="ml-auto text-xs text-accent">Live · focus ring</span>
      </div>
    </div>
  )
}

export function SampleBoard() {
  const [font, setFont] = useState<keyof typeof FONTS>('inter')
  const { theme, toggle } = useTheme()

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">Design samples — pick hue + font</h1>
        <Button variant="secondary" size="sm" onClick={toggle}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </Button>
      </div>
      <div className="mb-6 flex items-center gap-2">
        <span className="label-caps">Font</span>
        <div className="inline-flex overflow-hidden rounded-md border border-border-strong">
          {(['inter', 'geist'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFont(f)}
              className={[
                'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                font === f ? 'bg-accent text-accent-fg' : 'bg-surface text-fg-muted hover:bg-surface-sunk',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-xs text-fg-subtle" style={{ fontFamily: FONTS[font] }}>
          Sample: The quick brown fox · ₹1,84,500 · +91 98765 43210 · 14:32
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {HUES.map((h) => (
          <MiniBoard key={h.key} hue={h} font={FONTS[font]} />
        ))}
      </div>
    </div>
  )
}
