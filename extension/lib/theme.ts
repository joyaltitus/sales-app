/**
 * theme — the panel's light/dark choice.
 *
 * tokens.css keys dark off `[data-theme='dark']` on <html>, and that attribute
 * is set by src/shell/theme.ts — which only the WEB app mounts. So every
 * extension surface rendered permanently light, however the rep's OS was set:
 * a 400px white column pinned beside a dark browser, all day.
 *
 * Three states, not two. 'system' is the default and keeps following the OS
 * (including Windows crossing its own light/dark schedule mid-shift); 'light'
 * and 'dark' are the rep overriding it, which is what a rep working under
 * fluorescent light at 3pm and a dim office at 9pm actually needs. The stored
 * value is read by BOTH the panel and the options page, so the choice does not
 * split into two settings that disagree.
 */
export const THEME_KEY = 'rep.theme'

export type ThemeChoice = 'system' | 'light' | 'dark'

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function paint(choice: ThemeChoice): void {
  const dark = choice === 'system' ? prefersDark() : choice === 'dark'
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

export async function loadThemeChoice(): Promise<ThemeChoice> {
  const stored = (await chrome.storage.local.get(THEME_KEY))[THEME_KEY]
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export async function saveThemeChoice(choice: ThemeChoice): Promise<void> {
  paint(choice)
  await chrome.storage.local.set({ [THEME_KEY]: choice })
}

/**
 * Apply the stored choice and keep it applied. Returns a detach function.
 *
 * Listens on two channels because the choice can change from either side: the
 * OS (only meaningful under 'system'), and storage — which is how a toggle in
 * the options TAB repaints the side PANEL without either reloading.
 */
export function followTheme(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  let choice: ThemeChoice = 'system'

  // Paint from the OS immediately rather than waiting on storage: the read is
  // async, and a frame of the wrong theme is a visible white flash in dark mode.
  paint('system')
  void loadThemeChoice().then((stored) => { choice = stored; paint(choice) })

  const onMedia = () => { if (choice === 'system') paint('system') }
  const onStored = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes[THEME_KEY]) return
    const next = changes[THEME_KEY].newValue
    choice = next === 'light' || next === 'dark' ? next : 'system'
    paint(choice)
  }

  media.addEventListener('change', onMedia)
  chrome.storage.onChanged.addListener(onStored)
  return () => {
    media.removeEventListener('change', onMedia)
    chrome.storage.onChanged.removeListener(onStored)
  }
}
