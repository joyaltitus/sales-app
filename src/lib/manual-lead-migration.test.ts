import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260818000000_create_manual_lead_rpc.sql?raw'

const sql = migration.toLowerCase()

describe('create_manual_lead database contract', () => {
  it('is invoker-secured, membership checked, tenant related, and authenticated-only', () => {
    expect(sql).toContain('security invoker')
    expect(sql).toContain('m.user_id = v_user_id')
    expect(sql).toContain('m.client_id = p_client_id')
    expect(sql).toContain('s.client_id = p_client_id')
    expect(sql).toContain('c.client_id = p_client_id')
    expect(sql).toContain('l.client_id = p_client_id')
    expect(sql).toContain('revoke all on function public.create_manual_lead')
    expect(sql).toContain('grant execute on function public.create_manual_lead')
    expect(sql).toContain('to authenticated')
  })

  it('serializes contact identity and retains database uniqueness', () => {
    expect(sql).toContain('unique index if not exists uq_contacts_client_channel_external')
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain('on conflict (client_id, channel, external_id) do nothing')
    expect(sql).toContain("and l.status = 'open'")
  })

  it('creates the contact, lead, and optional note inside one transaction function', () => {
    expect(sql).toContain('insert into public.contacts')
    expect(sql).toContain('update public.contacts')
    expect(sql).toContain('insert into public.leads')
    expect(sql).toContain('insert into public.conversation_notes')
    expect(sql).toContain('begin;')
    expect(sql).toContain('commit;')
  })
})
