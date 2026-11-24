-- Guest announcements: PHILRADS's own posts at the top of Disaster News on the guest page
-- (an evacuation site opening, where relief is being handed out, an advisory for an area).
--
-- * guest.manage (administrators and coordinators) writes them in the portal (Guest page → News).
-- * Guests (anon) read published ones until their "hide after" time passes.
-- * The alerts under them still come from GDACS and USGS on their own.

create table public.guest_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 140),
  body text not null default '' check (length(body) <= 2000),
  -- update: news from PHILRADS; advisory: something to act on; urgent: act now.
  level text not null default 'update' check (level in ('update', 'advisory', 'urgent')),
  area text check (area is null or length(area) <= 120),
  link_url text check (link_url is null or (link_url ~ '^https://' and length(link_url) <= 600)),
  is_published boolean not null default false,
  published_at timestamptz,
  -- Taken off the guest page after this moment (null: stays until unpublished).
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guest_announcements_published_idx on public.guest_announcements (is_published, published_at desc);

create trigger guest_announcements_set_updated_at before update on public.guest_announcements for each row execute function public.set_updated_at();
-- Same rule as stories: dated when first published, and the author stays the author.
create trigger guest_announcements_touch before insert or update on public.guest_announcements for each row execute function public.touch_guest_story();

alter table public.guest_announcements enable row level security;
create policy guest_announcements_public on public.guest_announcements for select to anon, authenticated
  using (is_published and (expires_at is null or expires_at > now()));
create policy guest_announcements_manage on public.guest_announcements for all to authenticated
  using ((select public.has_permission('guest.manage'))) with check ((select public.has_permission('guest.manage')));

grant select on public.guest_announcements to anon;
revoke insert, update, delete on public.guest_announcements from anon;
