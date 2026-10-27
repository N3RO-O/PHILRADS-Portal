-- =============================================================================
-- PHILRADS Staff Portal: badges and level on profiles (PHILRADS, 2026-10-27)
--
-- Colleagues see each other's level and badges on the Profile page. XP records stay private
-- (task_xp_events_read is still "your own"); this returns only the counts the badges are worked
-- out from, read from the XP the database awarded, so nobody can give themselves a badge.
-- The badge rules themselves live in one place, src/lib/taskProgress.ts (BADGES, levelFor).
-- =============================================================================

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
  k as (select count(*)::int as n, coalesce(sum(points), 0)::int as pts from public.task_kudos where to_user = p_id)
  select jsonb_build_object(
    'xp', coalesce((select sum(points) from a), 0)::int + (select pts from k),
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
comment on function public.profile_task_stats(uuid) is 'Counts behind someone''s level and badges (Profile page). Active staff only.';
