-- =============================================================================
-- PHILRADS Staff Portal: bell notifications for PHILRADS IMS activity
--
-- Each time the IMS pushes a snapshot, it's compared with the previous one and
-- the portal's notification bell gets an entry for what's new. In the portal only:
-- the IMS already emails people, so nothing is emailed from here.
--   * release waiting for approval -> staff with inventory.approve
--   * new item in the IMS          -> staff with inventory.record
--   * stock received / released    -> staff with inventory.record
-- A busy push (more than 5 stock changes) becomes one summary instead of many entries.
-- The very first snapshot has nothing to compare with, so it notifies nobody.
-- =============================================================================

create or replace function public.notify_ims_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prev jsonb := case when tg_op = 'UPDATE' then old.payload end;
  moves jsonb;
  move_count int;
begin
  if prev is null then
    return new;
  end if;

  create temp table if not exists ims_recipients (id uuid, permission text) on commit drop;
  truncate pg_temp.ims_recipients;
  insert into pg_temp.ims_recipients
    select p.id, rp.permission_key
    from public.profiles p
    join public.role_permissions rp on rp.role_key = p.role_key
    where p.is_active and rp.permission_key in ('inventory.approve', 'inventory.record');

  -- Releases waiting for approval that weren't waiting before.
  insert into public.notifications (recipient_id, title, body, link_path)
  select r.id,
         'Release waiting for approval: ' || (rel ->> 'code'),
         concat_ws(' · ', nullif(rel ->> 'purpose', ''), nullif(rel ->> 'recipient_org', ''), 'requested by ' || (rel ->> 'requested_by')),
         '/inventory?tab=approvals'
  from (
    select rel from jsonb_array_elements(coalesce(new.payload -> 'pending_releases', '[]'::jsonb)) rel
    where not exists (
      select 1 from jsonb_array_elements(coalesce(prev -> 'pending_releases', '[]'::jsonb)) o where o ->> 'id' = rel ->> 'id'
    )
    limit 20
  ) fresh
  cross join pg_temp.ims_recipients r
  where r.permission = 'inventory.approve';

  -- Items added to the IMS catalogue.
  insert into public.notifications (recipient_id, title, body, link_path)
  select r.id,
         'New item in the IMS: ' || (item ->> 'name'),
         concat_ws(' · ', nullif(item ->> 'code', ''), nullif(item ->> 'category', '')),
         '/inventory'
  from (
    select item from jsonb_array_elements(coalesce(new.payload -> 'items', '[]'::jsonb)) item
    where not exists (
      select 1 from jsonb_array_elements(coalesce(prev -> 'items', '[]'::jsonb)) o where o ->> 'id' = item ->> 'id'
    )
    limit 10
  ) fresh
  cross join pg_temp.ims_recipients r
  where r.permission = 'inventory.record';

  -- Stock received or released (applied movements that weren't in the previous snapshot).
  select coalesce(jsonb_agg(m), '[]'::jsonb) into moves
  from jsonb_array_elements(coalesce(new.payload -> 'movements', '[]'::jsonb)) m
  where m ->> 'kind' in ('receipt', 'release')
    and m ->> 'status' = 'applied'
    and not exists (
      select 1 from jsonb_array_elements(coalesce(prev -> 'movements', '[]'::jsonb)) o where o ->> 'id' = m ->> 'id'
    );
  move_count := jsonb_array_length(moves);

  if move_count between 1 and 5 then
    insert into public.notifications (recipient_id, title, body, link_path)
    select r.id,
           case when m ->> 'kind' = 'receipt' then 'Stock received: ' else 'Stock released: ' end
             || trim(to_char(abs((m ->> 'qty')::numeric), 'FM999,999,990.##')) || ' '
             || coalesce(nullif(item ->> 'unit', ''), 'units') || ' ' || coalesce(item ->> 'name', 'item'),
           concat_ws(' · ', nullif(m ->> 'location', ''), nullif(m ->> 'reference', ''), 'by ' || (m ->> 'recorded_by')),
           '/inventory?tab=log'
    from jsonb_array_elements(moves) m
    left join lateral (
      select i from jsonb_array_elements(coalesce(new.payload -> 'items', '[]'::jsonb)) i where i ->> 'id' = m ->> 'item_id' limit 1
    ) found(item) on true
    cross join pg_temp.ims_recipients r
    where r.permission = 'inventory.record';
  elsif move_count > 5 then
    insert into public.notifications (recipient_id, title, body, link_path)
    select r.id,
           move_count || ' stock changes in the IMS',
           concat_ws(', ',
             nullif((select count(*) from jsonb_array_elements(moves) m where m ->> 'kind' = 'receipt'), 0) || ' received',
             nullif((select count(*) from jsonb_array_elements(moves) m where m ->> 'kind' = 'release'), 0) || ' released'),
           '/inventory?tab=log'
    from pg_temp.ims_recipients r
    where r.permission = 'inventory.record';
  end if;

  return new;
end;
$$;

create trigger ims_snapshot_notify after insert or update on public.ims_inventory_snapshot
  for each row execute function public.notify_ims_changes();
revoke execute on function public.notify_ims_changes() from public, anon, authenticated;
