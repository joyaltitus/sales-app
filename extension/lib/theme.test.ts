import { afterEach, describe, expect, it } from 'vitest'
import { followSystemTheme } from './theme'

/** One mutable media object, because followSystemTheme closes over the object it
 *  got at call time — swapping matchMedia afterwards would test nothing. */
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

afterEach(() => document.documentElement.removeAttribute('data-theme'))

describe('followSystemTheme', () => {
  it('paints dark when the OS asks for dark', () => {
    stubMedia(true)
    followSystemTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('paints light otherwise — never leaves the attribute unset', () => {
    stubMedia(false)
    followSystemTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('keeps following after the rep flips their OS theme mid-shift', () => {
    const { listeners, media } = stubMedia(false)
    followSystemTheme()
    media.matches = true
    listeners.forEach((fn) => fn())
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('stops listening once detached', () => {
    const { listeners } = stubMedia(false)
    followSystemTheme()()
    expect(listeners.size).toBe(0)
  })
})
