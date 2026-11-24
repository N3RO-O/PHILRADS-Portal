-- Guest pages: what visitors see without an account (sign-in screen → Guest).
--
-- * guest.manage (administrators and coordinators) writes the guest content: PHILReads stories,
--   donation drives and merch, and reads what guests send.
-- * Guests (the anon role) read published stories, open drives and listed merch directly, and the
--   map and impact figures through guest_overview(): activity sites without partners, contacts,
--   funding or donors, and only public kinds of place (no warehouses or field hubs, no staff).
-- * Guests send feedback, merch order requests and volunteer interest through
--   submit_guest_message(): checked, rate limited per connection, and announced in the bell of
--   everyone with guest.manage (in-app only). Guests can't read anything they or others sent.
-- * Pictures go in the public guest-media bucket (only guest.manage can upload).

insert into public.permissions (key, description) values
  ('guest.manage', 'Edit the guest pages (stories, donation drives, merch) and read guest messages (TBC)')
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values
  ('admin', 'guest.manage'),
  ('coordinator', 'guest.manage')
on conflict do nothing;

-- ───────────────────────── PHILReads ─────────────────────────
create table public.guest_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 140),
  summary text check (summary is null or length(summary) <= 300),
  body text not null default '' check (length(body) <= 20000),
  kind text not null default 'story' check (kind in ('story', 'update', 'reflection')),
  place text check (place is null or length(place) <= 120),
  cover_url text check (cover_url is null or (cover_url ~ '^https://' and length(cover_url) <= 600)),
  author_name text check (author_name is null or length(author_name) <= 80),
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guest_stories_published_idx on public.guest_stories (is_published, published_at desc);

-- ───────────────────────── Donation drives ─────────────────────────
create table public.donation_drives (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  summary text check (summary is null or length(summary) <= 400),
  -- What a gift does ("₱500 feeds a family of five for three days").
  impact_note text check (impact_note is null or length(impact_note) <= 200),
  -- Money (PHP) or things ("family packs").
  unit text not null default 'PHP' check (length(trim(unit)) between 1 and 30),
  goal numeric(14, 2) not null check (goal > 0),
  raised numeric(14, 2) not null default 0 check (raised >= 0),
  donor_count integer check (donor_count is null or donor_count >= 0),
  starts_on date,
  ends_on date check (ends_on is null or starts_on is null or ends_on >= starts_on),
  -- Bank, GCash or drop-off details, as staff write them.
  how_to_give text check (how_to_give is null or length(how_to_give) <= 2000),
  cover_url text check (cover_url is null or (cover_url ~ '^https://' and length(cover_url) <= 600)),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  raised_updated_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index donation_drives_status_idx on public.donation_drives (status, ends_on);

-- ───────────────────────── Merch ─────────────────────────
create table public.merch_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  description text check (description is null or length(description) <= 600),
  price numeric(10, 2) check (price is null or price >= 0),
  sizes text[] not null default '{}' check (cardinality(sizes) <= 12),
  image_url text check (image_url is null or (image_url ~ '^https://' and length(image_url) <= 600)),
  in_stock boolean not null default true,
  is_listed boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Guest messages ─────────────────────────
create table public.guest_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('thanks', 'suggestion', 'need', 'concern', 'order', 'volunteer')),
  message text not null check (length(trim(message)) between 1 and 2000),
  rating smallint check (rating is null or rating between 1 and 5),
  community text check (community is null or length(community) <= 120),
  name text check (name is null or length(name) <= 80),
  contact text check (contact is null or length(contact) <= 120),
  merch_id uuid references public.merch_items (id) on delete set null,
  merch_size text check (merch_size is null or length(merch_size) <= 20),
  quantity smallint check (quantity is null or quantity between 1 and 99),
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  -- A one-way hash of the sender's connection, only for the rate limit.
  sender_hash text,
  created_at timestamptz not null default now()
);
create index guest_messages_status_idx on public.guest_messages (status, created_at desc);
create index guest_messages_sender_idx on public.guest_messages (sender_hash, created_at desc);

-- Timestamps.
create trigger guest_stories_set_updated_at before update on public.guest_stories for each row execute function public.set_updated_at();
create trigger donation_drives_set_updated_at before update on public.donation_drives for each row execute function public.set_updated_at();
create trigger merch_items_set_updated_at before update on public.merch_items for each row execute function public.set_updated_at();

-- A story gets its date when first published; drives note when the amount raised last changed.
create or replace function public.touch_guest_story()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_published and new.published_at is null then
    new.published_at := now();
  end if;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;
create trigger guest_stories_touch before insert or update on public.guest_stories for each row execute function public.touch_guest_story();

create or replace function public.touch_donation_drive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.raised is distinct from old.raised or new.donor_count is distinct from old.donor_count then
    new.raised_updated_at := now();
  end if;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;
create trigger donation_drives_touch before insert or update on public.donation_drives for each row execute function public.touch_donation_drive();

-- ───────────────────────── Who can do what ─────────────────────────
alter table public.guest_stories enable row level security;
alter table public.donation_drives enable row level security;
alter table public.merch_items enable row level security;
alter table public.guest_messages enable row level security;

create policy guest_stories_public on public.guest_stories for select to anon, authenticated using (is_published);
create policy guest_stories_manage on public.guest_stories for all to authenticated
  using ((select public.has_permission('guest.manage'))) with check ((select public.has_permission('guest.manage')));

create policy donation_drives_public on public.donation_drives for select to anon, authenticated using (status in ('open', 'closed'));
create policy donation_drives_manage on public.donation_drives for all to authenticated
  using ((select public.has_permission('guest.manage'))) with check ((select public.has_permission('guest.manage')));

create policy merch_items_public on public.merch_items for select to anon, authenticated using (is_listed);
create policy merch_items_manage on public.merch_items for all to authenticated
  using ((select public.has_permission('guest.manage'))) with check ((select public.has_permission('guest.manage')));

-- Messages: read and marked only by guest.manage; sent only through submit_guest_message().
create policy guest_messages_read on public.guest_messages for select to authenticated using ((select public.has_permission('guest.manage')));
create policy guest_messages_update on public.guest_messages for update to authenticated
  using ((select public.has_permission('guest.manage'))) with check ((select public.has_permission('guest.manage')));
create policy guest_messages_delete on public.guest_messages for delete to authenticated using ((select public.has_permission('guest.manage')));

grant select on public.guest_stories, public.donation_drives, public.merch_items to anon;
revoke insert, update, delete on public.guest_stories, public.donation_drives, public.merch_items, public.guest_messages from anon;
revoke all on public.guest_messages from anon;
revoke insert on public.guest_messages from authenticated;

-- ───────────────────────── The map and the figures ─────────────────────────
create or replace function public.guest_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'sites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'year', a.year, 'program', a.program, 'response', a.response, 'activity', a.activity,
        'site', a.site, 'lat', a.lat, 'lng', a.lng, 'dateLabel', a.date_label, 'startDate', a.start_date,
        'households', a.households_served, 'individuals', a.individuals_served, 'status', a.status
      ) order by a.start_date desc nulls last, a.year desc)
      from public.program_activities a
      where a.is_active and a.lat is not null and a.lng is not null
    ), '[]'::jsonb),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'lat', p.lat, 'lng', p.lng, 'address', p.address) order by p.name)
      from public.map_places p
      where p.is_active and p.kind in ('office', 'response_site', 'distribution_point', 'evacuation_center')
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'activities', count(*),
        'individuals', coalesce(sum(a.individuals_served), 0),
        'households', coalesce(sum(a.households_served), 0),
        'places', count(distinct lower(trim(a.site))),
        'since', min(a.year)
      )
      from public.program_activities a
      where a.is_active
    )
  );
$$;
revoke all on function public.guest_overview() from public;
grant execute on function public.guest_overview() to anon, authenticated;

-- ───────────────────────── Sending a message ─────────────────────────
create or replace function public.submit_guest_message(
  p_kind text,
  p_message text,
  p_rating smallint default null,
  p_community text default null,
  p_name text default null,
  p_contact text default null,
  p_merch_id uuid default null,
  p_merch_size text default null,
  p_quantity smallint default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  sender text := coalesce(headers ->> 'cf-connecting-ip', split_part(headers ->> 'x-forwarded-for', ',', 1), headers ->> 'x-real-ip', 'unknown');
  hash text := encode(extensions.digest('philrads-guest:' || trim(sender), 'sha256'), 'hex');
  msg text := trim(coalesce(p_message, ''));
  new_id uuid;
  item_name text;
  title text;
begin
  if p_kind not in ('thanks', 'suggestion', 'need', 'concern', 'order', 'volunteer') then
    raise exception 'Choose what your message is about.' using errcode = '22023';
  end if;
  if length(msg) < 2 then
    raise exception 'Write a message first.' using errcode = '22023';
  end if;
  if length(msg) > 2000 then
    raise exception 'Keep the message under 2,000 characters.' using errcode = '22023';
  end if;
  if p_kind in ('order', 'volunteer') and length(trim(coalesce(p_contact, ''))) < 5 then
    raise exception 'Add a phone number or email so we can reply.' using errcode = '22023';
  end if;
  if p_kind = 'order' then
    select m.name into item_name from public.merch_items m where m.id = p_merch_id and m.is_listed;
    if item_name is null then
      raise exception 'That item is no longer listed.' using errcode = '22023';
    end if;
  end if;
  -- At most 5 messages an hour from one connection, and 300 an hour in all.
  if (select count(*) from public.guest_messages g where g.sender_hash = hash and g.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.guest_messages g where g.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Too many messages for now. Please try again in an hour.' using errcode = '54000';
  end if;

  insert into public.guest_messages (kind, message, rating, community, name, contact, merch_id, merch_size, quantity, sender_hash)
  values (
    p_kind, msg,
    case when p_rating between 1 and 5 then p_rating end,
    nullif(left(trim(coalesce(p_community, '')), 120), ''),
    nullif(left(trim(coalesce(p_name, '')), 80), ''),
    nullif(left(trim(coalesce(p_contact, '')), 120), ''),
    case when p_kind = 'order' then p_merch_id end,
    case when p_kind = 'order' then nullif(left(trim(coalesce(p_merch_size, '')), 20), '') end,
    case when p_kind = 'order' then greatest(1, least(coalesce(p_quantity, 1), 99)) end,
    hash
  )
  returning id into new_id;

  title := case p_kind
    when 'order' then 'Merch order request: ' || item_name
    when 'volunteer' then 'Someone wants to volunteer'
    when 'concern' then 'A guest raised a concern'
    when 'need' then 'A guest shared a community need'
    when 'suggestion' then 'A guest sent a suggestion'
    else 'A guest sent thanks'
  end;
  insert into public.notifications (recipient_id, title, body, link_path)
  select distinct p.id, title, left(msg, 140), '/guest-admin?tab=inbox'
  from public.profiles p
  join public.role_permissions rp on rp.role_key = p.role_key
  where p.is_active and rp.permission_key = 'guest.manage';

  return new_id;
end;
$$;
revoke all on function public.submit_guest_message(text, text, smallint, text, text, text, uuid, text, smallint) from public;
grant execute on function public.submit_guest_message(text, text, smallint, text, text, text, uuid, text, smallint) to anon, authenticated;

-- ───────────────────────── Pictures ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-media', 'guest-media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists guest_media_insert on storage.objects;
drop policy if exists guest_media_update on storage.objects;
drop policy if exists guest_media_delete on storage.objects;
create policy guest_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'guest-media' and (select public.has_permission('guest.manage')));
create policy guest_media_update on storage.objects for update to authenticated
  using (bucket_id = 'guest-media' and (select public.has_permission('guest.manage')));
create policy guest_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'guest-media' and (select public.has_permission('guest.manage')));
