import { beforeEach, describe, expect, it, vi } from 'vitest'

const clients: { options: { auth: { storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }; autoRefreshToken: boolean; persistSession: boolean } } }[] = []

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, _key: string, options: typeof clients[number]['options']) => {
    const client = { options }
    clients.push(client)
    return client
  },
}))

describe('extension Supabase clients', () => {
  beforeEach(() => clients.splice(0))

  it('panel and worker use the same chrome storage session with context-safe refresh modes', async () => {
    const { createPanelSupabase, createWorkerSupabase } = await import('./supabase')
    const panel = createPanelSupabase() as unknown as typeof clients[number]
    const worker = createWorkerSupabase() as unknown as typeof clients[number]

    expect(panel.options.auth.persistSession).toBe(true)
    expect(worker.options.auth.persistSession).toBe(true)
    expect(panel.options.auth.autoRefreshToken).toBe(true)
    expect(worker.options.auth.autoRefreshToken).toBe(false)
    expect(panel.options.auth.storage).toBe(worker.options.auth.storage)

    await panel.options.auth.storage.setItem('sb-shared-auth-token', 'session-one')
    await expect(worker.options.auth.storage.getItem('sb-shared-auth-token')).resolves.toBe('session-one')
  })
})
