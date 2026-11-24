-- Staff Tasks: comments between the giver and the doer, and task templates (a set of tasks added at once).

-- Who may see a task (the same rule as the tasks_read policy), for tables that hang off a task.
create or replace function public.can_see_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
     where t.id = p_task
       and public.is_active_staff()
       and (
         t.assignee_id = auth.uid()
         or t.created_by = auth.uid()
         or public.has_permission('tasks.read_all')
         or (t.project_id is not null and public.is_project_member(t.project_id))
       )
  );
$$;
revoke all on function public.can_see_task(uuid) from public;
grant execute on function public.can_see_task(uuid) to authenticated;

-- ───────────── Comments ─────────────
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;

drop policy if exists task_comments_read on public.task_comments;
create policy task_comments_read on public.task_comments for select to authenticated
  using (public.can_see_task(task_id));

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_see_task(task_id));

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments for delete to authenticated
  using (author_id = (select auth.uid()));

grant select, insert, delete on public.task_comments to authenticated;

-- Tell the giver and the doer (not the person who wrote it), in the bell.
create or replace function public.notify_task_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_giver uuid;
  v_doer uuid;
begin
  select t.title, t.created_by, t.assignee_id into v_title, v_giver, v_doer from public.tasks t where t.id = new.task_id;
  insert into public.notifications (recipient_id, title, body, link_path)
  select r.id,
         public.person_name(new.author_id) || ' commented on “' || left(coalesce(v_title, 'a task'), 80) || '”',
         left(new.body, 140),
         '/tasks?task=' || new.task_id
    from (select distinct unnest(array[v_giver, v_doer]) as id) r
   where r.id is not null and r.id <> new.author_id;
  return new;
end;
$$;
revoke all on function public.notify_task_comment() from public;

drop trigger if exists task_comments_notify on public.task_comments;
create trigger task_comments_notify after insert on public.task_comments
  for each row execute function public.notify_task_comment();

-- ───────────── Templates ─────────────
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  list text not null default 'emergency' check (list in ('emergency', 'rehabilitation', 'livelihood', 'training', 'special', 'monitoring')),
  work_setting text not null default 'field' check (work_setting in ('field', 'office')),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.task_templates enable row level security;

drop policy if exists task_templates_read on public.task_templates;
create policy task_templates_read on public.task_templates for select to authenticated
  using ((select public.is_active_staff()));

drop policy if exists task_templates_insert on public.task_templates;
create policy task_templates_insert on public.task_templates for insert to authenticated
  with check ((select public.is_active_staff()) and created_by = (select auth.uid()));

drop policy if exists task_templates_update on public.task_templates;
create policy task_templates_update on public.task_templates for update to authenticated
  using ((select public.is_active_staff()) and (created_by = (select auth.uid()) or (select public.has_permission('tasks.manage'))))
  with check ((select public.is_active_staff()));

drop policy if exists task_templates_delete on public.task_templates;
create policy task_templates_delete on public.task_templates for delete to authenticated
  using ((select public.is_active_staff()) and (created_by = (select auth.uid()) or (select public.has_permission('tasks.manage'))));

grant select, insert, update, delete on public.task_templates to authenticated;

create or replace function public.touch_task_template()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.created_by := old.created_by; -- the owner never changes
  return new;
end;
$$;

drop trigger if exists task_templates_touch on public.task_templates;
create trigger task_templates_touch before update on public.task_templates
  for each row execute function public.touch_task_template();
