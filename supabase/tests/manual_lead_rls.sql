-- Run against an ephemeral database loaded with the canonical hub schema, after
-- applying ../migrations/20260818000000_create_manual_lead_rpc.sql.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/manual_lead_rls.sql
\set ON_ERROR_STOP on
begin;

select gen_random_uuid() as client_a, gen_random_uuid() as client_b,
       gen_random_uuid() as manager_a, gen_random_uuid() as admin_a,
       gen_random_uuid() as agent_a, gen_random_uuid() as user_b,
       gen_random_uuid() as outsider
\gset

insert into public.users (id) values
  (:'manager_a'), (:'admin_a'), (:'agent_a'), (:'user_b'), (:'outsider');
insert into public.clients (id, name) values
  (:'client_a', 'Manual lead RPC test A'),
  (:'client_b', 'Manual lead RPC test B');
insert into public.user_client_memberships (user_id, client_id, role) values
  (:'manager_a', :'client_a', 'manager'),
  (:'admin_a', :'client_a', 'client_admin'),
  (:'agent_a', :'client_a', 'agent'),
  (:'user_b', :'client_b', 'manager');
insert into public.lead_stages (client_id, stage_key, label) values
  (:'client_a', 'rpc-test-a', 'RPC test A'),
  (:'client_b', 'rpc-test-b', 'RPC test B')
returning id, client_id;
select id as stage_a from public.lead_stages where client_id = :'client_a' and stage_key = 'rpc-test-a' \gset
select id as stage_b from public.lead_stages where client_id = :'client_b' and stage_key = 'rpc-test-b' \gset
select set_config('test.client_a', :'client_a', true), set_config('test.client_b', :'client_b', true),
       set_config('test.stage_a', :'stage_a', true), set_config('test.stage_b', :'stage_b', true);

-- Manager succeeds, creates all three rows, and a retry is idempotent.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'manager_a')::text, true);
select public.create_manual_lead(
  :'client_a', 'Manager Lead', '98765 43210', 'phone', :'stage_a', 50000, 'Call tomorrow', 'Initial note'
) as manager_lead \gset
select public.create_manual_lead(
  :'client_a', 'Manager Lead', '98765 43210', 'phone', :'stage_a', 50000, 'Call tomorrow', 'Initial note'
) as retry_lead \gset
reset role;
select set_config('test.manager_lead', :'manager_lead', true),
       set_config('test.retry_lead', :'retry_lead', true);
do $$ begin
  if current_setting('test.retry_lead')::uuid <> current_setting('test.manager_lead')::uuid then raise exception 'idempotent retry returned another lead'; end if;
  if (select count(*) from public.contacts where client_id = current_setting('test.client_a')::uuid and channel = 'phone' and external_id = '919876543210') <> 1 then
    raise exception 'manager contact count mismatch';
  end if;
  if (select count(*) from public.leads where id = current_setting('test.manager_lead')::uuid) <> 1 then raise exception 'manager lead missing'; end if;
  if (select count(*) from public.conversation_notes where lead_id = current_setting('test.manager_lead')::uuid) <> 1 then raise exception 'initial note missing or duplicated'; end if;
end $$;

-- Client admin also succeeds.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin_a')::text, true);
select public.create_manual_lead(
  :'client_a', 'Admin Lead', '9111111111', 'phone', :'stage_a', null, null, null
) as admin_lead \gset
reset role;

-- A user with no A membership and a client-B user crafting client-A values fail.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'outsider')::text, true);
do $$ begin
  perform public.create_manual_lead(current_setting('test.client_a')::uuid, 'Outsider', '9222222222', 'phone', current_setting('test.stage_a')::uuid);
  raise exception 'outsider unexpectedly created lead';
exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'user_b')::text, true);
do $$ begin
  perform public.create_manual_lead(current_setting('test.client_a')::uuid, 'Cross tenant', '98765 43210', 'phone', current_setting('test.stage_b')::uuid);
  raise exception 'client B user unexpectedly wrote client A';
exception when insufficient_privilege then null; end $$;
reset role;

-- An authorized A manager cannot associate a B stage.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'manager_a')::text, true);
do $$ begin
  perform public.create_manual_lead(current_setting('test.client_a')::uuid, 'Wrong stage', '9333333333', 'phone', current_setting('test.stage_b')::uuid);
  raise exception 'cross-tenant stage unexpectedly accepted';
exception when invalid_parameter_value then null; end $$;
reset role;

-- Reps cannot create the conversation-less lead allowed only to manager/admin;
-- the contact insert earlier in the function must roll back with the RLS denial.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'agent_a')::text, true);
do $$ begin
  perform public.create_manual_lead(current_setting('test.client_a')::uuid, 'Rep denied', '9444444444', 'phone', current_setting('test.stage_a')::uuid);
  raise exception 'rep unexpectedly created manual lead';
exception when insufficient_privilege then null; end $$;
reset role;
do $$ begin
  if exists (select 1 from public.contacts where client_id = current_setting('test.client_a')::uuid and external_id = '919444444444') then
    raise exception 'partial contact survived denied rep lead';
  end if;
end $$;

-- Force a required lead write to fail and prove the earlier contact rolls back.
create function pg_temp.reject_forced_lead() returns trigger language plpgsql as $$
begin
  if new.next_action = 'force-failure' then raise exception 'forced lead failure'; end if;
  return new;
end $$;
create trigger manual_lead_force_failure before insert on public.leads
  for each row execute function pg_temp.reject_forced_lead();
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'manager_a')::text, true);
do $$ begin
  perform public.create_manual_lead(current_setting('test.client_a')::uuid, 'Rollback proof', '9555555555', 'phone', current_setting('test.stage_a')::uuid, null, 'force-failure', null);
  raise exception 'forced failure did not fire';
exception when others then
  if sqlerrm <> 'forced lead failure' then raise; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.contacts where client_id = current_setting('test.client_a')::uuid and external_id = '919555555555') then
    raise exception 'partial contact survived failed lead insert';
  end if;
end $$;

rollback;
select 'manual_lead_rls: 10 assertions passed' as result;
