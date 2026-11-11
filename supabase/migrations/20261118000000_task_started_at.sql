-- When a task was started, so a person's task timeline can show started → finished and how long it took.
-- started_at is set by the database the first time a task goes to "in progress" (or "for review"),
-- like completed_at: the browser can't set or backdate it. Re-opening a finished task keeps it.
-- A task ticked off without being started has no started_at; the timeline then counts from when it
-- was given (created_at).

alter table public.tasks add column if not exists started_at timestamptz;
comment on column public.tasks.started_at is 'First time the task went to in progress (set by trigger).';

create or replace function public.set_task_started_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.started_at := case when new.status in ('in_progress', 'review') then now() end;
  elsif old.started_at is not null then
    new.started_at := old.started_at;
  elsif new.status in ('in_progress', 'review') and old.status is distinct from new.status then
    new.started_at := now();
  else
    new.started_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.set_task_started_at() from public, anon, authenticated;

drop trigger if exists tasks_set_started_at on public.tasks;
create trigger tasks_set_started_at before insert or update on public.tasks
  for each row execute function public.set_task_started_at();

-- staff_tasks_of: also return when each task was given and started. The return type changes, so the
-- function is dropped and made again (same rules as 20261103000000_staff_tasks_acceptance_nudges_push.sql).
drop function if exists public.staff_tasks_of(uuid);
create function public.staff_tasks_of(p_person uuid)
returns table (id uuid, title text, status text, priority text, due_date date, acceptance text, given_by text, given_by_id uuid, completed_at timestamptz, nudged_at timestamptz, created_at timestamptz, started_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, t.status, t.priority, t.due_date, t.acceptance,
    case when t.created_by = t.assignee_id then null else public.person_name(t.created_by) end, t.created_by, t.completed_at,
    (select max(n.created_at) from public.task_nudges n where n.task_id = t.id),
    t.created_at, t.started_at
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
