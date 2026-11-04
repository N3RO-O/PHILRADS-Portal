-- Projects: a total project cost, and finished projects count in Statistics.
--
-- * project_costs holds each project's total cost. Like activity funding it is private:
--   only funding.read (administrators and coordinators) sees it, and changing it also needs
--   the right to manage that project.
-- * When a project is marked completed it is added to the statistics (program_activities) as one
--   record, source 'Projects module', with its people reached, partner, and its cost and donor
--   as funding. Later edits to a completed project refresh that record; if the project is
--   reopened the record is hidden (not deleted), and it comes back when the project is done again.
--   Projects already completed are added now.

create table public.project_costs (
  project_id uuid primary key references public.projects (id) on delete cascade,
  total_cost numeric(14, 2) check (total_cost >= 0),
  updated_at timestamptz not null default now()
);

create trigger project_costs_set_updated_at before update on public.project_costs
  for each row execute function public.set_updated_at();

alter table public.project_costs enable row level security;

create policy project_costs_read on public.project_costs for select to authenticated
  using ((select public.has_permission('funding.read')));
create policy project_costs_insert on public.project_costs for insert to authenticated
  with check ((select public.has_permission('funding.read')) and public.can_manage_project(project_id));
create policy project_costs_update on public.project_costs for update to authenticated
  using ((select public.has_permission('funding.read')) and public.can_manage_project(project_id))
  with check ((select public.has_permission('funding.read')) and public.can_manage_project(project_id));

revoke delete on public.project_costs from authenticated;
revoke all on public.project_costs from anon;

-- One statistics record per project.
create unique index program_activities_from_project_idx on public.program_activities (project_id)
  where source = 'Projects module' and project_id is not null;

-- Adds, refreshes or hides the project's statistics record. Runs as the owner: a project lead
-- can finish their project without being able to edit the statistics themselves.
create or replace function public.project_to_statistics(p_project uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.projects%rowtype;
  v_cost numeric(14, 2);
  v_id uuid;
  v_day date;
  v_label text;
  v_program text;
  v_served int;
begin
  select * into p from public.projects where id = p_project;
  if not found then
    return;
  end if;

  if p.status <> 'completed' then
    update public.program_activities set is_active = false
    where project_id = p.id and source = 'Projects module' and is_active;
    return;
  end if;

  v_day := coalesce(p.end_date, p.start_date, (now() at time zone 'Asia/Manila')::date);
  v_label := case
    when p.start_date is not null and p.end_date is not null and p.start_date <> p.end_date
      then to_char(p.start_date, 'FMMonth FMDD, YYYY') || ' - ' || to_char(p.end_date, 'FMMonth FMDD, YYYY')
    else to_char(v_day, 'FMMonth FMDD, YYYY')
  end;
  v_program := case
    when p.program_area ~* 'response|relief|emergency' then 'emergency'
    when p.program_area ~* 'rehab|recovery' then 'rehabilitation'
    when p.program_area ~* 'livelihood' then 'livelihood'
    when p.program_area ~* 'prepared|training|education' then 'training'
    else 'special'
  end;
  v_served := case
    when p.beneficiaries_target is null and p.beneficiaries_additional = 0 then null
    else coalesce(p.beneficiaries_target, 0) + p.beneficiaries_additional
  end;

  update public.program_activities set
    year = extract(year from v_day)::smallint,
    start_date = p.start_date,
    end_date = p.end_date,
    date_label = v_label,
    program = v_program,
    activity = p.name,
    site = coalesce(nullif(trim(p.location), ''), 'Not specified'),
    individuals_target = p.beneficiaries_target,
    individuals_served = v_served,
    served_note = case when p.beneficiaries_additional > 0
      then format('%s planned + %s more reached', coalesce(p.beneficiaries_target, 0), p.beneficiaries_additional) end,
    partner = p.partner,
    status = 'completed',
    is_active = true
  where project_id = p.id and source = 'Projects module'
  returning id into v_id;

  if v_id is null then
    insert into public.program_activities (
      year, start_date, end_date, date_label, program, activity, site,
      individuals_target, individuals_served, served_note, partner, status, source, notes, project_id)
    values (
      extract(year from v_day)::smallint, p.start_date, p.end_date, v_label, v_program, p.name,
      coalesce(nullif(trim(p.location), ''), 'Not specified'),
      p.beneficiaries_target, v_served,
      case when p.beneficiaries_additional > 0
        then format('%s planned + %s more reached', coalesce(p.beneficiaries_target, 0), p.beneficiaries_additional) end,
      p.partner, 'completed', 'Projects module', 'Added when the project was marked completed.', p.id)
    returning id into v_id;
  end if;

  select total_cost into v_cost from public.project_costs where project_id = p.id;
  if v_cost is not null or p.donor is not null then
    insert into public.program_activity_funding (activity_id, funding, funding_note, donors)
    values (v_id, v_cost, case when v_cost is not null then 'Total project cost' end, p.donor)
    on conflict (activity_id) do update set
      funding = excluded.funding, funding_note = excluded.funding_note, donors = excluded.donors;
  else
    delete from public.program_activity_funding where activity_id = v_id;
  end if;
end;
$$;
revoke execute on function public.project_to_statistics(uuid) from public, anon, authenticated;

create or replace function public.projects_to_statistics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status <> 'completed' then
    return null;
  end if;
  perform public.project_to_statistics(new.id);
  return null;
end;
$$;
revoke execute on function public.projects_to_statistics() from public, anon, authenticated;

create trigger projects_to_statistics
  after insert or update of status, name, program_area, start_date, end_date, location, partner, donor, beneficiaries_target, beneficiaries_additional
  on public.projects
  for each row execute function public.projects_to_statistics();

create or replace function public.project_costs_to_statistics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.project_to_statistics(new.project_id);
  return null;
end;
$$;
revoke execute on function public.project_costs_to_statistics() from public, anon, authenticated;

create trigger project_costs_to_statistics
  after insert or update of total_cost on public.project_costs
  for each row execute function public.project_costs_to_statistics();

-- Projects already finished.
select public.project_to_statistics(id) from public.projects where status = 'completed';
