-- Task lists become the PHILRADS program areas, named as in Statistics (src/services/tasks/types.ts):
--   emergency       Emergency response               <- relief, assessment, logistics
--   rehabilitation  Rehabilitation and recovery
--   livelihood      Sustainable livelihood
--   training        Training and capacity building   <- volunteers
--   special         Special projects
--   monitoring      Monitoring and coordination      <- coordination, reports, beneficiaries, office
-- The old names stay allowed for a while, so a phone still on the previous version can save
-- (the portal reads them as their program); every saved task moves to its program now.

alter table public.tasks drop constraint if exists tasks_list_check;

update public.tasks set list = case list
    when 'relief' then 'emergency'
    when 'assessment' then 'emergency'
    when 'logistics' then 'emergency'
    when 'volunteers' then 'training'
    when 'coordination' then 'monitoring'
    when 'reports' then 'monitoring'
    when 'beneficiaries' then 'monitoring'
    when 'office' then 'monitoring'
    else list
  end
where list in ('relief', 'assessment', 'logistics', 'volunteers', 'coordination', 'reports', 'beneficiaries', 'office');

alter table public.tasks alter column list set default 'monitoring';
alter table public.tasks add constraint tasks_list_check check (list in (
  'emergency', 'rehabilitation', 'livelihood', 'training', 'special', 'monitoring',
  'relief', 'assessment', 'logistics', 'beneficiaries', 'reports', 'volunteers', 'coordination', 'office'
));

-- Badges count finished tasks by program (as 20261113000000_task_photos_and_week_bonus.sql, with the new lists).
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
      'emergency', (select count(*) from a where list = 'emergency'),
      'rehabilitation', (select count(*) from a where list = 'rehabilitation'),
      'livelihood', (select count(*) from a where list = 'livelihood'),
      'training', (select count(*) from a where list = 'training'),
      'special', (select count(*) from a where list = 'special'),
      'monitoring', (select count(*) from a where list = 'monitoring')),
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
