import { afterEach, describe, expect, it } from 'vitest'
import { followTheme, loadThemeChoice, saveThemeChoice } from './theme'

/** One mutable media object: followTheme closes over the object it got at call
 *  time, so swapping matchMedia afterwards would test nothing. */
function stubMedia(dark: boolean) {
  const listeners = new Set<() => void>()
  const media = {
    matches: dark,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }
  window.matchMedia = (() => media) as unknown as typeof window.matchMedia
  return { listeners, media }
}

const theme = () => document.documentElement.getAttribute('data-theme')
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => document.documentElement.removeAttribute('data-theme'))

describe('followTheme', () => {
  it('paints from the OS synchronously, before the stored choice arrives', () => {
    stubMedia(true)
    followTheme()
    // Not awaited on purpose: the storage read is async, and a frame of the
    // wrong theme is a visible white flash in dark mode.
    expect(theme()).toBe('dark')
  })

  it('never leaves the attribute unset', () => {
    stubMedia(false)
    followTheme()
    expect(theme()).toBe('light')
  })

  it('keeps following the OS while the choice is "system"', async () => {
    const { listeners, media } = stubMedia(false)
    followTheme()
    await settle()
    media.matches = true
    listeners.forEach((fn) => fn())
    expect(theme()).toBe('dark')
  })

  it('lets an explicit choice override a contrary OS, and stops following it', async () => {
    const { listeners, media } = stubMedia(true)
    await saveThemeChoice('light')
    followTheme()
    await settle()
    expect(theme()).toBe('light')

    media.matches = false
    listeners.forEach((fn) => fn())
    expect(theme()).toBe('light')
  })

  it('repaints when another surface changes the choice', async () => {
    stubMedia(false)
    followTheme()
    await settle()
    expect(theme()).toBe('light')

    // What the options TAB does; the side PANEL must follow without a reload.
    await saveThemeChoice('dark')
    expect(theme()).toBe('dark')
  })

  it('round-trips the stored choice and defaults to system', async () => {
    expect(await loadThemeChoice()).toBe('system')
    await saveThemeChoice('dark')
    expect(await loadThemeChoice()).toBe('dark')
  })

  it('stops listening once detached', async () => {
    const { listeners } = stubMedia(false)
    followTheme()()
    expect(listeners.size).toBe(0)
  })
})
