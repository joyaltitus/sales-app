/**
 * followSystemTheme — give the panel a dark mode.
 *
 * tokens.css keys dark off `[data-theme='dark']` on <html>, and that attribute
 * is set by src/shell/theme.ts — which only the WEB app mounts. So every
 * extension surface rendered permanently light, however the rep's OS was set:
 * a 400px white column pinned beside a dark browser, all day.
 *
 * The panel has no theme toggle to honour (there is no room for one and no
 * reason to disagree with the OS beside a chat), so it simply follows the
 * system and keeps following it — `change` fires when the rep flips their OS
 * theme, or when Windows crosses its own light/dark schedule mid-shift.
 */
export function followSystemTheme(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    document.documentElement.setAttribute('data-theme', media.matches ? 'dark' : 'light')
  }
  apply()
  media.addEventListener('change', apply)
  return () => media.removeEventListener('change', apply)
}
