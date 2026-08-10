import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('gateway key selection', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers the configured key over a browser-stored fallback', async () => {
    vi.stubEnv('VITE_PM_GATEWAY_KEY', 'configured-test-key')
    localStorage.setItem('sales-app.pmGatewayKey', 'browser-test-key')

    const { loadGatewayKey, hasConfiguredGatewayKey } = await import('./gateway-key')

    expect(loadGatewayKey()).toBe('configured-test-key')
    expect(hasConfiguredGatewayKey()).toBe(true)
  })

  it('uses the browser-stored fallback when no configured key exists', async () => {
    localStorage.setItem('sales-app.pmGatewayKey', 'browser-test-key')

    const { loadGatewayKey, hasConfiguredGatewayKey } = await import('./gateway-key')

    expect(loadGatewayKey()).toBe('browser-test-key')
    expect(hasConfiguredGatewayKey()).toBe(false)
  })
})
