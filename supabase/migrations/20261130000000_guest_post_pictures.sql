-- Community posts can carry one picture.
--
-- * Pictures go in the public forum-media bucket. A signed-in person (guest or staff) can only add
--   files under their own folder (<their id>/...), and remove their own; nobody can overwrite.
-- * A post keeps the picture's path, not a web address, so a post can never point at a picture
--   somewhere else (no tracking pictures). forum_create_post checks the file is the poster's own
--   and really uploaded.
-- * Hidden and deleted posts already stay out of the feed; their picture goes with them.

alter table public.forum_posts
  add column if not exists image_path text
  check (image_path is null or image_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$');

-- ───────────────────────── The bucket ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-media', 'forum-media', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists forum_media_insert on storage.objects;
drop policy if exists forum_media_delete on storage.objects;
create policy forum_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'forum-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy forum_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'forum-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ───────────────────────── Reads, now with the picture ─────────────────────────
drop function if exists public.forum_feed(text, text, int, int);
create function public.forum_feed(p_topic text default null, p_sort text default 'hot', p_limit int default 25, p_offset int default 0)
returns table (
  id uuid, topic text, title text, body text, score int, comment_count int, pinned boolean, created_at timestamptz,
  author_id uuid, author_name text, author_avatar text, author_color text, author_staff boolean, voted boolean, mine boolean,
  image_path text
)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.topic, f.title, left(f.body, 700), f.score, f.comment_count, f.pinned, f.created_at,
         f.author_id, w.name, w.avatar, w.color, w.staff,
         exists (select 1 from public.forum_votes v where v.user_id = auth.uid() and v.kind = 'post' and v.item_id = f.id),
         f.author_id = auth.uid(),
         f.image_path
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

drop function if exists public.forum_post(uuid);
create function public.forum_post(p_id uuid)
returns table (
  id uuid, topic text, title text, body text, score int, comment_count int, pinned boolean, created_at timestamptz,
  author_id uuid, author_name text, author_avatar text, author_color text, author_staff boolean, voted boolean, mine boolean,
  hidden boolean, deleted boolean, image_path text
)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.topic, f.title, f.body, f.score, f.comment_count, f.pinned, f.created_at,
         f.author_id, w.name, w.avatar, w.color, w.staff,
         exists (select 1 from public.forum_votes v where v.user_id = auth.uid() and v.kind = 'post' and v.item_id = f.id),
         f.author_id = auth.uid(),
         f.hidden_at is not null, f.deleted_at is not null,
         case when f.deleted_at is null then f.image_path end
  from public.forum_posts f
  cross join lateral public.forum_who(f.author_id) w
  where f.id = p_id
    and ((f.deleted_at is null and f.hidden_at is null) or f.author_id = auth.uid() or public.forum_is_mod())
$$;

-- ───────────────────────── Posting, with an optional picture ─────────────────────────
drop function if exists public.forum_create_post(text, text, text);
create function public.forum_create_post(p_topic text, p_title text, p_body text, p_image text default null)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := public.forum_author();
  v_staff_only boolean;
  v_image text := nullif(btrim(coalesce(p_image, '')), '');
  v_id uuid;
begin
  select t.staff_only into v_staff_only from public.forum_topics t where t.key = p_topic;
  if not found then raise exception 'Choose a topic' using errcode = '22023'; end if;
  if v_staff_only and not public.forum_is_mod() then
    raise exception 'Only PHILRADS staff post in this topic' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_title, ''))) < 3 then raise exception 'Give your post a title' using errcode = '22023'; end if;
  if v_image is not null and (
    split_part(v_image, '/', 1) <> v_me::text
    or not exists (select 1 from storage.objects o where o.bucket_id = 'forum-media' and o.name = v_image)
  ) then
    raise exception 'That picture didn’t upload. Try adding it again.' using errcode = '22023';
  end if;
  if (select count(*) from public.forum_posts f where f.author_id = v_me and f.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You’ve posted a lot this hour. Try again a little later.' using errcode = '54000';
  end if;
  insert into public.forum_posts (topic, author_id, title, body, image_path)
  values (p_topic, v_me, btrim(p_title), btrim(coalesce(p_body, '')), v_image)
  returning forum_posts.id into v_id;
  return v_id;
end;
$$;

revoke all on function public.forum_feed(text, text, int, int), public.forum_post(uuid), public.forum_create_post(text, text, text, text) from public, anon, authenticated;
grant execute on function public.forum_feed(text, text, int, int), public.forum_post(uuid) to anon, authenticated;
grant execute on function public.forum_create_post(text, text, text, text) to authenticated;
