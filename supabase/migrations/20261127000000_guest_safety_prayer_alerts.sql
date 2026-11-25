-- More for guests: emergency hotlines, prayer points, what a finished drive achieved, and phone
-- alerts for urgent announcements and typhoons near the regions a guest chooses.
--
-- * guest.manage (administrators and coordinators) edits hotlines, prayer points and drive reports
--   in the portal (Guest page).
-- * Guests (anon) read what is listed or published, add an "I prayed" through guest_pray(), and
--   turn alerts on or off through guest_push_subscribe() / guest_push_unsubscribe(). They never
--   read anyone's subscription.
-- * The guest-alerts Edge Function sends the alerts (run every 15 minutes by pg_cron, and right
--   after staff publish an urgent announcement). Every alert is claimed before it is sent, so
--   running it twice never sends one twice.

-- ───────────────────────── Hotlines ─────────────────────────
create table public.guest_hotlines (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  -- As dialled: digits, spaces, +, -, ( ) and "to" ranges are written in the note.
  number text not null check (number ~ '^[0-9+() -]{3,30}$'),
  note text check (note is null or length(note) <= 160),
  -- Null: nationwide. Otherwise the province, city or region it serves.
  area text check (area is null or length(trim(area)) between 1 and 80),
  sort_order integer not null default 0,
  is_listed boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger guest_hotlines_set_updated_at before update on public.guest_hotlines for each row execute function public.set_updated_at();
alter table public.guest_hotlines enable row level security;
create policy guest_hotlines_public on public.guest_hotlines for select to anon, authenticated using (is_listed);
create policy guest_hotlines_manage on public.guest_hotlines for all to authenticated
  using ((select public.has_permission('guest.manage'))) with check ((select public.has_permission('guest.manage')));
grant select on public.guest_hotlines to anon;
revoke insert, update, delete on public.guest_hotlines from anon;

-- Nationwide numbers that official pages agree on. Staff add provincial and city DRRM offices.
insert into public.guest_hotlines (name, number, note, area, sort_order, created_by) values
  ('National emergency hotline', '911', 'Police, fire and medical emergencies, any network, free', null, 0, null),
  ('Philippine Red Cross', '143', 'Rescue, ambulance and blood, 24 hours', null, 1, null),
  ('Philippine Red Cross (landline)', '(02) 8790-2300', null, null, 2, null),
  ('NDRRMC Operations Center', '(02) 8911-5061', 'Lines 8911-5061 to 65', null, 3, null),
  ('PAGASA (weather)', '(02) 8284-0800', 'Typhoon and rainfall updates', null, 4, null),
  ('PHIVOLCS (earthquakes, volcanoes)', '(02) 8426-1468', 'Lines 8426-1468 to 79', null, 5, null);

-- ───────────────────────── Prayer points ─────────────────────────
create table public.guest_prayers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 140),
  body text not null default '' check (length(body) <= 1500),
  area text check (area is null or length(area) <= 120),
  is_published boolean not null default false,
  published_at timestamptz,
  prayed_count integer not null default 0 check (prayed_count >= 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guest_prayers_published_idx on public.guest_prayers (is_published, published_at desc);
create trigger guest_prayers_set_updated_at before update on public.guest_prayers for each row execute function public.set_updated_at();
create trigger guest_prayers_touch before insert or update on public.guest_prayers for each row execute function public.touch_guest_story();
alter table public.guest_prayers enable row level security;
create policy guest_prayers_public on public.guest_prayers for select to anon, authenticated using (is_published);
create policy guest_prayers_manage on public.guest_prayers for all to authenticated
  using ((select public.has_permission('guest.manage'))) with check ((select public.has_permission('guest.manage')));
grant select on public.guest_prayers to anon;
revoke insert, update, delete on public.guest_prayers from anon;

-- "I prayed": one more on a published prayer point. Returns the new count.
create or replace function public.guest_pray(p_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.guest_prayers set prayed_count = prayed_count + 1 where id = p_id and is_published returning prayed_count;
$$;
revoke all on function public.guest_pray(uuid) from public;
grant execute on function public.guest_pray(uuid) to anon, authenticated;

-- ───────────────────────── Where a drive's gifts went ─────────────────────────
alter table public.donation_drives
  add column report text check (report is null or length(report) <= 2000),
  add column report_photos text[] not null default '{}' check (cardinality(report_photos) <= 6),
  -- Families (or people) reached, as staff count them.
  add column report_reached integer check (report_reached is null or report_reached >= 0),
  add column reported_at timestamptz;

-- ───────────────────────── Guest alerts ─────────────────────────
-- The regions a guest can follow (the Philippines' 18 regions). Empty: the whole country.
create or replace function public.guest_alert_regions()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['NCR','CAR','R1','R2','R3','R4A','MIMAROPA','R5','R6','NIR','R7','R8','R9','R10','R11','R12','R13','BARMM'];
$$;

create table public.guest_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  regions text[] not null default '{}' check (regions <@ public.guest_alert_regions()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger guest_push_subscriptions_set_updated_at before update on public.guest_push_subscriptions for each row execute function public.set_updated_at();
alter table public.guest_push_subscriptions enable row level security;
-- No policies: guests reach it only through the two functions below; the Edge Function uses the service role.
revoke all on public.guest_push_subscriptions from anon, authenticated;

create or replace function public.guest_push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_regions text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then
    raise exception 'That device can''t receive alerts.' using errcode = '22023';
  end if;
  if not (coalesce(p_regions, '{}') <@ public.guest_alert_regions()) then
    raise exception 'Choose regions from the list.' using errcode = '22023';
  end if;
  insert into public.guest_push_subscriptions (endpoint, p256dh, auth, regions)
  values (p_endpoint, p_p256dh, p_auth, coalesce(p_regions, '{}'))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, regions = excluded.regions;
end;
$$;
create or replace function public.guest_push_unsubscribe(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.guest_push_subscriptions where endpoint = p_endpoint;
$$;
revoke all on function public.guest_push_subscribe(text, text, text, text[]) from public;
revoke all on function public.guest_push_unsubscribe(text) from public;
grant execute on function public.guest_push_subscribe(text, text, text, text[]) to anon, authenticated;
grant execute on function public.guest_push_unsubscribe(text) to anon, authenticated;

-- An urgent announcement is sent once: the Edge Function stamps it before sending.
alter table public.guest_announcements add column pushed_at timestamptz;

-- A typhoon is sent once per region it comes near ('*' for guests following the whole country).
create table public.guest_alerts_sent (
  hazard_id text not null,
  region text not null,
  sent_at timestamptz not null default now(),
  primary key (hazard_id, region)
);
alter table public.guest_alerts_sent enable row level security;
revoke all on public.guest_alerts_sent from anon, authenticated;

-- Every 15 minutes: send what is due (the function needs no sign-in; see its header).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule(
  'guest-alerts',
  '*/15 * * * *',
  $$select net.http_post(url := 'https://rlgqjsauzsrgjonlrapt.supabase.co/functions/v1/guest-alerts', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb)$$
);
