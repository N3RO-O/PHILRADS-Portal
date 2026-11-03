-- Staff Tasks, accepting tasks by role, nudges and phone notifications.
--
-- * Role ranks: admin 4, coordinator 3, staff 2, volunteer 1, viewer 0 (unknown roles 0).
-- * Anyone active from volunteer up can give a task to anyone. From a higher role it is assigned
--   straight away; from the same or a lower role it waits for the person to accept or decline.
--   A task waiting to be accepted can't be started, finished or edited by the person it's for.
-- * Giving a task notifies the person; accepting or declining notifies the giver.
-- * Nudges: the giver (or tasks.manage) can nudge the person about an open task, at most once an
--   hour per task.
-- * Staff Tasks board: every active person with open, in-progress, overdue and recently done counts,
--   and each person's tasks from others (their own personal tasks stay private, except to
--   tasks.read_all), readable by any active staff.
-- * Phone notifications: each device's Web Push subscription, and notifications.pushed_at so the
--   "push-notifications" Edge Function sends each one once.

create or replace function public.role_rank(p_role text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_role when 'admin' then 4 when 'coordinator' then 3 when 'staff' then 2 when 'volunteer' then 1 else 0 end
$$;
grant execute on function public.role_rank(text) to authenticated;

create or replace function public.rank_of(p_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select public.role_rank(role_key) from public.profiles where id = p_id), 0)
$$;
-- Only a number; the insert policy needs it.
revoke execute on function public.rank_of(uuid) from public, anon;
grant execute on function public.rank_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Accepting tasks
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column acceptance text not null default 'accepted' check (acceptance in ('pending', 'accepted', 'declined')),
  add column declined_reason text check (declined_reason is null or length(declined_reason) <= 280),
  add column responded_at timestamptz;

-- Giving tasks to others: anyone active from volunteer up (it may need accepting).
drop policy tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    (select public.is_active_staff())
    and created_by = (select auth.uid())
    and (assignee_id is null or assignee_id = (select auth.uid()) or (select public.rank_of(auth.uid())) >= 1)
  );

-- Pending or not is decided here, never by the client.
create or replace function public.set_task_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_giver uuid := coalesce((select auth.uid()), new.created_by);
begin
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    -- Only accept_task() changes these (it sets this flag).
    if coalesce(current_setting('philrads.responding', true), '') <> 'on' then
      new.acceptance := old.acceptance;
      new.declined_reason := old.declined_reason;
      new.responded_at := old.responded_at;
    end if;
    return new;
  end if;
  new.declined_reason := null;
  new.responded_at := null;
  if new.assignee_id is null or new.assignee_id = v_giver then
    new.acceptance := 'accepted';
  elsif public.rank_of(v_giver) > public.rank_of(new.assignee_id) then
    new.acceptance := 'accepted';
  else
    new.acceptance := 'pending';
  end if;
  return new;
end;
$$;
create trigger tasks_set_acceptance before insert or update on public.tasks
  for each row execute function public.set_task_acceptance();
revoke execute on function public.set_task_acceptance() from public, anon, authenticated;

-- The update guard, as before, plus: reassigning is for the giver or tasks.manage, and a task
-- waiting to be accepted can't be worked on by the person it's for.
create or replace function public.guard_task_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_manager boolean;
begin
  if v_me is null then
    return new; -- SQL editor / service role
  end if;
  v_manager := public.has_permission('tasks.manage');
  if new.created_by is distinct from old.created_by then
    raise exception 'The person who created a task can''t be changed.' using errcode = '42501';
  end if;
  if new.assignee_id is distinct from old.assignee_id
     and new.assignee_id is distinct from v_me
     and not v_manager and old.created_by is distinct from v_me then
    raise exception 'Only the person who gave this task, or a coordinator, can give it to someone else.' using errcode = '42501';
  end if;

  if old.acceptance = 'pending' and old.assignee_id = v_me and old.created_by is distinct from v_me
     and coalesce(current_setting('philrads.responding', true), '') <> 'on'
     and (new.status, new.subtasks, new.my_day) is distinct from (old.status, old.subtasks, old.my_day) then
    raise exception 'Accept this task first.' using errcode = '42501';
  end if;

  -- Finished: locked until it's re-opened (My Day can still be planned).
  if old.status = 'done' and new.status = 'done'
     and (new.title, new.description, new.priority, new.list, new.work_setting, new.due_date, new.due_time,
          new.subtasks, new.recurrence, new.location, new.assignee_id)
         is distinct from
         (old.title, old.description, old.priority, old.list, old.work_setting, old.due_date, old.due_time,
          old.subtasks, old.recurrence, old.location, old.assignee_id) then
    raise exception 'A finished task can''t be changed. Re-open it first.' using errcode = '42501';
  end if;

  -- Given to you by someone else: what the task is stays theirs to change.
  if old.created_by is distinct from v_me and not v_manager then
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      raise exception 'Only the person who gave you this task can remove it.' using errcode = '42501';
    end if;
    if (new.title, new.priority, new.list, new.work_setting, new.due_date, new.due_time, new.recurrence)
       is distinct from (old.title, old.priority, old.list, old.work_setting, old.due_date, old.due_time, old.recurrence) then
      raise exception 'Only the person who gave you this task can change its title, list, priority, due date or repeat.' using errcode = '42501';
    end if;
    if (select coalesce(jsonb_agg(jsonb_build_object('id', s ->> 'id', 'title', s ->> 'title') order by o), '[]'::jsonb)
          from jsonb_array_elements(new.subtasks) with ordinality as x(s, o))
       is distinct from
       (select coalesce(jsonb_agg(jsonb_build_object('id', s ->> 'id', 'title', s ->> 'title') order by o), '[]'::jsonb)
          from jsonb_array_elements(old.subtasks) with ordinality as x(s, o)) then
      raise exception 'Only the person who gave you this task can change its steps. You can tick them off.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_task_update() from public, anon, authenticated;

-- A task given to someone: tell them (and whether it needs accepting).
create or replace function public.notify_task_given()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_giver uuid := coalesce((select auth.uid()), new.created_by);
begin
  if new.assignee_id is null or new.assignee_id = v_giver then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;
  insert into public.notifications (recipient_id, title, body, link_path)
  values (
    new.assignee_id,
    case when new.acceptance = 'pending'
      then public.person_name(v_giver) || ' asks you to take on “' || left(new.title, 120) || '”'
      else public.person_name(v_giver) || ' gave you “' || left(new.title, 120) || '”' end,
    case when new.acceptance = 'pending' then 'Accept or decline it in Tasks.'
      when new.due_date is not null then 'Due ' || to_char(new.due_date, 'Mon FMDD') else null end,
    '/tasks?task=' || new.id
  );
  return new;
end;
$$;
create trigger tasks_notify_given after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_task_given();
revoke execute on function public.notify_task_given() from public, anon, authenticated;

create or replace function public.accept_task(p_task uuid, p_accept boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  t public.tasks%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into t from public.tasks where id = p_task;
  if not found or t.assignee_id is distinct from v_me or not public.is_active_staff() then
    raise exception 'Only the person this task is for can accept or decline it.' using errcode = '42501';
  end if;
  if t.acceptance <> 'pending' then
    raise exception 'This task has already been answered.' using errcode = '22023';
  end if;
  if not p_accept and (v_reason is null or length(v_reason) > 280) then
    raise exception 'Say in a few words why you can''t take it (up to 280 characters).' using errcode = '22023';
  end if;

  perform set_config('philrads.responding', 'on', true);
  update public.tasks
     set acceptance = case when p_accept then 'accepted' else 'declined' end,
         declined_reason = case when p_accept then null else v_reason end,
         responded_at = now()
   where id = p_task;
  perform set_config('philrads.responding', '', true);

  insert into public.notifications (recipient_id, title, body, link_path)
  values (t.created_by,
    public.person_name(v_me) || case when p_accept then ' accepted “' else ' declined “' end || left(t.title, 120) || '”',
    v_reason, '/tasks?task=' || t.id);
  perform public.write_log('tasks', case when p_accept then 'task.accepted' else 'task.declined' end,
    public.person_name(v_me) || case when p_accept then ' accepted “' else ' declined “' end || t.title || '”'
      || case when p_accept then '' else ': ' || v_reason end,
    'task', t.id::text, jsonb_build_object('giver', t.created_by));
end;
$$;
revoke execute on function public.accept_task(uuid, boolean, text) from public, anon;
grant execute on function public.accept_task(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Nudges
-- ---------------------------------------------------------------------------
create table public.task_nudges (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  message text check (message is null or length(message) <= 200),
  created_at timestamptz not null default now()
);
create index task_nudges_task_idx on public.task_nudges (task_id, created_at desc);
alter table public.task_nudges enable row level security;
create policy task_nudges_read on public.task_nudges for select to authenticated
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()));
revoke insert, update, delete on public.task_nudges from authenticated;
revoke all on public.task_nudges from anon;

create or replace function public.nudge_task(p_task uuid, p_message text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  t public.tasks%rowtype;
  v_msg text := nullif(trim(coalesce(p_message, '')), '');
begin
  select * into t from public.tasks where id = p_task;
  if not found or not public.is_active_staff() or not (t.created_by = v_me or public.has_permission('tasks.manage')) then
    raise exception 'Only the person who gave this task, or a coordinator, can nudge.' using errcode = '42501';
  end if;
  if t.assignee_id is null or t.assignee_id = v_me then
    raise exception 'This task isn''t with someone else.' using errcode = '22023';
  end if;
  if t.status in ('done', 'cancelled') then
    raise exception 'This task is already closed.' using errcode = '22023';
  end if;
  if v_msg is not null and length(v_msg) > 200 then
    raise exception 'Keep the nudge short (up to 200 characters).' using errcode = '22023';
  end if;
  if exists (select 1 from public.task_nudges where task_id = p_task and created_at > now() - interval '1 hour') then
    raise exception 'They were nudged about this in the last hour. Give them a little time.' using errcode = '22023';
  end if;
  insert into public.task_nudges (task_id, from_id, to_id, message) values (p_task, v_me, t.assignee_id, v_msg);
  insert into public.notifications (recipient_id, title, body, link_path)
  values (t.assignee_id, public.person_name(v_me) || ' nudged you about “' || left(t.title, 120) || '”',
    coalesce(v_msg, case when t.due_date is not null then 'Due ' || to_char(t.due_date, 'Mon FMDD') else 'A gentle reminder.' end),
    '/tasks?task=' || t.id);
end;
$$;
revoke execute on function public.nudge_task(uuid, text) from public, anon;
grant execute on function public.nudge_task(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Staff Tasks board
-- ---------------------------------------------------------------------------
create or replace function public.staff_task_board()
returns table (profile_id uuid, name text, role_name text, open_count int, in_progress int, overdue int, pending int, done_week int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(nullif(p.display_name, ''), p.full_name, 'Staff member'), r.name,
    count(t.id) filter (where t.status in ('todo', 'review') and t.acceptance <> 'declined')::int,
    count(t.id) filter (where t.status = 'in_progress')::int,
    count(t.id) filter (where t.status not in ('done', 'cancelled') and t.acceptance <> 'declined'
                          and t.due_date < (now() at time zone 'Asia/Manila')::date)::int,
    count(t.id) filter (where t.acceptance = 'pending' and t.status not in ('done', 'cancelled'))::int,
    count(t.id) filter (where t.status = 'done' and t.completed_at > now() - interval '7 days')::int
  from public.profiles p
  left join public.roles r on r.key = p.role_key
  left join public.tasks t on t.assignee_id = p.id and t.status <> 'cancelled'
  where p.is_active and public.is_active_staff()
  group by p.id, p.display_name, p.full_name, r.name
  order by 2
$$;
revoke execute on function public.staff_task_board() from public, anon;
grant execute on function public.staff_task_board() to authenticated;

-- One person's tasks: those given by others; their own personal tasks only for themselves or tasks.read_all.
create or replace function public.staff_tasks_of(p_person uuid)
returns table (id uuid, title text, status text, priority text, due_date date, acceptance text, given_by text, given_by_id uuid, completed_at timestamptz, nudged_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, t.status, t.priority, t.due_date, t.acceptance,
    case when t.created_by = t.assignee_id then null else public.person_name(t.created_by) end, t.created_by, t.completed_at,
    (select max(n.created_at) from public.task_nudges n where n.task_id = t.id)
  from public.tasks t
  where public.is_active_staff()
    and t.assignee_id = p_person
    and t.status <> 'cancelled'
    and (t.status <> 'done' or t.completed_at > now() - interval '14 days')
    and (t.created_by is distinct from t.assignee_id or p_person = (select auth.uid()) or public.has_permission('tasks.read_all'))
  order by (t.status = 'done'), t.due_date nulls last, t.created_at desc
  limit 100
$$;
revoke execute on function public.staff_tasks_of(uuid) from public, anon;
grant execute on function public.staff_tasks_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Phone notifications (Web Push)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  device text check (device is null or length(device) <= 120),
  created_at timestamptz not null default now()
);
create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()) and (select public.is_active_staff()));
revoke all on public.push_subscriptions from anon;

alter table public.notifications add column pushed_at timestamptz;
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

-- New notifications arrive in the portal straight away (the bell and the pop-up).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
