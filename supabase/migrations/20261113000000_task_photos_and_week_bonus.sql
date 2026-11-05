-- Tasks: "needs a photo", the photo bonus, and the working-week bonus.
--
-- * tasks.requires_photo: set by the person who gives the task (or a coordinator). Such a task can
--   only be finished once a photo has been sent with it (task_outputs). Only the giver or someone
--   with tasks.manage can switch it.
-- * A task that does not need a photo still earns +5 XP when one is sent anyway
--   (task_xp_events.photo).
-- * Finishing at least one task on every working day of a week (Monday to Friday, Manila time)
--   earns +25 XP once for that week (task_week_bonuses). Re-opening a task that breaks the week
--   takes the bonus back.

alter table public.tasks add column requires_photo boolean not null default false;
comment on column public.tasks.requires_photo is 'The task can only be finished with at least one photo sent (task_outputs.photos).';

alter table public.task_xp_events add column photo int not null default 0;

create table public.task_week_bonuses (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  points int not null check (points between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
comment on table public.task_week_bonuses is 'XP for finishing a task on every working day (Mon to Fri) of a week. Written only by award_task_xp.';
alter table public.task_week_bonuses enable row level security;
create policy task_week_bonuses_read on public.task_week_bonuses for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_permission('staff.manage')));
revoke insert, update, delete on public.task_week_bonuses from authenticated;
revoke all on public.task_week_bonuses from anon;

-- ---------------------------------------------------------------------------
-- Needs a photo: who may switch it, and no finishing without one
-- ---------------------------------------------------------------------------
create or replace function public.guard_task_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    return new; -- SQL editor / service role
  end if;
  if tg_op = 'UPDATE' and new.requires_photo is distinct from old.requires_photo
     and old.created_by is distinct from v_me and not public.has_permission('tasks.manage') then
    raise exception 'Only the person who gave you this task can change whether it needs a photo.' using errcode = '42501';
  end if;
  if new.requires_photo and new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done')
     and not exists (select 1 from public.task_outputs o where o.task_id = new.id and cardinality(o.photos) > 0) then
    raise exception 'This task needs a photo. Add one when you finish it.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_task_photo() from public, anon, authenticated;
create trigger tasks_guard_photo before insert or update of status, requires_photo on public.tasks
  for each row execute function public.guard_task_photo();

-- ---------------------------------------------------------------------------
-- The working week: has this person finished a task on every day Monday to Friday?
-- ---------------------------------------------------------------------------
create or replace function public.task_week_complete(p_user uuid, p_week date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct e.day) = 5
  from public.task_xp_events e
  where e.user_id = p_user
    and e.flag is null
    and e.day between p_week and p_week + 4;
$$;
revoke execute on function public.task_week_complete(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- XP: as before (20261028000000_task_fairness_and_audit.sql), plus the photo and week bonuses
-- ---------------------------------------------------------------------------
create or replace function public.award_task_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
-- Variables are v_-prefixed so they never clash with task_xp_events columns.
declare
  v_earner uuid := coalesce(new.assignee_id, new.created_by);
  v_actor uuid := coalesce((select auth.uid()), v_earner);
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_week date := date_trunc('week', (now() at time zone 'Asia/Manila'))::date;
  v_cap constant int := 60;
  v_week_points constant int := 25;
  v_base int;
  v_on_time int := 0;
  v_sub int := 0;
  v_photo int := 0;
  v_total int;
  v_self boolean;
  v_used int;
  v_capped boolean := false;
  v_flag text;
  v_old_points int;
  v_old_day date;
  v_secs int;
begin
  -- Re-opened: take the XP back (and the week's bonus, if the week is no longer complete).
  if tg_op = 'UPDATE' and old.status = 'done' and new.status <> 'done' then
    delete from public.task_xp_events e where e.task_id = new.id returning e.points, e.day into v_old_points, v_old_day;
    if v_old_day is not null then
      v_week := date_trunc('week', v_old_day)::date;
      if not public.task_week_complete(v_earner, v_week) then
        delete from public.task_week_bonuses b where b.user_id = v_earner and b.week_start = v_week;
      end if;
    end if;
    if coalesce(current_setting('philrads.sending_back', true), '') <> 'on' and new.status <> 'cancelled' then
      perform public.write_log('tasks', 'task.reopened',
        public.person_name(v_actor) || ' re-opened “' || new.title || '”' || case when coalesce(v_old_points, 0) > 0 then ' (−' || v_old_points || ' XP)' else '' end,
        'task', new.id::text, jsonb_build_object('points_removed', coalesce(v_old_points, 0)));
    end if;
    return new;
  end if;
  if new.status <> 'done' or (tg_op = 'UPDATE' and old.status = 'done') or v_earner is null then
    return new;
  end if;

  v_self := new.created_by is not distinct from v_earner;
  if v_self then
    -- Your own tasks: one flat amount; you set the priority, due date and steps yourself.
    v_base := 10;
  else
    v_base := case new.priority when 'high' then 35 when 'medium' then 20 else 10 end;
    if new.due_date is not null and v_today <= new.due_date then
      v_on_time := 10;
    end if;
    select least(10, 2 * count(*)) into v_sub
    from jsonb_array_elements(new.subtasks) s
    where (s ->> 'done')::boolean;
  end if;
  -- A photo nobody asked for is a welcome extra.
  if not new.requires_photo and exists (select 1 from public.task_outputs o where o.task_id = new.id and cardinality(o.photos) > 0) then
    v_photo := 5;
  end if;
  v_total := v_base + v_on_time + v_sub + v_photo;

  if tg_op = 'INSERT' then
    v_total := 0;
    v_flag := 'added_done';
  elsif v_self then
    select coalesce(sum(e.points), 0) into v_used
    from public.task_xp_events e
    where e.user_id = v_earner and e.day = v_today and e.self_set;
    if v_total > greatest(0, v_cap - v_used) then
      v_total := greatest(0, v_cap - v_used);
      v_capped := true;
    end if;
  end if;

  insert into public.task_xp_events (task_id, user_id, points, base, on_time, subtasks, photo, self_set, capped, day, flag)
  values (new.id, v_earner, v_total, v_base, v_on_time, v_sub, v_photo, v_self, v_capped, v_today, v_flag)
  on conflict (task_id) do nothing;

  -- A task finished every working day this week: the week's bonus, once.
  if v_flag is null and extract(isodow from v_today) between 1 and 5 and public.task_week_complete(v_earner, v_week) then
    insert into public.task_week_bonuses (user_id, week_start, points) values (v_earner, v_week, v_week_points)
    on conflict (user_id, week_start) do nothing;
    if found then
      insert into public.notifications (recipient_id, title, body, link_path)
      values (v_earner, 'A full working week! +' || v_week_points || ' XP',
              'You finished a task every day from Monday to Friday.', '/tasks');
    end if;
  end if;

  -- The activity feed, and what admins should know.
  perform public.write_log('tasks', 'task.completed',
    public.person_name(v_actor) || ' finished “' || new.title || '”' || case when v_total > 0 then ' (+' || v_total || ' XP)' else '' end,
    'task', new.id::text,
    jsonb_build_object('points', v_total, 'self_set', v_self, 'earner', v_earner, 'photo', v_photo, 'given_by', case when v_self then null else new.created_by end));
  if v_flag = 'added_done' then
    perform public.write_log('tasks', 'task.added_done',
      public.person_name(v_actor) || ' added “' || new.title || '” already finished: no XP',
      'task', new.id::text, jsonb_build_object('earner', v_earner), 'admins');
  elsif v_self then
    v_secs := extract(epoch from (now() - new.created_at))::int;
    if v_secs < 120 then
      perform public.write_log('tasks', 'task.quick_tick',
        public.person_name(v_earner) || ' ticked off their own task “' || new.title || '” ' || v_secs || ' s after adding it',
        'task', new.id::text, jsonb_build_object('seconds', v_secs, 'points', v_total), 'admins', v_earner);
    end if;
    if v_capped then
      perform public.write_log('tasks', 'task.xp_capped',
        public.person_name(v_earner) || ' reached today’s ' || v_cap || ' XP limit for their own tasks',
        'task', new.id::text, jsonb_build_object('points', v_total), 'admins', v_earner);
    end if;
  end if;

  -- The person who gave the task can check it, and send it back if it isn't done.
  if not v_self and new.created_by is not null and new.created_by is distinct from v_actor then
    insert into public.notifications (recipient_id, title, body, link_path)
    values (new.created_by,
            public.person_name(v_earner) || ' finished “' || left(new.title, 120) || '”',
            'Check it. If it isn’t done, open the task and send it back.',
            '/tasks?task=' || new.id);
  end if;
  return new;
end;
$$;
revoke execute on function public.award_task_xp() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: the XP colleagues see includes the week bonuses (as 20261104000000_profile_privacy.sql, plus that)
-- ---------------------------------------------------------------------------
create or replace function public.profile_task_stats(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_out jsonb;
begin
  if not (p_id = (select auth.uid()) or public.is_active_staff()) then
    raise exception 'Only active staff can see profiles' using errcode = '42501';
  end if;
  if p_id <> (select auth.uid()) and not public.has_permission('staff.manage')
     and not coalesce((select profile_public from public.profiles where id = p_id), true) then
    return null;
  end if;

  with a as (
    -- Tasks added already finished don't count toward badges or streaks (same as the Tasks page).
    select e.points, e.on_time, e.self_set, e.day, t.list, t.work_setting, t.priority, t.completed_at, t.created_at as task_created_at, t.my_day
    from public.task_xp_events e
    join public.tasks t on t.id = e.task_id
    where e.user_id = p_id and e.flag is null
  ),
  days as (select distinct day from a),
  islands as (
    select count(*)::int as len, max(day) as last_day
    from (select day, day - (row_number() over (order by day))::int as grp from days) r
    group by grp
  ),
  k as (select count(*)::int as n, coalesce(sum(points), 0)::int as pts from public.task_kudos where to_user = p_id),
  w as (select count(*)::int as n, coalesce(sum(points), 0)::int as pts from public.task_week_bonuses where user_id = p_id)
  select jsonb_build_object(
    'xp', coalesce((select sum(points) from a), 0)::int + (select pts from k) + (select pts from w),
    'full_weeks', (select n from w),
    'total', (select count(*) from a),
    'field', (select count(*) from a where work_setting = 'field'),
    'office', (select count(*) from a where work_setting = 'office'),
    'by_list', jsonb_build_object(
      'relief', (select count(*) from a where list = 'relief'),
      'assessment', (select count(*) from a where list = 'assessment'),
      'logistics', (select count(*) from a where list = 'logistics'),
      'beneficiaries', (select count(*) from a where list = 'beneficiaries'),
      'reports', (select count(*) from a where list = 'reports'),
      'volunteers', (select count(*) from a where list = 'volunteers'),
      'coordination', (select count(*) from a where list = 'coordination'),
      'office', (select count(*) from a where list = 'office')),
    'on_time', (select count(*) from a where on_time > 0),
    'rapid_high', (select count(*) from a where priority = 'high' and completed_at - task_created_at <= interval '1 day'),
    'from_others', (select count(*) from a where not self_set),
    'planned', (select count(*) from a where my_day is not null and (completed_at at time zone 'Asia/Manila')::date = my_day),
    'streak', coalesce((select len from islands where last_day >= v_today - 1 order by last_day desc limit 1), 0),
    'best_streak', coalesce((select max(len) from islands), 0),
    'kudos', (select n from k)
  ) into v_out;
  return v_out;
end;
$$;
revoke execute on function public.profile_task_stats(uuid) from public, anon;
grant execute on function public.profile_task_stats(uuid) to authenticated;
