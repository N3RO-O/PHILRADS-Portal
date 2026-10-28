-- Statistics: PHILRADS's record of projects and activities (2023 onwards): what was done, where,
-- for whom, with which donors and partners. Shown on the Statistics page and as a Live Map layer.
--
-- * program_activities: one row per activity at one site. Counts are kept as recorded (target and
--   served, households and individuals, men and women), never derived, so nothing is overstated.
-- * Read: anyone who can see the Live Map (map.read). Add and edit: projects.manage. No deletes;
--   is_active = false hides a row and keeps the history.
-- * The records themselves (names of partners and contact persons, funding) are loaded with a
--   one-off insert in the SQL editor, not in this file, so they stay out of the code repository.

create table public.program_activities (
  id uuid primary key default gen_random_uuid(),
  year smallint not null check (year between 2000 and 2100),
  start_date date,
  end_date date check (end_date is null or start_date is null or end_date >= start_date),
  -- The date as written in the source ("November 16 - December 23, 2025"), for display.
  date_label text not null check (length(trim(date_label)) > 0),
  program text not null check (program in ('emergency', 'rehabilitation', 'livelihood', 'training', 'special', 'monitoring')),
  -- The disaster or initiative it belongs to ("Severe Tropical Storm Uwan").
  response text,
  activity text not null check (length(trim(activity)) > 0),
  site text not null check (length(trim(site)) > 0),
  lat double precision check (lat between 4 and 22),
  lng double precision check (lng between 116 and 127.5),
  -- How exact the pin is: barangay, town (or city), province, or approximate.
  geo_precision text check (geo_precision in ('barangay', 'town', 'province', 'approximate')),
  households_target integer check (households_target >= 0),
  individuals_target integer check (individuals_target >= 0),
  households_served integer check (households_served >= 0),
  individuals_served integer check (individuals_served >= 0),
  male integer check (male >= 0),
  female integer check (female >= 0),
  served_note text,
  funding numeric(14, 2) check (funding >= 0),
  funding_note text,
  donors text,
  partner text,
  contact_person text,
  status text not null default 'completed' check (status in ('completed', 'ongoing', 'scheduled')),
  source text,
  notes text,
  project_id uuid references public.projects (id) on delete set null,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);

create index program_activities_year_idx on public.program_activities (is_active, year desc, start_date desc);

create trigger program_activities_set_updated_at before update on public.program_activities
  for each row execute function public.set_updated_at();

alter table public.program_activities enable row level security;

create policy program_activities_read on public.program_activities for select to authenticated
  using ((select public.has_permission('map.read')) or (select public.has_permission('projects.manage')));
create policy program_activities_insert on public.program_activities for insert to authenticated
  with check ((select public.has_permission('projects.manage')));
create policy program_activities_update on public.program_activities for update to authenticated
  using ((select public.has_permission('projects.manage'))) with check ((select public.has_permission('projects.manage')));

revoke delete on public.program_activities from authenticated;
revoke all on public.program_activities from anon;
-- Who added a record and when stay as they were.
revoke update on public.program_activities from authenticated;
grant update (year, start_date, end_date, date_label, program, response, activity, site, lat, lng, geo_precision, households_target, individuals_target,
  households_served, individuals_served, male, female, served_note, funding, funding_note, donors, partner, contact_person, status, source, notes, project_id, is_active)
  on public.program_activities to authenticated;
