-- =============================================================================
-- PHILRADS Staff Portal: read-only stock mirrored from PHILRADS IMS
--
-- The IMS (PHP/MySQL on InfinityFree) is where stock is received, released and
-- approved. After every stock change it pushes a signed snapshot to
-- /api/ims-sync (Vercel), which stores it here with the service-role key.
-- Staff with inventory.read see it on the Inventory page when
-- VITE_INVENTORY_SOURCE=ims. Nobody can write it through the API.
-- =============================================================================

create table public.ims_inventory_snapshot (
  id smallint primary key default 1 check (id = 1),
  -- When the IMS built the snapshot (its clock); used to ignore out-of-order pushes.
  generated_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);
comment on table public.ims_inventory_snapshot is
  'Latest stock snapshot pushed by PHILRADS IMS (single row). Read-only mirror; the IMS is the source of truth.';

alter table public.ims_inventory_snapshot enable row level security;
create policy ims_inventory_snapshot_read on public.ims_inventory_snapshot for select to authenticated
  using ((select public.has_permission('inventory.read')));
revoke insert, update, delete on public.ims_inventory_snapshot from authenticated;
revoke all on public.ims_inventory_snapshot from anon;

-- Called only by /api/ims-sync with the service-role key. Keeps the newest snapshot;
-- returns false if the incoming one is older than what is stored.
create or replace function public.store_ims_snapshot(p_generated_at timestamptz, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ims_inventory_snapshot (id, generated_at, received_at, payload)
  values (1, p_generated_at, now(), p_payload)
  on conflict (id) do update
    set generated_at = excluded.generated_at, received_at = now(), payload = excluded.payload
    where public.ims_inventory_snapshot.generated_at <= excluded.generated_at;
  return found;
end;
$$;

revoke execute on function public.store_ims_snapshot(timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.store_ims_snapshot(timestamptz, jsonb) to service_role;
