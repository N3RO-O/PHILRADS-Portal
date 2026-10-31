-- Statistics: funding is private, and the statistics workbook can be synced into the records.
--
-- * Funding amounts, funding notes and donors move out of program_activities into
--   program_activity_funding, readable only with funding.read (administrators and coordinators).
--   Everyone else who can see the Live Map still sees the activities themselves, without them.
--   Existing values are copied across before the old columns are dropped.
-- * sync_program_activities(changes) applies a reviewed set of additions and updates from the
--   statistics workbook in one transaction. It needs projects.manage; funding changes in it also
--   need funding.read. It never deletes or hides records (other sources feed them too).

insert into public.permissions (key, description) values
  ('funding.read', 'See funding amounts and donors of PHILRADS activities, and the top donors (TBC)')
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values
  ('admin', 'funding.read'),
  ('coordinator', 'funding.read')
on conflict do nothing;

create table public.program_activity_funding (
  activity_id uuid primary key references public.program_activities (id) on delete cascade,
  funding numeric(14, 2) check (funding >= 0),
  funding_note text,
  donors text,
  updated_at timestamptz not null default now()
);

create trigger program_activity_funding_set_updated_at before update on public.program_activity_funding
  for each row execute function public.set_updated_at();

insert into public.program_activity_funding (activity_id, funding, funding_note, donors)
select id, funding, funding_note, donors
from public.program_activities
where funding is not null or funding_note is not null or donors is not null;

alter table public.program_activities
  drop column funding,
  drop column funding_note,
  drop column donors;

alter table public.program_activity_funding enable row level security;

create policy program_activity_funding_read on public.program_activity_funding for select to authenticated
  using ((select public.has_permission('funding.read')));
create policy program_activity_funding_insert on public.program_activity_funding for insert to authenticated
  with check ((select public.has_permission('funding.read')) and (select public.has_permission('projects.manage')));
create policy program_activity_funding_update on public.program_activity_funding for update to authenticated
  using ((select public.has_permission('funding.read')) and (select public.has_permission('projects.manage')))
  with check ((select public.has_permission('funding.read')) and (select public.has_permission('projects.manage')));

revoke delete on public.program_activity_funding from authenticated;
revoke all on public.program_activity_funding from anon;

-- ---------------------------------------------------------------------------
-- Sync from the statistics workbook
-- ---------------------------------------------------------------------------
-- p_changes is a JSON array of:
--   { "action": "insert", "row": { year, start_date, end_date, date_label, program, activity, site,
--       households_target, individuals_target, households_served, individuals_served,
--       partner, contact_person, status, source, notes }, "fund": { funding?, funding_note?, donors? } }
--   { "action": "update", "id": "<uuid>", "set": { only the fields to change }, "fund": { ... } }
-- Runs with the caller's rights (Row Level Security and column grants apply), all or nothing.
create or replace function public.sync_program_activities(p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c jsonb;
  r jsonb;
  s jsonb;
  f jsonb;
  v_id uuid;
  n_inserted int := 0;
  n_updated int := 0;
  n_funding int := 0;
begin
  if not public.has_permission('projects.manage') then
    raise exception 'Only coordinators and administrators can sync the statistics' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) <> 'array' then
    raise exception 'Expected a list of changes' using errcode = '22023';
  end if;

  for c in select value from jsonb_array_elements(p_changes) loop
    if c->>'action' = 'insert' then
      r := c->'row';
      insert into public.program_activities (
        year, start_date, end_date, date_label, program, activity, site,
        households_target, individuals_target, households_served, individuals_served,
        partner, contact_person, status, source, notes)
      values (
        (r->>'year')::smallint, (r->>'start_date')::date, (r->>'end_date')::date, r->>'date_label', r->>'program', r->>'activity', r->>'site',
        (r->>'households_target')::int, (r->>'individuals_target')::int, (r->>'households_served')::int, (r->>'individuals_served')::int,
        r->>'partner', r->>'contact_person', coalesce(r->>'status', 'completed'), r->>'source', r->>'notes')
      returning id into v_id;
      n_inserted := n_inserted + 1;
    elsif c->>'action' = 'update' then
      v_id := (c->>'id')::uuid;
      s := coalesce(c->'set', '{}'::jsonb);
      if s <> '{}'::jsonb then
        update public.program_activities set
          households_target = case when s ? 'households_target' then (s->>'households_target')::int else households_target end,
          individuals_target = case when s ? 'individuals_target' then (s->>'individuals_target')::int else individuals_target end,
          households_served = case when s ? 'households_served' then (s->>'households_served')::int else households_served end,
          individuals_served = case when s ? 'individuals_served' then (s->>'individuals_served')::int else individuals_served end,
          partner = case when s ? 'partner' then s->>'partner' else partner end,
          contact_person = case when s ? 'contact_person' then s->>'contact_person' else contact_person end
        where id = v_id and is_active;
        if not found then
          raise exception 'A record being updated no longer exists. Reload and review the sync again.' using errcode = 'P0002';
        end if;
        n_updated := n_updated + 1;
      end if;
    else
      raise exception 'Unknown change: %', c->>'action' using errcode = '22023';
    end if;

    f := c->'fund';
    if f is not null and f <> '{}'::jsonb then
      if not public.has_permission('funding.read') then
        raise exception 'Only coordinators and administrators can change funding' using errcode = '42501';
      end if;
      insert into public.program_activity_funding as pf (activity_id, funding, funding_note, donors)
      values (v_id, (f->>'funding')::numeric, f->>'funding_note', f->>'donors')
      on conflict (activity_id) do update set
        funding = case when f ? 'funding' then excluded.funding else pf.funding end,
        funding_note = case when f ? 'funding_note' then excluded.funding_note else pf.funding_note end,
        donors = case when f ? 'donors' then excluded.donors else pf.donors end;
      n_funding := n_funding + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', n_inserted, 'updated', n_updated, 'funding', n_funding);
end;
$$;

revoke execute on function public.sync_program_activities(jsonb) from public, anon;
grant execute on function public.sync_program_activities(jsonb) to authenticated;
