-- =============================================================================
-- PHILRADS Staff Portal: a team chat for each ongoing project
--
-- * Only the project's team (its lead and members) can read or post; enforced here by row level
--   security, not just hidden in the app. Someone taken off the team loses access at once.
-- * Posting only while the project is active (ongoing). Planned, on hold, completed or cancelled
--   projects keep their chat readable for the team, but nobody can post.
-- * A message is text (up to 2,000 characters), a GIF (a GIPHY link), or both, and can reply to
--   another message. People can delete their own messages (they show as deleted).
-- * project_chat_reads: where each person has read up to, for unread counts.
-- * New messages: the rest of the team gets one bell notification per chat at a time (no more
--   until they've read it, or 30 minutes have passed), and messages arrive live (Realtime).
-- =============================================================================

begin;

/** On the project's team: its lead or a member, and an active staff account. */
create or replace function public.on_project_team(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.is_active_staff()) and (
    exists (select 1 from public.project_members m where m.project_id = p_project and m.profile_id = (select auth.uid()))
    or exists (select 1 from public.projects p where p.id = p_project and p.lead_id = (select auth.uid()))
  );
$$;
revoke execute on function public.on_project_team(uuid) from public, anon;
grant execute on function public.on_project_team(uuid) to authenticated;

create table public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null default '' check (length(body) <= 2000),
  gif_url text check (gif_url is null or (length(gif_url) <= 500 and gif_url ~ '^https://(media[0-9]*|i)\.giphy\.com/')),
  reply_to uuid references public.project_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint project_messages_not_empty check (deleted_at is not null or length(trim(body)) > 0 or gif_url is not null)
);
create index project_messages_project_idx on public.project_messages (project_id, created_at desc);
comment on table public.project_messages is 'Team chat of a project. Only its team reads or posts (RLS); posting only while the project is active.';

alter table public.project_messages enable row level security;
create policy project_messages_read on public.project_messages for select to authenticated
  using ((select public.on_project_team(project_id)));
create policy project_messages_insert on public.project_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and deleted_at is null
    and (select public.on_project_team(project_id))
    and exists (select 1 from public.projects p where p.id = project_id and p.status = 'active')
  );
revoke update, delete on public.project_messages from authenticated;
revoke all on public.project_messages from anon;

-- Deleting your own message: it stays as "deleted" so replies still make sense.
create or replace function public.delete_project_message(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.project_messages
     set deleted_at = now(), body = '', gif_url = null
   where id = p_id and author_id = (select auth.uid()) and deleted_at is null;
  if not found then
    raise exception 'You can only delete your own messages.' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.delete_project_message(uuid) from public, anon;
grant execute on function public.delete_project_message(uuid) to authenticated;

-- ── Read up to ───────────────────────────────────────────────────────────────
create table public.project_chat_reads (
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  last_read_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);
alter table public.project_chat_reads enable row level security;
create policy project_chat_reads_own on public.project_chat_reads for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and (select public.on_project_team(project_id)));
revoke all on public.project_chat_reads from anon;

/** Marks the chat read (now), and clears its bell notifications. */
create or replace function public.mark_project_chat_read(p_project uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if not public.on_project_team(p_project) then
    raise exception 'Only the project team can read this chat.' using errcode = '42501';
  end if;
  insert into public.project_chat_reads (project_id, profile_id, last_read_at) values (p_project, v_me, now())
  on conflict (project_id, profile_id) do update set last_read_at = excluded.last_read_at;
  update public.notifications set read_at = now()
   where recipient_id = v_me and read_at is null and link_path = '/projects/' || p_project || '?chat=1';
end;
$$;
revoke execute on function public.mark_project_chat_read(uuid) from public, anon;
grant execute on function public.mark_project_chat_read(uuid) to authenticated;

/** Unread messages per project chat for the signed-in person (only chats they're on). */
create or replace function public.project_chat_unread()
returns table (project_id uuid, unread int)
language sql
stable
security definer
set search_path = ''
as $$
  select m.project_id, count(*)::int
    from public.project_messages m
    left join public.project_chat_reads r on r.project_id = m.project_id and r.profile_id = (select auth.uid())
   where public.on_project_team(m.project_id)
     and m.author_id <> (select auth.uid())
     and m.deleted_at is null
     and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
   group by m.project_id;
$$;
revoke execute on function public.project_chat_unread() from public, anon;
grant execute on function public.project_chat_unread() to authenticated;

-- ── Bell notifications ───────────────────────────────────────────────────────
create or replace function public.notify_project_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_link text := '/projects/' || new.project_id || '?chat=1';
  v_preview text := case when length(trim(new.body)) > 0 then left(new.body, 140) else 'Sent a GIF' end;
begin
  select p.name into v_project from public.projects p where p.id = new.project_id;
  insert into public.notifications (recipient_id, title, body, link_path)
  select t.id, public.person_name(new.author_id) || ' in ' || coalesce(v_project, 'a project') || ' chat', v_preview, v_link
    from (
      select m.profile_id as id from public.project_members m where m.project_id = new.project_id
      union
      select p.lead_id from public.projects p where p.id = new.project_id and p.lead_id is not null
    ) t
    join public.profiles pr on pr.id = t.id and pr.is_active
   where t.id <> new.author_id
     and not exists (
       select 1 from public.notifications n
        where n.recipient_id = t.id and n.link_path = v_link and n.read_at is null
          and n.created_at > now() - interval '30 minutes'
     );
  return new;
end;
$$;
create trigger project_messages_notify after insert on public.project_messages
  for each row execute function public.notify_project_message();

-- New messages arrive live (Realtime respects the read policy above).
alter publication supabase_realtime add table public.project_messages;

commit;
