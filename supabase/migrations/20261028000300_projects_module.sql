-- =============================================================================
-- PHILRADS Staff Portal: Projects (programs and projects, their milestones, reports and team)
--
-- * Every active staff member sees every project (PHILRADS, 2026-10-27); coordinators and admins
--   (projects.manage) create and edit them. A project's lead can also edit their project and manage
--   its milestones and team.
-- * Milestones and reporting deadlines: the team ticks them off; the project's progress follows
--   them (done / all) whenever it has any.
-- * Tasks and Documentation can belong to a project (tasks.project_id, documents.project_id).
-- * Changes show in the activity feed.
-- =============================================================================

alter table public.projects
  add column partner text check (partner is null or length(partner) <= 200),
  add column location text check (location is null or length(location) <= 200),
  add column beneficiaries_target int check (beneficiaries_target is null or beneficiaries_target between 0 and 100000000);
alter table public.projects add constraint projects_name_length check (length(name) <= 200);
alter table public.projects add constraint projects_description_length check (description is null or length(description) <= 4000);
comment on column public.projects.partner is 'Donor or partner organisation.';
comment on column public.projects.beneficiaries_target is 'How many people the project aims to reach.';

alter table public.project_members add constraint project_members_role_check check (member_role in ('lead', 'member'));

/** The project's lead (or projects.manage) may manage it. */
create or replace function public.can_manage_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.is_active_staff()) and (
    public.has_permission('projects.manage')
    or exists (select 1 from public.projects p where p.id = p_project and p.lead_id = (select auth.uid()))
  );
$$;
revoke execute on function public.can_manage_project(uuid) from public, anon;
grant execute on function public.can_manage_project(uuid) to authenticated;

-- Everyone active sees projects and their teams.
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated using ((select public.is_active_staff()));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using ((select public.can_manage_project(id))) with check ((select public.can_manage_project(id)));
drop policy if exists project_members_read on public.project_members;
create policy project_members_read on public.project_members for select to authenticated using ((select public.is_active_staff()));
drop policy if exists project_members_manage on public.project_members;
create policy project_members_manage on public.project_members for all to authenticated
  using ((select public.can_manage_project(project_id))) with check ((select public.can_manage_project(project_id)));

-- A lead can't hand the project to someone else or change its code; that's for projects.manage.
create or replace function public.guard_project_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.has_permission('projects.manage')
     and (new.lead_id is distinct from old.lead_id or new.code is distinct from old.code) then
    raise exception 'Only coordinators and admins can change a project''s lead or code.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger projects_guard_update before update on public.projects
  for each row execute function public.guard_project_update();
revoke execute on function public.guard_project_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Milestones and reporting deadlines
-- ---------------------------------------------------------------------------
create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  kind text not null default 'milestone' check (kind in ('milestone', 'report')),
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  position int not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_milestones_project_idx on public.project_milestones (project_id, position);
create index project_milestones_due_idx on public.project_milestones (due_date) where not done;
create trigger project_milestones_set_updated_at before update on public.project_milestones
  for each row execute function public.set_updated_at();
comment on column public.project_milestones.kind is 'milestone, or report (a reporting deadline, e.g. to the donor).';

alter table public.project_milestones enable row level security;
create policy project_milestones_read on public.project_milestones for select to authenticated using ((select public.is_active_staff()));
create policy project_milestones_insert on public.project_milestones for insert to authenticated
  with check ((select public.can_manage_project(project_id)));
-- The team ticks them off; what they are is for the lead / coordinators (checked below).
create policy project_milestones_update on public.project_milestones for update to authenticated
  using ((select public.can_manage_project(project_id)) or ((select public.is_active_staff()) and public.is_project_member(project_id)))
  with check ((select public.can_manage_project(project_id)) or ((select public.is_active_staff()) and public.is_project_member(project_id)));
create policy project_milestones_delete on public.project_milestones for delete to authenticated
  using ((select public.can_manage_project(project_id)));
revoke all on public.project_milestones from anon;

-- Who ticked it and when is the server's to say; team members may only tick.
create or replace function public.stamp_project_milestone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (select auth.uid()) is not null and not public.can_manage_project(old.project_id)
     and (new.title, new.kind, new.due_date, new.position, new.project_id) is distinct from (old.title, old.kind, old.due_date, old.position, old.project_id) then
    raise exception 'Only the project lead or a coordinator can change a milestone. You can tick it off.' using errcode = '42501';
  end if;
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_at := now();
    new.done_by := (select auth.uid());
  elsif not new.done then
    new.done_at := null;
    new.done_by := null;
  else
    new.done_at := old.done_at;
    new.done_by := old.done_by;
  end if;
  return new;
end;
$$;
create trigger project_milestones_stamp before insert or update on public.project_milestones
  for each row execute function public.stamp_project_milestone();
revoke execute on function public.stamp_project_milestone() from public, anon, authenticated;

-- Progress follows the milestones (done / all) once a project has any; logged for the team.
create or replace function public.after_project_milestone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid := coalesce(new.project_id, old.project_id);
  v_total int;
  v_done int;
  v_name text;
begin
  select count(*), count(*) filter (where m.done) into v_total, v_done from public.project_milestones m where m.project_id = v_project;
  if v_total > 0 then
    update public.projects set progress_percent = round(100.0 * v_done / v_total) where id = v_project and progress_percent <> round(100.0 * v_done / v_total);
  end if;
  if tg_op = 'UPDATE' and new.done and not old.done then
    select name into v_name from public.projects where id = v_project;
    perform public.write_log('projects', case when new.kind = 'report' then 'project.report_done' else 'project.milestone_done' end,
      public.person_name((select auth.uid())) || case when new.kind = 'report' then ' submitted “' else ' completed “' end || new.title || '” · ' || coalesce(v_name, 'a project'),
      'project', v_project::text, jsonb_build_object('milestone', new.id, 'kind', new.kind));
  end if;
  return null;
end;
$$;
create trigger project_milestones_after after insert or update or delete on public.project_milestones
  for each row execute function public.after_project_milestone();
revoke execute on function public.after_project_milestone() from public, anon, authenticated;

-- Projects in the activity feed: added, status changes.
create or replace function public.log_project_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_label text;
begin
  if tg_op = 'INSERT' then
    perform public.write_log('projects', 'project.created', public.person_name(coalesce(v_actor, new.created_by)) || ' started the project “' || new.name || '”',
      'project', new.id::text, jsonb_build_object('status', new.status), 'everyone', coalesce(v_actor, new.created_by));
  elsif new.status is distinct from old.status then
    v_label := case new.status when 'active' then 'active' when 'on_hold' then 'on hold' when 'completed' then 'completed' when 'cancelled' then 'cancelled' else 'planned' end;
    perform public.write_log('projects', 'project.status', public.person_name(v_actor) || ' marked “' || new.name || '” ' || v_label,
      'project', new.id::text, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger projects_log after insert or update of status on public.projects
  for each row execute function public.log_project_change();
revoke execute on function public.log_project_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Documentation uploads can belong to a project
-- ---------------------------------------------------------------------------
alter table public.drive_upload_sessions add column project_id uuid references public.projects (id) on delete set null;
grant update (project_id) on public.documents to authenticated;
