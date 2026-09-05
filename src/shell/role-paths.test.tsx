import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// REG-001. The shells mount at admin/*, manage/* and rep/*, so a root-absolute
// `/inbox` is not a route at all — it fell through to `<Route path="*">` and
// redirected the user to their own home. Every shared CTA built one.
let role: string | null = 'agent'
vi.mock('./ClientProvider', () => ({
  useClient: () => ({ activeClient: role ? { id: 'c-1', role } : null }),
}))

const { useRolePath, ROLE_HOME } = await import('./RoleRouter')

function prefix(as: string | null) {
  role = as
  return renderHook(() => useRolePath()).result.current
}

describe('useRolePath', () => {
  it('sends each role to its own shell', () => {
    expect(prefix('agent')('/inbox')).toBe('/rep/inbox')
    expect(prefix('manager')('/inbox')).toBe('/manage/inbox')
    expect(prefix('client_admin')('/inbox')).toBe('/admin/inbox')
  })

  it('maps "/" to the shell base rather than the app root', () => {
    expect(prefix('manager')('/')).toBe('/manage')
    expect(prefix('client_admin')('/')).toBe('/admin')
    expect(prefix('agent')('/')).toBe('/rep')
  })

  it('keeps query strings and fragments attached', () => {
    expect(prefix('agent')('/inbox?c=abc')).toBe('/rep/inbox?c=abc')
    expect(prefix('manager')('/crm?tab=todos&t=1')).toBe('/manage/crm?tab=todos&t=1')
    expect(prefix('agent')('/?x=1')).toBe('/rep?x=1')
    expect(prefix('manager')('/docs#fees')).toBe('/manage/docs#fees')
  })

  // RepShell mounts the CRM at `leads` and has no `crm` route, so prefixing
  // alone would still land the rep on their home.
  it('translates the rep CRM alias, and only for the rep', () => {
    expect(prefix('agent')('/crm')).toBe('/rep/leads')
    expect(prefix('agent')('/crm?tab=todos')).toBe('/rep/leads?tab=todos')
    expect(prefix('manager')('/crm')).toBe('/manage/crm')
    expect(prefix('client_admin')('/crm')).toBe('/admin/crm')
  })

  it('leaves anything that is not an app-absolute path alone', () => {
    const rep = prefix('agent')
    expect(rep('https://example.com/x')).toBe('https://example.com/x')
    expect(rep('mailto:a@b.c')).toBe('mailto:a@b.c')
    expect(rep('relative/thing')).toBe('relative/thing')
  })

  it('is idempotent — a path already carrying its base is untouched', () => {
    const rep = prefix('agent')
    expect(rep('/rep')).toBe('/rep')
    expect(rep('/rep/inbox')).toBe('/rep/inbox')
    expect(rep('/rep?x=1')).toBe('/rep?x=1')
  })

  it('changes nothing when there is no workspace yet', () => {
    expect(prefix(null)('/inbox')).toBe('/inbox')
  })

  it('prefixes with exactly the base RoleRouter mounts each shell at', () => {
    expect(prefix('agent')('/x')).toBe(`${ROLE_HOME.agent}/x`)
    expect(prefix('manager')('/x')).toBe(`${ROLE_HOME.manager}/x`)
    expect(prefix('client_admin')('/x')).toBe(`${ROLE_HOME.client_admin}/x`)
  })
})
