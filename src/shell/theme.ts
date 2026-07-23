import { useEffect, useState } from 'react'

// Theme is data-theme on <html> so the in-app toggle wins over the OS.
// Initial value: stored choice, else OS preference. Dark mode is day-1 (§C).
export type Theme = 'light' | 'dark'
const KEY = 'sales-app.theme'

function initial(): Theme {
  const stored = localStorage.getItem(KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}
