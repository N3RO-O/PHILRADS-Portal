-- =============================================================================
-- PHILRADS Staff Portal: Tasks module (Any.do style) with levels, badges and kudos
--
-- * Tasks gain humanitarian lists, a field/office setting, a due time, My Day,
--   subtasks, repeat and a place. Everyone active (field or office, volunteers
--   too) can add their own tasks; assigning one to someone else needs tasks.manage.
-- * XP is awarded here, by trigger, when a task is marked done (never by the
--   browser): low 10 / medium 20 / high 35, +10 when done on or before the due
--   date, +2 per finished subtask (up to +10). Tasks people set for themselves
--   earn at most 60 XP a day; tasks someone else gave them have no cap.
--   Re-opening a task takes its XP back, so ticking on and off earns nothing.
-- * Kudos: coordinators and admins (tasks.manage) thank someone: +15 XP and a
--   bell notification (portal only, nothing is emailed). One per person per day.
-- * Team goal: one shared monthly count of finished tasks. Progress is private
--   to each person (and admins); there is no ranking of people.
-- Mirrors src/lib/taskProgress.ts (sample mode); change both together.
-- =============================================================================

alter table public.tasks
  add column list text not null default 'office'
    check (list in ('relief', 'assessment', 'logistics', 'beneficiaries', 'reports', 'volunteers', 'coordination', 'office')),
  add column work_setting text not null default 'office' check (work_setting in ('field', 'office')),
  add column due_time time,
  add column my_day date,
  add column subtasks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(subtasks) = 'array' and jsonb_array_length(subtasks) <= 50),
  add column recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  add column location text check (location is null or length(location) <= 200);
alter table public.tasks add constraint tasks_title_length check (length(title) <= 200);
alter table public.tasks add constraint tasks_description_length check (description is null or length(description) <= 4000);
create index tasks_my_day_idx on public.tasks (assignee_id, my_day) where my_day is not null;
create index tasks_completed_idx on public.tasks (completed_at) where status = 'done';

comment on column public.tasks.list is 'Humanitarian task list: relief, assessment, logistics, beneficiaries, reports, volunteers, coordination, office.';
comment on column public.tasks.my_day is 'The day the assignee planned this task for (Any.do "My Day").';
comment on column public.tasks.subtasks is 'Checklist: [{ "id": text, "title": text, "done": boolean }].';

-- completed_at follows status; the browser can't backdate it.
create or replace function public.set_task_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    new.completed_at := case when tg_op = 'UPDATE' and old.status = 'done' then old.completed_at else now() end;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger tasks_set_completed_at before insert or update on public.tasks
  for each row execute function public.set_task_completed_at();

-- Anyone can add their own tasks; only tasks.manage can give one to someone else.
drop policy tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    (select public.is_active_staff())
    and created_by = (select auth.uid())
    and (assignee_id is null or assignee_id = (select auth.uid()) or (select public.has_permission('tasks.manage')))
  );

-- Who made a task can't be rewritten, and reassigning to someone else needs tasks.manage.
create or replace function public.guard_task_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new; -- SQL editor / service role
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'The person who created a task can''t be changed.' using errcode = '42501';
  end if;
  if new.assignee_id is distinct from old.assignee_id
     and new.assignee_id is distinct from (select auth.uid())
     and not public.has_permission('tasks.manage') then
    raise exception 'Only coordinators and admins can give a task to someone else.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tasks_guard_update before update on public.tasks
  for each row execute function public.guard_task_update();

-- ---------------------------------------------------------------------------
-- XP
-- ---------------------------------------------------------------------------
create table public.task_xp_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points int not null check (points between 0 and 100),
  base int not null,
  on_time int not null default 0,
  subtasks int not null default 0,
  -- The task was set by the person who did it (counts toward the daily cap).
  self_set boolean not null,
  capped boolean not null default false,
  day date not null,
  created_at timestamptz not null default now()
);
create index task_xp_events_user_idx on public.task_xp_events (user_id, created_at desc);
comment on table public.task_xp_events is 'XP earned per finished task. Written only by the award_task_xp trigger.';

create or replace function public.award_task_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
-- Variables are v_-prefixed so they never clash with task_xp_events columns.
declare
  v_earner uuid := coalesce(new.assignee_id, new.created_by);
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_cap constant int := 60;
  v_base int;
  v_on_time int := 0;
  v_sub int := 0;
  v_total int;
  v_self boolean;
  v_used int;
  v_capped boolean := false;
begin
  -- Re-opened: take the XP back.
  if tg_op = 'UPDATE' and old.status = 'done' and new.status <> 'done' then
    delete from public.task_xp_events e where e.task_id = new.id;
    return new;
  end if;
  if new.status <> 'done' or (tg_op = 'UPDATE' and old.status = 'done') or v_earner is null then
    return new;
  end if;

  v_base := case new.priority when 'high' then 35 when 'medium' then 20 else 10 end;
  if new.due_date is not null and v_today <= new.due_date then
    v_on_time := 10;
  end if;
  select least(10, 2 * count(*)) into v_sub
  from jsonb_array_elements(new.subtasks) s
  where (s ->> 'done')::boolean;
  v_total := v_base + v_on_time + v_sub;

  v_self := new.created_by is not distinct from v_earner;
  if v_self then
    select coalesce(sum(e.points), 0) into v_used
    from public.task_xp_events e
    where e.user_id = v_earner and e.day = v_today and e.self_set;
    if v_total > greatest(0, v_cap - v_used) then
      v_total := greatest(0, v_cap - v_used);
      v_capped := true;
    end if;
  end if;

  insert into public.task_xp_events (task_id, user_id, points, base, on_time, subtasks, self_set, capped, day)
  values (new.id, v_earner, v_total, v_base, v_on_time, v_sub, v_self, v_capped, v_today)
  on conflict (task_id) do nothing;
  return new;
end;
$$;
create trigger tasks_award_xp after insert or update of status on public.tasks
  for each row execute function public.award_task_xp();

alter table public.task_xp_events enable row level security;
create policy task_xp_read on public.task_xp_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_permission('staff.manage')));
revoke insert, update, delete on public.task_xp_events from authenticated;
revoke all on public.task_xp_events from anon;

-- ---------------------------------------------------------------------------
-- Kudos
-- ---------------------------------------------------------------------------
create table public.task_kudos (
  id uuid primary key default gen_random_uuid(),
  to_user uuid not null references public.profiles (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  message text not null check (length(trim(message)) between 1 and 280),
  points int not null default 15 check (points = 15),
  day date not null default ((now() at time zone 'Asia/Manila')::date),
  created_at timestamptz not null default now(),
  check (to_user <> from_user),
  unique (from_user, to_user, day)
);
create index task_kudos_to_idx on public.task_kudos (to_user, created_at desc);

alter table public.task_kudos enable row level security;
create policy task_kudos_read on public.task_kudos for select to authenticated
  using (to_user = (select auth.uid()) or from_user = (select auth.uid()) or (select public.has_permission('staff.manage')));
create policy task_kudos_insert on public.task_kudos for insert to authenticated
  with check ((select public.has_permission('tasks.manage')) and from_user = (select auth.uid()));
revoke update, delete on public.task_kudos from authenticated;
revoke all on public.task_kudos from anon;

-- The person thanked gets a bell notification (portal only).
create or replace function public.notify_task_kudos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, title, body, link_path)
  select new.to_user,
         'Kudos from ' || coalesce(nullif(p.display_name, ''), 'a coordinator') || ' (+' || new.points || ' XP)',
         new.message,
         '/tasks?rewards=kudos'
  from public.profiles p
  where p.id = new.from_user;
  return new;
end;
$$;
create trigger task_kudos_notify after insert on public.task_kudos
  for each row execute function public.notify_task_kudos();

-- ---------------------------------------------------------------------------
-- Team goal: tasks finished by everyone this month (a count only, no names)
-- ---------------------------------------------------------------------------
create or replace function public.task_team_progress()
returns table (month date, done bigint, goal int)
language sql
stable
security definer
set search_path = ''
as $$
  select date_trunc('month', now() at time zone 'Asia/Manila')::date,
         (select count(*) from public.tasks t
          where t.status = 'done'
            and t.completed_at >= (date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')),
         coalesce((select (s.value ->> 'monthly')::int from public.app_settings s where s.key = 'tasks.team_goal'), 200)
  where (select public.is_active_staff());
$$;

create or replace function public.set_task_team_goal(p_goal int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('tasks.manage') then
    raise exception 'Only coordinators and admins can set the team goal.' using errcode = '42501';
  end if;
  if p_goal is null or p_goal < 1 or p_goal > 100000 then
    raise exception 'The team goal must be between 1 and 100,000 tasks.' using errcode = '22023';
  end if;
  insert into public.app_settings (key, value, description)
  values ('tasks.team_goal', jsonb_build_object('monthly', p_goal), 'Team goal: tasks finished per month (Tasks page)')
  on conflict (key) do update set value = excluded.value, updated_by = (select auth.uid());
end;
$$;

revoke execute on function public.task_team_progress() from public, anon;
revoke execute on function public.set_task_team_goal(int) from public, anon;
grant execute on function public.task_team_progress() to authenticated;
grant execute on function public.set_task_team_goal(int) to authenticated;
-- Trigger-only functions are not callable through the API.
revoke execute on function public.set_task_completed_at() from public, anon, authenticated;
revoke execute on function public.guard_task_update() from public, anon, authenticated;
revoke execute on function public.award_task_xp() from public, anon, authenticated;
revoke execute on function public.notify_task_kudos() from public, anon, authenticated;
