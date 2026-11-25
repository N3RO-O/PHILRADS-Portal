-- The guest community: a forum on the guest page, in topics, where signed-in guests (and staff)
-- post, comment and upvote. PHILRADS's own stories, prayer points and fundraisers sit beside these
-- in the guest page's feed, but they live in their own tables.
--
-- Nobody reads or writes these tables directly: everything goes through the functions below, so
-- each rule lives in one place.
-- * Anyone (signed in or not) reads what isn't hidden or deleted.
-- * Posting, commenting, upvoting and reporting need an account (a guest signed in with Google, or
--   staff). Updates is for staff only.
-- * Posts show at once. Three reports from different people hide a post or comment until staff
--   look at it; staff with guest.manage hide, unhide, pin and close reports.
-- * A person may post 5 times and comment 30 times an hour.

create table public.forum_topics (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (length(name) between 1 and 40),
  description text not null default '' check (length(description) <= 200),
  staff_only boolean not null default false,
  sort_order int not null default 0
);

insert into public.forum_topics (key, name, description, staff_only, sort_order) values
  ('updates', 'Updates', 'News from the PHILRADS team.', true, 10),
  ('stories', 'Stories', 'What you saw, what you lived through, what helped.', false, 20),
  ('prayer', 'Prayer', 'Ask for prayer, or say how you are praying.', false, 30),
  ('needs', 'Needs and offers', 'A family that needs help, or help you can give.', false, 40),
  ('questions', 'Questions', 'Ask PHILRADS or the community.', false, 50),
  ('fundraising', 'Fundraising', 'Fundraisers, and ideas to raise more.', false, 60);

create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  topic text not null references public.forum_topics (key),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 140),
  body text not null default '' check (length(body) <= 5000),
  score int not null default 0,
  comment_count int not null default 0,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  hidden_at timestamptz,
  hidden_reason text
);
create index forum_posts_feed on public.forum_posts (created_at desc) where deleted_at is null and hidden_at is null;
create index forum_posts_author on public.forum_posts (author_id, created_at desc);

create table public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  parent_id uuid references public.forum_comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  score int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  hidden_at timestamptz,
  hidden_reason text
);
create index forum_comments_post on public.forum_comments (post_id, created_at);
create index forum_comments_author on public.forum_comments (author_id, created_at desc);

create table public.forum_votes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('post', 'comment')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);
create index forum_votes_item on public.forum_votes (kind, item_id);

create table public.forum_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('post', 'comment')),
  item_id uuid not null,
  reason text not null default '' check (length(reason) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  unique (reporter_id, kind, item_id)
);
create index forum_reports_open on public.forum_reports (kind, item_id) where resolved_at is null;

alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_votes enable row level security;
alter table public.forum_reports enable row level security;
-- No policies: the tables are reached only through the functions below.
revoke all on public.forum_topics, public.forum_posts, public.forum_comments, public.forum_votes, public.forum_reports from anon, authenticated;

-- Who may write: someone signed in with a profile (a guest, or staff who aren't switched off).
create or replace function public.forum_author()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid := auth.uid();
begin
  if v_id is null or not exists (
    select 1 from public.profiles p where p.id = v_id and p.archived_at is null and (p.role_key = 'guest' or p.is_active)
  ) then
    raise exception 'Sign in to take part' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

create or replace function public.forum_is_mod()
returns boolean language sql stable security definer set search_path = ''
as $$ select auth.uid() is not null and public.has_permission('guest.manage') $$;

-- How an author shows: their chosen name, a small picture (big ones fall back to initials), and
-- whether they are PHILRADS staff.
create or replace function public.forum_who(p_id uuid)
returns table (name text, avatar text, color text, staff boolean)
language sql stable security definer set search_path = ''
as $$
  select coalesce(nullif(btrim(p.display_name), ''), nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Guest'),
         case when length(p.avatar_data) <= 80000 then p.avatar_data end,
         p.avatar_color,
         p.role_key <> 'guest'
  from public.profiles p where p.id = p_id
$$;

create or replace function public.forum_topics_list()
returns table (key text, name text, description text, staff_only boolean)
language sql stable security definer set search_path = ''
as $$ select t.key, t.name, t.description, t.staff_only from public.forum_topics t order by t.sort_order, t.name $$;

-- The feed. hot: pinned first, then upvotes weighed against age; new: newest; top: most upvoted
-- this month.
create or replace function public.forum_feed(p_topic text default null, p_sort text default 'hot', p_limit int default 25, p_offset int default 0)
returns table (
  id uuid, topic text, title text, body text, score int, comment_count int, pinned boolean, created_at timestamptz,
  author_id uuid, author_name text, author_avatar text, author_color text, author_staff boolean, voted boolean, mine boolean
)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.topic, f.title, left(f.body, 700), f.score, f.comment_count, f.pinned, f.created_at,
         f.author_id, w.name, w.avatar, w.color, w.staff,
         exists (select 1 from public.forum_votes v where v.user_id = auth.uid() and v.kind = 'post' and v.item_id = f.id),
         f.author_id = auth.uid()
  from public.forum_posts f
  cross join lateral public.forum_who(f.author_id) w
  where f.deleted_at is null and f.hidden_at is null
    and (p_topic is null or f.topic = p_topic)
    and (p_sort <> 'top' or f.created_at > now() - interval '30 days')
  order by
    case when p_sort = 'hot' then f.pinned end desc nulls last,
    case when p_sort = 'hot' then (f.score + f.comment_count * 0.5 + 1) / power(extract(epoch from (now() - f.created_at)) / 3600 + 2, 1.5) end desc nulls last,
    case when p_sort = 'top' then f.score end desc nulls last,
    f.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

-- One post in full. Hidden or deleted: only its author and staff see it (flagged).
create or replace function public.forum_post(p_id uuid)
returns table (
  id uuid, topic text, title text, body text, score int, comment_count int, pinned boolean, created_at timestamptz,
  author_id uuid, author_name text, author_avatar text, author_color text, author_staff boolean, voted boolean, mine boolean,
  hidden boolean, deleted boolean
)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.topic, f.title, f.body, f.score, f.comment_count, f.pinned, f.created_at,
         f.author_id, w.name, w.avatar, w.color, w.staff,
         exists (select 1 from public.forum_votes v where v.user_id = auth.uid() and v.kind = 'post' and v.item_id = f.id),
         f.author_id = auth.uid(),
         f.hidden_at is not null, f.deleted_at is not null
  from public.forum_posts f
  cross join lateral public.forum_who(f.author_id) w
  where f.id = p_id
    and ((f.deleted_at is null and f.hidden_at is null) or f.author_id = auth.uid() or public.forum_is_mod())
$$;

-- A post's comments, oldest first (the page builds the threads). A hidden or deleted comment keeps
-- its place, so replies to it still make sense, but its words go (staff still see them).
create or replace function public.forum_comments_of(p_post uuid)
returns table (
  id uuid, parent_id uuid, body text, score int, created_at timestamptz,
  author_id uuid, author_name text, author_avatar text, author_color text, author_staff boolean, voted boolean, mine boolean,
  hidden boolean, deleted boolean
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.parent_id,
         case when (c.hidden_at is null or public.forum_is_mod()) and c.deleted_at is null then c.body end,
         c.score, c.created_at,
         -- Deleted: who wrote it goes too.
         case when c.deleted_at is null then c.author_id end,
         case when c.deleted_at is null then w.name end,
         case when c.deleted_at is null then w.avatar end,
         case when c.deleted_at is null then w.color end,
         coalesce(c.deleted_at is null and w.staff, false),
         exists (select 1 from public.forum_votes v where v.user_id = auth.uid() and v.kind = 'comment' and v.item_id = c.id),
         c.author_id = auth.uid(),
         c.hidden_at is not null, c.deleted_at is not null
  from public.forum_comments c
  cross join lateral public.forum_who(c.author_id) w
  where c.post_id = p_post
    and exists (select 1 from public.forum_posts f where f.id = p_post
                and ((f.deleted_at is null and f.hidden_at is null) or f.author_id = auth.uid() or public.forum_is_mod()))
  order by c.created_at
$$;

create or replace function public.forum_create_post(p_topic text, p_title text, p_body text)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := public.forum_author();
  v_staff_only boolean;
  v_id uuid;
begin
  select t.staff_only into v_staff_only from public.forum_topics t where t.key = p_topic;
  if not found then raise exception 'Choose a topic' using errcode = '22023'; end if;
  if v_staff_only and not public.forum_is_mod() then
    raise exception 'Only PHILRADS staff post in this topic' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_title, ''))) < 3 then raise exception 'Give your post a title' using errcode = '22023'; end if;
  if (select count(*) from public.forum_posts f where f.author_id = v_me and f.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You’ve posted a lot this hour. Try again a little later.' using errcode = '54000';
  end if;
  insert into public.forum_posts (topic, author_id, title, body)
  values (p_topic, v_me, btrim(p_title), btrim(coalesce(p_body, '')))
  returning forum_posts.id into v_id;
  return v_id;
end;
$$;

create or replace function public.forum_create_comment(p_post uuid, p_parent uuid, p_body text)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := public.forum_author();
  v_id uuid;
begin
  if not exists (select 1 from public.forum_posts f where f.id = p_post and f.deleted_at is null and f.hidden_at is null) then
    raise exception 'This post can’t take comments' using errcode = '22023';
  end if;
  if p_parent is not null and not exists (select 1 from public.forum_comments c where c.id = p_parent and c.post_id = p_post) then
    raise exception 'That comment isn’t on this post' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'Write a comment first' using errcode = '22023'; end if;
  if (select count(*) from public.forum_comments c where c.author_id = v_me and c.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You’ve commented a lot this hour. Try again a little later.' using errcode = '54000';
  end if;
  insert into public.forum_comments (post_id, parent_id, author_id, body)
  values (p_post, p_parent, v_me, btrim(p_body))
  returning forum_comments.id into v_id;
  update public.forum_posts f set comment_count = f.comment_count + 1 where f.id = p_post;
  return v_id;
end;
$$;

-- Upvote (p_on) or take it back. Returns the new count.
create or replace function public.forum_vote(p_kind text, p_id uuid, p_on boolean)
returns int language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := public.forum_author();
  v_score int;
begin
  if p_kind = 'post' then
    if not exists (select 1 from public.forum_posts f where f.id = p_id and f.deleted_at is null and f.hidden_at is null) then
      raise exception 'This post isn’t here any more' using errcode = '22023';
    end if;
  elsif p_kind = 'comment' then
    if not exists (select 1 from public.forum_comments c where c.id = p_id and c.deleted_at is null and c.hidden_at is null) then
      raise exception 'This comment isn’t here any more' using errcode = '22023';
    end if;
  else
    raise exception 'Unknown kind' using errcode = '22023';
  end if;
  if p_on then
    insert into public.forum_votes (user_id, kind, item_id) values (v_me, p_kind, p_id) on conflict do nothing;
  else
    delete from public.forum_votes v where v.user_id = v_me and v.kind = p_kind and v.item_id = p_id;
  end if;
  select count(*) into v_score from public.forum_votes v where v.kind = p_kind and v.item_id = p_id;
  if p_kind = 'post' then
    update public.forum_posts f set score = v_score where f.id = p_id;
  else
    update public.forum_comments c set score = v_score where c.id = p_id;
  end if;
  return v_score;
end;
$$;

-- Report a post or comment. Three people reporting it hides it until staff look.
create or replace function public.forum_report(p_kind text, p_id uuid, p_reason text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := public.forum_author();
  v_open int;
begin
  if p_kind not in ('post', 'comment') then raise exception 'Unknown kind' using errcode = '22023'; end if;
  if (p_kind = 'post' and not exists (select 1 from public.forum_posts f where f.id = p_id))
     or (p_kind = 'comment' and not exists (select 1 from public.forum_comments c where c.id = p_id)) then
    raise exception 'That isn’t here any more' using errcode = '22023';
  end if;
  insert into public.forum_reports (reporter_id, kind, item_id, reason)
  values (v_me, p_kind, p_id, left(btrim(coalesce(p_reason, '')), 300))
  on conflict (reporter_id, kind, item_id) do update set reason = excluded.reason, created_at = now(), resolved_at = null, resolved_by = null;
  select count(*) into v_open from public.forum_reports r where r.kind = p_kind and r.item_id = p_id and r.resolved_at is null;
  if v_open >= 3 then
    if p_kind = 'post' then
      update public.forum_posts f set hidden_at = now(), hidden_reason = 'Reported by 3 people' where f.id = p_id and f.hidden_at is null;
    else
      update public.forum_comments c set hidden_at = now(), hidden_reason = 'Reported by 3 people' where c.id = p_id and c.hidden_at is null;
    end if;
  end if;
end;
$$;

-- Delete your own post or comment.
create or replace function public.forum_delete(p_kind text, p_id uuid)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := public.forum_author();
  v_post uuid;
begin
  if p_kind = 'post' then
    update public.forum_posts f set deleted_at = now() where f.id = p_id and f.author_id = v_me and f.deleted_at is null;
  elsif p_kind = 'comment' then
    update public.forum_comments c set deleted_at = now() where c.id = p_id and c.author_id = v_me and c.deleted_at is null
    returning c.post_id into v_post;
    if v_post is not null then
      update public.forum_posts f set comment_count = greatest(f.comment_count - 1, 0) where f.id = v_post;
    end if;
  else
    raise exception 'Unknown kind' using errcode = '22023';
  end if;
  if not found and v_post is null then
    raise exception 'Only the person who wrote it can delete it' using errcode = '42501';
  end if;
end;
$$;

-- Staff: hide, unhide, pin, unpin, or close the reports on something (dismiss).
create or replace function public.forum_moderate(p_kind text, p_id uuid, p_action text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.forum_is_mod() then
    raise exception 'Only staff with the Guest page can do this' using errcode = '42501';
  end if;
  if p_kind not in ('post', 'comment') then raise exception 'Unknown kind' using errcode = '22023'; end if;
  if p_action = 'hide' then
    if p_kind = 'post' then update public.forum_posts f set hidden_at = now(), hidden_reason = 'Hidden by staff' where f.id = p_id;
    else update public.forum_comments c set hidden_at = now(), hidden_reason = 'Hidden by staff' where c.id = p_id; end if;
  elsif p_action = 'unhide' then
    if p_kind = 'post' then update public.forum_posts f set hidden_at = null, hidden_reason = null where f.id = p_id;
    else update public.forum_comments c set hidden_at = null, hidden_reason = null where c.id = p_id; end if;
  elsif p_action in ('pin', 'unpin') and p_kind = 'post' then
    update public.forum_posts f set pinned = (p_action = 'pin') where f.id = p_id;
  elsif p_action <> 'dismiss' then
    raise exception 'Unknown action' using errcode = '22023';
  end if;
  -- Any decision closes the open reports on it.
  if p_action in ('hide', 'unhide', 'dismiss') then
    update public.forum_reports r set resolved_at = now(), resolved_by = auth.uid()
    where r.kind = p_kind and r.item_id = p_id and r.resolved_at is null;
  end if;
end;
$$;

-- Staff: what needs a look (open reports), and what is hidden.
create or replace function public.forum_review()
returns table (
  kind text, id uuid, post_id uuid, title text, body text, created_at timestamptz,
  author_name text, author_staff boolean, open_reports int, reasons text[], hidden boolean, hidden_reason text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.forum_is_mod() then
    raise exception 'Only staff with the Guest page can do this' using errcode = '42501';
  end if;
  return query
    with items as (
      select 'post'::text as kind, f.id, f.id as post_id, f.title, f.body, f.created_at, f.author_id, f.hidden_at, f.hidden_reason
      from public.forum_posts f where f.deleted_at is null
      union all
      select 'comment', c.id, c.post_id, (select f.title from public.forum_posts f where f.id = c.post_id), c.body, c.created_at, c.author_id, c.hidden_at, c.hidden_reason
      from public.forum_comments c where c.deleted_at is null
    ), open as (
      select r.kind, r.item_id, count(*)::int as n, array_agg(r.reason order by r.created_at desc) filter (where r.reason <> '') as reasons
      from public.forum_reports r where r.resolved_at is null group by r.kind, r.item_id
    )
    select i.kind, i.id, i.post_id, i.title, left(i.body, 500), i.created_at, w.name, w.staff,
           coalesce(o.n, 0), coalesce(o.reasons, '{}'), i.hidden_at is not null, i.hidden_reason
    from items i
    left join open o on o.kind = i.kind and o.item_id = i.id
    cross join lateral public.forum_who(i.author_id) w
    where o.n is not null or i.hidden_at is not null
    order by coalesce(o.n, 0) desc, i.created_at desc
    limit 200;
end;
$$;

revoke execute on function public.forum_author(), public.forum_is_mod(), public.forum_who(uuid) from public, anon, authenticated;
revoke execute on function
  public.forum_topics_list(), public.forum_feed(text, text, int, int), public.forum_post(uuid), public.forum_comments_of(uuid),
  public.forum_create_post(text, text, text), public.forum_create_comment(uuid, uuid, text), public.forum_vote(text, uuid, boolean),
  public.forum_report(text, uuid, text), public.forum_delete(text, uuid), public.forum_moderate(text, uuid, text), public.forum_review()
  from public;
grant execute on function public.forum_topics_list(), public.forum_feed(text, text, int, int), public.forum_post(uuid), public.forum_comments_of(uuid)
  to anon, authenticated;
grant execute on function
  public.forum_create_post(text, text, text), public.forum_create_comment(uuid, uuid, text), public.forum_vote(text, uuid, boolean),
  public.forum_report(text, uuid, text), public.forum_delete(text, uuid), public.forum_moderate(text, uuid, text), public.forum_review()
  to authenticated;
