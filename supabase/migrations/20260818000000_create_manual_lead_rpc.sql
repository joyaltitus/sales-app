-- Atomic, tenant-checked manual lead creation for the sales app.
-- SECURITY INVOKER deliberately keeps table RLS and grants in force.
begin;

-- Existing production schema already has this index. Reassert it idempotently so
-- contact identity and the ON CONFLICT target below stay part of this contract.
create unique index if not exists uq_contacts_client_channel_external
  on public.contacts (client_id, channel, external_id);

-- Lead-only notes are part of the existing frontend contract.
alter table public.conversation_notes alter column conversation_id drop not null;

-- Re-scope the CRM/read-side policies to authenticated callers while preserving
-- the production role predicates. `TO authenticated` is not authorization by
-- itself; every policy below still checks tenant membership/role.
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select to authenticated
  using (client_id in (select public.my_client_ids()));
drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts for insert to authenticated
  with check (public.has_role(client_id, array['client_admin','manager','agent']));
drop policy if exists contacts_agent_update on public.contacts;
create policy contacts_agent_update on public.contacts for update to authenticated
  using (public.has_role(client_id, array['client_admin','manager','agent']))
  with check (public.has_role(client_id, array['client_admin','manager','agent']));

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated
  using (client_id in (select public.my_client_ids()));
drop policy if exists leads_write on public.leads;
create policy leads_write on public.leads for all to authenticated
  using (public.has_role(client_id, array['client_admin','manager']))
  with check (public.has_role(client_id, array['client_admin','manager']));
drop policy if exists leads_agent_insert on public.leads;
create policy leads_agent_insert on public.leads for insert to authenticated
  with check (
    public.has_role(client_id, array['agent'])
    and public.is_conversation_assignee(conversation_id)
  );
drop policy if exists leads_agent_update on public.leads;
create policy leads_agent_update on public.leads for update to authenticated
  using (
    public.has_role(client_id, array['agent'])
    and public.is_conversation_assignee(conversation_id)
  )
  with check (
    public.has_role(client_id, array['agent'])
    and public.is_conversation_assignee(conversation_id)
  );

drop policy if exists conversation_notes_select on public.conversation_notes;
create policy conversation_notes_select on public.conversation_notes for select to authenticated
  using (client_id in (select public.my_client_ids()));
drop policy if exists conversation_notes_insert on public.conversation_notes;
create policy conversation_notes_insert on public.conversation_notes for insert to authenticated
  with check (client_id in (select public.my_client_ids()) and author = auth.uid());
drop policy if exists conversation_notes_delete on public.conversation_notes;
create policy conversation_notes_delete on public.conversation_notes for delete to authenticated
  using (public.has_role(client_id, array['client_admin']) or author = auth.uid());

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations for select to authenticated
  using (client_id in (select public.my_client_ids()));
drop policy if exists conversations_agent_update on public.conversations;
create policy conversations_agent_update on public.conversations for update to authenticated
  using (
    public.has_role(client_id, array['client_admin','manager'])
    or (
      public.has_role(client_id, array['agent'])
      and (
        public.agent_assign_scope(client_id) = 'team'
        or (public.agent_assign_scope(client_id) = 'self' and (assigned_to = auth.uid() or assigned_to is null))
        or (public.agent_assign_scope(client_id) = 'none' and assigned_to = auth.uid())
      )
    )
  )
  with check (
    public.has_role(client_id, array['client_admin','manager'])
    or (
      public.has_role(client_id, array['agent'])
      and (
        public.agent_assign_scope(client_id) = 'team'
        or (public.agent_assign_scope(client_id) in ('self','none') and assigned_to = auth.uid())
      )
    )
  );

drop policy if exists lead_stages_select on public.lead_stages;
create policy lead_stages_select on public.lead_stages for select to authenticated
  using (client_id in (select public.my_client_ids()));
drop policy if exists lead_stages_write on public.lead_stages;
create policy lead_stages_write on public.lead_stages for all to authenticated
  using (public.has_role(client_id, array['client_admin']))
  with check (public.has_role(client_id, array['client_admin']));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (client_id in (select public.my_client_ids()));
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for all to authenticated
  using (user_id = auth.uid() or public.has_role(client_id, array['manager','client_admin']))
  with check (user_id = auth.uid() or public.has_role(client_id, array['manager','client_admin']));

drop policy if exists ucm_select on public.user_client_memberships;
create policy ucm_select on public.user_client_memberships for select to authenticated
  using (user_id = auth.uid());
drop policy if exists ucm_admin on public.user_client_memberships;
create policy ucm_admin on public.user_client_memberships for all to authenticated
  using (public.has_role(client_id, array['super_admin']))
  with check (public.has_role(client_id, array['super_admin']));

create or replace function public.create_manual_lead(
  p_client_id uuid,
  p_profile_name text,
  p_external_id text,
  p_channel text,
  p_stage_id uuid,
  p_est_value numeric default null,
  p_next_action text default null,
  p_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_external_id text;
  v_channel text := lower(coalesce(nullif(btrim(p_channel), ''), 'phone'));
  v_contact_id uuid;
  v_lead_id uuid;
begin
  if v_user_id is null or not exists (
    select 1
      from public.user_client_memberships m
     where m.user_id = v_user_id
       and m.client_id = p_client_id
  ) then
    raise insufficient_privilege using message = 'not authorized for supplied client';
  end if;

  if not exists (
    select 1
      from public.lead_stages s
     where s.id = p_stage_id
       and s.client_id = p_client_id
  ) then
    raise invalid_parameter_value using message = 'stage does not belong to supplied client';
  end if;

  -- Match the frontend's phone normalization while retaining non-phone channel IDs.
  v_external_id := case
    when v_channel in ('phone', 'whatsapp') then regexp_replace(split_part(coalesce(p_external_id, ''), '@', 1), '[^0-9]', '', 'g')
    else btrim(coalesce(p_external_id, ''))
  end;
  if v_channel in ('phone', 'whatsapp') and length(v_external_id) = 10 then
    v_external_id := '91' || v_external_id;
  end if;
  if v_external_id = '' then
    raise invalid_parameter_value using message = 'contact identifier is required';
  end if;

  -- Serialize this logical identity. The unique index prevents duplicate contacts;
  -- the lock plus the partial unique open-lead index prevents concurrent duplicate leads.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_client_id::text || '|' || v_channel || '|' || v_external_id, 0)
  );

  select c.id into v_contact_id
    from public.contacts c
   where c.client_id = p_client_id
     and c.channel = v_channel
     and c.external_id = v_external_id;

  if v_contact_id is null then
    insert into public.contacts (client_id, channel, external_id, profile_name)
    values (p_client_id, v_channel, v_external_id, nullif(btrim(p_profile_name), ''))
    on conflict (client_id, channel, external_id) do nothing
    returning id into v_contact_id;

    if v_contact_id is null then
      select c.id into strict v_contact_id
        from public.contacts c
       where c.client_id = p_client_id
         and c.channel = v_channel
         and c.external_id = v_external_id;
    end if;
  end if;

  if nullif(btrim(p_profile_name), '') is not null then
    update public.contacts
       set profile_name = btrim(p_profile_name)
     where client_id = p_client_id
       and id = v_contact_id
       and nullif(btrim(profile_name), '') is null;
  end if;

  -- An already-open lead is the idempotent result for a repeated/concurrent submit.
  select l.id into v_lead_id
    from public.leads l
   where l.client_id = p_client_id
     and l.contact_id = v_contact_id
     and l.status = 'open';
  if v_lead_id is not null then
    return v_lead_id;
  end if;

  insert into public.leads (
    client_id, contact_id, stage_id, status, source, est_value, next_action
  ) values (
    p_client_id, v_contact_id, p_stage_id, 'open', 'manual', p_est_value,
    nullif(btrim(p_next_action), '')
  ) returning id into v_lead_id;

  if nullif(btrim(p_note), '') is not null then
    insert into public.conversation_notes (
      client_id, conversation_id, lead_id, author, body
    ) values (
      p_client_id, null, v_lead_id, v_user_id, btrim(p_note)
    );
  end if;

  return v_lead_id;
end;
$function$;

revoke all on function public.create_manual_lead(uuid, text, text, text, uuid, numeric, text, text) from public;
revoke all on function public.create_manual_lead(uuid, text, text, text, uuid, numeric, text, text) from anon;
grant execute on function public.create_manual_lead(uuid, text, text, text, uuid, numeric, text, text) to authenticated;

commit;
