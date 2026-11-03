-- Profiles: public or private, chosen by each person.
--
-- * profile_public (default true). Public: any active colleague can open the full profile.
--   Private: colleagues see only the name, picture and role; the details (position, office, phone,
--   bio) and the level and badges are for the person and administrators (staff.manage).
-- * Enforced here, not only on screen: those detail columns can no longer be read straight from
--   the profiles table. view_profile(id) returns a profile with or without them, by these rules.
--   Columns added to profiles later must be granted below too, or they won't be readable.

alter table public.profiles add column profile_public boolean not null default true;

revoke select on public.profiles from authenticated;
do $$
declare
  c text;
begin
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name not in ('phone', 'bio', 'job_title', 'office')
  loop
    execute format('grant select (%I) on public.profiles to authenticated', c);
  end loop;
end $$;

-- The profile as the viewer may see it. Null when there's no such person or the viewer isn't
-- active staff (your own is always there).
create or replace function public.view_profile(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  v_me uuid := (select auth.uid());
  v_full boolean;
  v_role text;
begin
  if not (p_id = v_me or public.is_active_staff()) then
    return null;
  end if;
  select * into p from public.profiles where id = p_id;
  if not found then
    return null;
  end if;
  select name into v_role from public.roles where key = p.role_key;
  v_full := p.id = v_me or p.profile_public or public.has_permission('staff.manage');
  return jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'full_name', p.full_name,
    'role_key', p.role_key,
    'role_name', v_role,
    'is_active', p.is_active,
    'avatar_data', p.avatar_data,
    'avatar_color', p.avatar_color,
    'profile_public', p.profile_public,
    'details', v_full,
    'created_at', case when v_full then p.created_at end,
    'job_title', case when v_full then p.job_title end,
    'office', case when v_full then p.office end,
    'phone', case when v_full then p.phone end,
    'bio', case when v_full then p.bio end
  );
end;
$$;
revoke execute on function public.view_profile(uuid) from public, anon;
grant execute on function public.view_profile(uuid) to authenticated;

-- Level and badges follow the same rule (null for a private profile that isn't yours).
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
