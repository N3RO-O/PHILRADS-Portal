-- =============================================================================
-- PHILRADS Staff Portal: Live Map
--
-- * map_places: warehouses, hubs, response sites, distribution points, evacuation
--   centers and offices, pinned on the map. A place can be linked to a PHILRADS IMS
--   storage location (ims_location: the location name as the IMS writes it), so the
--   map shows its live stock, and/or to an IMS relief event (ims_event_id), so it shows
--   people served. Managed by map.manage; seen by map.read. Never deleted: removing
--   a place sets is_active = false, so its history stays.
-- * field_checkins: a staff member taps "Check in here" to share where they are now
--   (their phone's GPS), so coordinators can see the team in the field. Only on
--   purpose, never tracked in the background; visible for 24 hours; the person can
--   remove their own check-in at any time.
-- =============================================================================

insert into public.permissions (key, description) values
  ('map.read',    'See the Live Map: places and today’s team check-ins (TBC)'),
  ('map.manage',  'Add, move and edit places on the Live Map (TBC)'),
  ('map.checkin', 'Check in on the Live Map so the team can see where you are (TBC)')
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values
  ('admin', 'map.read'), ('admin', 'map.manage'), ('admin', 'map.checkin'),
  ('coordinator', 'map.read'), ('coordinator', 'map.manage'), ('coordinator', 'map.checkin'),
  ('staff', 'map.read'), ('staff', 'map.checkin'),
  ('volunteer', 'map.read'), ('volunteer', 'map.checkin'),
  ('viewer', 'map.read')
on conflict do nothing;

create table public.map_places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  kind text not null check (kind in ('warehouse', 'hub', 'response_site', 'distribution_point', 'evacuation_center', 'office')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  address text check (address is null or length(address) <= 300),
  notes text check (notes is null or length(notes) <= 500),
  ims_location text check (ims_location is null or length(ims_location) <= 100),
  ims_event_id text check (ims_event_id is null or length(ims_event_id) <= 40),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index map_places_active_idx on public.map_places (is_active, kind);
create trigger map_places_set_updated_at before update on public.map_places
  for each row execute function public.set_updated_at();

alter table public.map_places enable row level security;
create policy map_places_read on public.map_places for select to authenticated
  using ((select public.has_permission('map.read')));
create policy map_places_insert on public.map_places for insert to authenticated
  with check ((select public.has_permission('map.manage')) and created_by = (select auth.uid()));
create policy map_places_update on public.map_places for update to authenticated
  using ((select public.has_permission('map.manage'))) with check ((select public.has_permission('map.manage')));
revoke delete on public.map_places from authenticated;
revoke all on public.map_places from anon;
-- Who added a place can't be rewritten.
revoke update on public.map_places from authenticated;
grant update (name, kind, lat, lng, address, notes, ims_location, ims_event_id, is_active) on public.map_places to authenticated;

create or replace function public.log_map_place_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_logs (actor_id, module, action, entity_type, entity_id, summary, metadata)
  values (
    auth.uid(),
    'live-map',
    case when tg_op = 'INSERT' then 'place.added'
         when old.is_active and not new.is_active then 'place.removed'
         else 'place.updated' end,
    'map_place',
    new.id::text,
    case when tg_op = 'INSERT' then 'Added '
         when old.is_active and not new.is_active then 'Removed '
         else 'Updated ' end || new.name || ' on the Live Map',
    jsonb_build_object('kind', new.kind)
  );
  return new;
end;
$$;
create trigger map_places_audit after insert or update on public.map_places
  for each row execute function public.log_map_place_change();
revoke execute on function public.log_map_place_change() from public, anon, authenticated;

create table public.field_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real check (accuracy_m is null or accuracy_m between 0 and 100000),
  note text check (note is null or length(note) <= 200),
  place_id uuid references public.map_places (id) on delete set null,
  created_at timestamptz not null default now()
);
create index field_checkins_recent_idx on public.field_checkins (created_at desc);
create index field_checkins_person_idx on public.field_checkins (profile_id, created_at desc);
comment on table public.field_checkins is 'Shared on purpose ("Check in here"), never tracked in the background. Visible to map.read for 24 hours.';

alter table public.field_checkins enable row level security;
create policy field_checkins_read on public.field_checkins for select to authenticated
  using ((select public.has_permission('map.read')) and created_at > now() - interval '24 hours');
create policy field_checkins_insert on public.field_checkins for insert to authenticated
  with check ((select public.has_permission('map.checkin')) and profile_id = (select auth.uid()));
create policy field_checkins_delete_own on public.field_checkins for delete to authenticated
  using (profile_id = (select auth.uid()));
revoke update on public.field_checkins from authenticated;
revoke all on public.field_checkins from anon;
