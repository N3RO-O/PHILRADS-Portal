-- Task outputs: what someone hands in when they finish a task (optional): a note, links and up to
-- four photos (small JPEGs kept as data URLs, at most about 1.8 MB in all).
--
-- * Only the person the task is for adds an output, and only to their own task.
-- * Read by them, the person who gave the task, and anyone with tasks.read_all.
-- * The giver gets a bell note (and a phone notification) linking to the task.
-- * Outputs can't be changed afterwards; the author can remove one and hand in again.

create table public.task_outputs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  note text check (note is null or length(note) <= 2000),
  links text[] not null default '{}' check (cardinality(links) <= 10),
  photos text[] not null default '{}' check (cardinality(photos) <= 4 and octet_length(array_to_string(photos, '')) <= 1900000),
  created_at timestamptz not null default now(),
  check (note is not null or cardinality(links) > 0 or cardinality(photos) > 0)
);
create index task_outputs_task_idx on public.task_outputs (task_id, created_at desc);

alter table public.task_outputs enable row level security;

create policy task_outputs_read on public.task_outputs for select to authenticated
  using (
    (select public.is_active_staff()) and (
      author_id = (select auth.uid())
      or exists (select 1 from public.tasks t where t.id = task_id and (t.created_by = (select auth.uid()) or t.assignee_id = (select auth.uid())))
      or (select public.has_permission('tasks.read_all'))
    )
  );
create policy task_outputs_insert on public.task_outputs for insert to authenticated
  with check (
    (select public.is_active_staff())
    and author_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = (select auth.uid()))
    and not exists (select 1 from unnest(links) l where l !~* '^https?://')
    and not exists (select 1 from unnest(photos) p where p !~ '^data:image/(jpeg|png|webp);base64,')
  );
create policy task_outputs_delete on public.task_outputs for delete to authenticated
  using (author_id = (select auth.uid()));
revoke update on public.task_outputs from authenticated;
revoke all on public.task_outputs from anon;

-- The person who gave the task hears about it.
create or replace function public.notify_task_output()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tasks%rowtype;
  v_what text;
begin
  select * into t from public.tasks where id = new.task_id;
  if not found or t.created_by is null or t.created_by = new.author_id then
    return new;
  end if;
  v_what := concat_ws(', ',
    case when cardinality(new.photos) > 0 then cardinality(new.photos) || case when cardinality(new.photos) = 1 then ' photo' else ' photos' end end,
    case when cardinality(new.links) > 0 then cardinality(new.links) || case when cardinality(new.links) = 1 then ' link' else ' links' end end,
    case when new.note is not null then 'a note' end);
  insert into public.notifications (recipient_id, title, body, link_path)
  values (t.created_by, public.person_name(new.author_id) || ' sent their output for “' || left(t.title, 120) || '”',
    coalesce(left(new.note, 140), 'Sent ' || v_what || '.'), '/tasks?task=' || t.id);
  return new;
end;
$$;
create trigger task_outputs_notify after insert on public.task_outputs
  for each row execute function public.notify_task_output();
revoke execute on function public.notify_task_output() from public, anon, authenticated;
