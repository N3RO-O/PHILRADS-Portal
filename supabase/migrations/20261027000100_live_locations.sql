-- =============================================================================
-- PHILRADS Staff Portal: live location sharing (Live Map)
--
-- Opt-in, per person: "Share my live location" is off until the person turns it on,
-- for a time they choose (at most 24 hours). While it's on and the portal is open on
-- their phone, their position is updated here every few seconds and pushed to
-- everyone's map in real time (Supabase Realtime). One row per person: the latest
-- position only, no trail. Stopping deletes the row; once sharing_until passes the
-- row is hidden at once and removed by the next share.
-- Seen by map.read (like check-ins); shared by map.checkin.
-- =============================================================================

create table public.live_locations (
  profile_id uuid primary key references public.profiles (id) on delete cascade default auth.uid(),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real check (accuracy_m is null or accuracy_m between 0 and 100000),
  heading real check (heading is null or heading between 0 and 360),
  speed_mps real check (speed_mps is null or speed_mps between 0 and 300),
  started_at timestamptz not null default now(),
  sharing_until timestamptz not null,
  updated_at timestamptz not null default now()
);
comment on table public.live_locations is
  'Opt-in live location: latest position only, while the person chooses to share (max 24 h). Never in the background: only while the portal is open.';

alter table public.live_locations enable row level security;
-- Others see a position only while it's being shared; you always see your own (so sharing
-- again after it ran out simply replaces it).
create policy live_locations_read on public.live_locations for select to authenticated
  using (profile_id = (select auth.uid()) or ((select public.has_permission('map.read')) and sharing_until > now()));
create policy live_locations_insert on public.live_locations for insert to authenticated
  with check (
    profile_id = (select auth.uid()) and (select public.has_permission('map.checkin'))
    and sharing_until > now() and sharing_until <= now() + interval '24 hours'
  );
create policy live_locations_update on public.live_locations for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid()) and (select public.has_permission('map.checkin'))
    and sharing_until > now() and sharing_until <= now() + interval '24 hours'
  );
create policy live_locations_delete_own on public.live_locations for delete to authenticated
  using (profile_id = (select auth.uid()));
revoke all on public.live_locations from anon;

-- Positions always carry the server's time.
create or replace function public.stamp_live_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.started_at is distinct from old.started_at then
    new.started_at := old.started_at;
  end if;
  return new;
end;
$$;
create trigger live_locations_stamp before insert or update on public.live_locations
  for each row execute function public.stamp_live_location();

-- Tidy up: whenever someone starts sharing, expired positions of others are removed.
create or replace function public.purge_expired_live_locations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.live_locations where sharing_until < now() - interval '10 minutes';
  return null;
end;
$$;
create trigger live_locations_purge after insert on public.live_locations
  for each statement execute function public.purge_expired_live_locations();
revoke execute on function public.purge_expired_live_locations() from public, anon, authenticated;

-- Real-time updates to everyone's map (Supabase Realtime respects the read policy above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_locations;
  end if;
end;
$$;
