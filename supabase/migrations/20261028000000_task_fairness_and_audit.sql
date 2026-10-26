-- =============================================================================
-- PHILRADS Staff Portal: fair task rewards, and an admin log nobody can rewrite
--
-- Tasks (XP rules; mirrored in src/lib/taskProgress.ts, change both together):
-- * Your own tasks earn a flat 10 XP (no priority, on-time or subtask extras), at most
--   60 XP a day. The extras only come with tasks someone else gave you.
-- * On a task someone gave you, only they (or a coordinator/admin) can change its title,
--   list, place type, priority, due date, repeat or subtask list; you can tick subtasks,
--   add notes, plan it in My Day and finish it.
-- * A finished task can't be edited; re-open it first (which takes its XP back).
-- * A task added already finished earns nothing (only possible by going around the app).
-- * When someone finishes a task you gave them, you get a bell note and can send it back
--   with a reason: it re-opens, the XP is taken back, they get your reason.
--
-- Logs:
-- * activity_logs is written only by the database (triggers and checked functions),
--   never directly by a browser, and nothing can edit or delete it.
-- * Entries have an audience: 'everyone' (the activity feed) or 'admins' (quick ticks,
--   daily caps, kudos, sign-ins). Admins (audit.read) see everything on the Logs page.
-- =============================================================================

insert into public.permissions (key, description) values
  ('audit.read', 'See the full admin log: every change, sign-ins and task flags')
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values ('admin', 'audit.read')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- The log: append-only, written by the database only, with an audience
-- ---------------------------------------------------------------------------
alter table public.activity_logs
  add column audience text not null default 'everyone' check (audience in ('everyone', 'admins'));
create index activity_logs_module_idx on public.activity_logs (module, created_at desc);
comment on column public.activity_logs.audience is 'everyone: the activity feed (activity.read). admins: only the admin log (audit.read).';

drop policy if exists activity_read on public.activity_logs;
create policy activity_read on public.activity_logs for select to authenticated
  using (
    (audience = 'everyone' and (select public.has_permission('activity.read')))
    or (select public.has_permission('audit.read'))
  );
drop policy if exists activity_insert on public.activity_logs;
revoke insert, update, delete, truncate on public.activity_logs from authenticated, anon;

-- One line in the log (only callable from other database functions).
create or replace function public.write_log(
  p_module text, p_action text, p_summary text,
  p_entity_type text default null, p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb, p_audience text default 'everyone', p_actor uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_logs (actor_id, module, action, entity_type, entity_id, summary, metadata, audience)
  values (coalesce(p_actor, (select auth.uid())), p_module, p_action, p_entity_type, p_entity_id, left(p_summary, 300), coalesce(p_metadata, '{}'::jsonb), p_audience);
$$;
revoke execute on function public.write_log(text, text, text, text, text, jsonb, text, uuid) from public, anon, authenticated;

-- A person's name for a log line ('Someone' if unknown, so a line is never lost).
create or replace function public.person_name(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select nullif(trim(p.display_name), '') from public.profiles p where p.id = p_id), 'Someone');
$$;
revoke execute on function public.person_name(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- XP: flat for your own tasks; nothing for tasks added already done
-- ---------------------------------------------------------------------------
alter table public.task_xp_events
  add column flag text check (flag in ('added_done'));
comment on column public.task_xp_events.flag is 'added_done: the task was added already finished (no XP, not counted for badges or streaks).';

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
  v_cap constant int := 60;
  v_base int;
  v_on_time int := 0;
  v_sub int := 0;
  v_total int;
  v_self boolean;
  v_used int;
  v_capped boolean := false;
  v_flag text;
  v_old_points int;
  v_secs int;
begin
  -- Re-opened: take the XP back.
  if tg_op = 'UPDATE' and old.status = 'done' and new.status <> 'done' then
    delete from public.task_xp_events e where e.task_id = new.id returning e.points into v_old_points;
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
  v_total := v_base + v_on_time + v_sub;

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

  insert into public.task_xp_events (task_id, user_id, points, base, on_time, subtasks, self_set, capped, day, flag)
  values (new.id, v_earner, v_total, v_base, v_on_time, v_sub, v_self, v_capped, v_today, v_flag)
  on conflict (task_id) do nothing;

  -- The activity feed, and what admins should know.
  perform public.write_log('tasks', 'task.completed',
    public.person_name(v_actor) || ' finished “' || new.title || '”' || case when v_total > 0 then ' (+' || v_total || ' XP)' else '' end,
    'task', new.id::text,
    jsonb_build_object('points', v_total, 'self_set', v_self, 'earner', v_earner, 'given_by', case when v_self then null else new.created_by end));
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
-- What can be changed, and by whom
-- ---------------------------------------------------------------------------
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
     and not v_manager then
    raise exception 'Only coordinators and admins can give a task to someone else.' using errcode = '42501';
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
    -- Subtasks: ticking is fine; adding, removing or renaming steps is not.
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

-- Giving, moving and removing tasks show in the activity feed.
create or replace function public.log_task_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if new.assignee_id is not null and new.assignee_id is distinct from new.created_by then
      perform public.write_log('tasks', 'task.assigned',
        public.person_name(new.created_by) || ' gave ' || public.person_name(new.assignee_id) || ' “' || new.title || '”',
        'task', new.id::text,
        jsonb_build_object('assignee', new.assignee_id, 'priority', new.priority, 'due_date', new.due_date), 'everyone', coalesce(v_actor, new.created_by));
    end if;
  elsif tg_op = 'UPDATE' then
    if new.assignee_id is distinct from old.assignee_id then
      perform public.write_log('tasks', 'task.reassigned',
        public.person_name(v_actor) || ' moved “' || new.title || '” from ' || case when old.assignee_id is null then 'nobody' else public.person_name(old.assignee_id) end
          || ' to ' || case when new.assignee_id is null then 'nobody' else public.person_name(new.assignee_id) end,
        'task', new.id::text, jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
    end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      perform public.write_log('tasks', 'task.removed', public.person_name(v_actor) || ' removed “' || new.title || '”', 'task', new.id::text,
        jsonb_build_object('was', old.status));
    end if;
  elsif tg_op = 'DELETE' then
    perform public.write_log('tasks', 'task.deleted', public.person_name(v_actor) || ' deleted “' || old.title || '”', 'task', old.id::text,
      jsonb_build_object('was', old.status, 'assignee', old.assignee_id), 'admins');
  end if;
  return coalesce(new, old);
end;
$$;
create trigger tasks_log_change after insert or update of assignee_id, status or delete on public.tasks
  for each row execute function public.log_task_change();
revoke execute on function public.log_task_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Send a finished task back
-- ---------------------------------------------------------------------------
create or replace function public.send_back_task(p_task uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  t public.tasks%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  select * into t from public.tasks where id = p_task;
  if not found then
    raise exception 'That task doesn''t exist.' using errcode = 'P0002';
  end if;
  if not (t.created_by = v_me or public.has_permission('tasks.manage')) or not public.is_active_staff() then
    raise exception 'Only the person who gave this task can send it back.' using errcode = '42501';
  end if;
  if t.status <> 'done' then
    raise exception 'Only a finished task can be sent back.' using errcode = '22023';
  end if;
  if t.assignee_id is null or t.assignee_id = v_me then
    raise exception 'This task is yours; re-open it instead.' using errcode = '22023';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 280 then
    raise exception 'Say in a few words what still needs doing (up to 280 characters).' using errcode = '22023';
  end if;

  perform set_config('philrads.sending_back', 'on', true);
  update public.tasks set status = 'todo' where id = p_task;
  perform set_config('philrads.sending_back', '', true);

  insert into public.notifications (recipient_id, title, body, link_path)
  values (t.assignee_id, public.person_name(v_me) || ' sent back “' || left(t.title, 120) || '”', v_reason, '/tasks?task=' || t.id);
  perform public.write_log('tasks', 'task.sent_back',
    public.person_name(v_me) || ' sent back “' || t.title || '” to ' || public.person_name(t.assignee_id) || ': ' || v_reason,
    'task', t.id::text, jsonb_build_object('assignee', t.assignee_id, 'reason', v_reason));
end;
$$;
revoke execute on function public.send_back_task(uuid, text) from public, anon;
grant execute on function public.send_back_task(uuid, text) to authenticated;

-- Kudos are XP: admins see who gave them.
create or replace function public.log_task_kudos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_log('tasks', 'kudos.sent',
    public.person_name(new.from_user) || ' gave kudos to ' || public.person_name(new.to_user) || ' (+' || new.points || ' XP)',
    'kudos', new.id::text, jsonb_build_object('to', new.to_user, 'message', new.message), 'admins', new.from_user);
  return new;
end;
$$;
create trigger task_kudos_log after insert on public.task_kudos
  for each row execute function public.log_task_kudos();
revoke execute on function public.log_task_kudos() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sign-ins (admins only). Who is taken from the session, so it can't be faked;
-- repeated calls within 20 minutes are one sign-in.
-- ---------------------------------------------------------------------------
create or replace function public.log_sign_in(p_device text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    return;
  end if;
  if exists (
    select 1 from public.activity_logs l
    where l.actor_id = v_me and l.action = 'auth.signed_in' and l.created_at > now() - interval '20 minutes'
  ) then
    return;
  end if;
  perform public.write_log('system', 'auth.signed_in', public.person_name(v_me) || ' signed in', 'profile', v_me::text,
    jsonb_build_object('device', left(coalesce(p_device, ''), 120)), 'admins', v_me);
end;
$$;
revoke execute on function public.log_sign_in(text) from public, anon;
grant execute on function public.log_sign_in(text) to authenticated;
