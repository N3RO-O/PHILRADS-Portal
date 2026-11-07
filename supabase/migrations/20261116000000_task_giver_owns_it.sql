-- A task belongs to the person who gave it. What they set (title, list, due date, who it's for,
-- the photo rule, sending it back, removing it) only they can change. Another coordinator or
-- admin can't edit or undo it any more. The one exception: when the giver's account is no longer
-- active (or the task has no giver), anyone who can manage tasks may step in, so nothing is
-- left stuck. The person it was given to keeps what was theirs: accept or decline, plan it for
-- today, tick steps off, finish it.

create or replace function public.task_giver_or_stand_in(p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_created_by = (select auth.uid())
      or (public.has_permission('tasks.manage')
          and (p_created_by is null
               or not exists (select 1 from public.profiles p where p.id = p_created_by and p.is_active)));
$$;
revoke execute on function public.task_giver_or_stand_in(uuid) from public, anon;
grant execute on function public.task_giver_or_stand_in(uuid) to authenticated;

create or replace function public.guard_task_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_giver boolean;
begin
  if v_me is null then
    return new; -- SQL editor / service role
  end if;
  v_giver := public.task_giver_or_stand_in(old.created_by);
  if new.created_by is distinct from old.created_by then
    raise exception 'The person who created a task can''t be changed.' using errcode = '42501';
  end if;

  -- Neither the giver nor the person it's for: hands off.
  if not v_giver and old.assignee_id is distinct from v_me then
    raise exception 'Only % can change this task.', public.person_name(old.created_by) using errcode = '42501';
  end if;

  if new.assignee_id is distinct from old.assignee_id and not v_giver then
    raise exception 'Only the person who gave this task can give it to someone else.' using errcode = '42501';
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
  if not v_giver then
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
     and not public.task_giver_or_stand_in(old.created_by) then
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
  if not public.task_giver_or_stand_in(t.created_by) or not public.is_active_staff() then
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

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using ((select public.has_permission('tasks.manage')) and public.task_giver_or_stand_in(created_by));
