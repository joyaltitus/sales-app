import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { loadThemeChoice, saveThemeChoice, type ThemeChoice } from '../lib/theme'

const OPTIONS: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/** Light / dark / follow-the-OS. Repaints every open extension surface at once. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system')

  useEffect(() => {
    let alive = true
    void loadThemeChoice().then((stored) => { if (alive) setChoice(stored) })
    return () => { alive = false }
  }, [])

  return (
    <div role="group" aria-label="Theme" className="flex gap-1 rounded-md border border-border bg-surface-sunk p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = choice === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => { setChoice(value); void saveThemeChoice(value) }}
            className={[
              'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-sm border border-transparent text-sm transition-colors select-none',
              active ? 'bg-accent font-semibold text-accent-fg' : 'font-medium text-fg-muted hover:bg-surface hover:text-fg',
            ].join(' ')}
          >
            <Icon aria-hidden size={15} strokeWidth={1.9} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
