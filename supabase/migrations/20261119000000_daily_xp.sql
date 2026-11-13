-- =============================================================================
-- PHILRADS Staff Portal: +10 XP for checking in, once a day
--
-- * daily_xp_claims: one row per person per Manila day (the primary key makes a second claim
--   that day impossible). Written only by claim_daily_xp(); people read their own.
-- * claim_daily_xp(): the server picks the day (Asia/Manila), so a device clock can't be used
--   to claim twice. Returns the points paid today (10), whether this call paid them or an
--   earlier one did.
-- * profile_task_stats(): counts the daily XP too, so colleagues see the same level.
--
-- Run after 20261117000000_onboarding_xp_and_week_bonus.sql: the profile_task_stats() change
-- builds on that one, and stops with an error (changing nothing) if it isn't there.
-- =============================================================================

begin;

create table public.daily_xp_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  points int not null check (points > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
comment on table public.daily_xp_claims is 'Check-in XP, once per person per Manila day. Written only by claim_daily_xp().';
alter table public.daily_xp_claims enable row level security;
create policy daily_xp_claims_read on public.daily_xp_claims for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.daily_xp_claims from authenticated;
revoke all on public.daily_xp_claims from anon;

create or replace function public.claim_daily_xp()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_day date := (now() at time zone 'Asia/Manila')::date;
  v_points constant int := 10;
begin
  if v_me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_me and p.is_active) then
    raise exception 'This account is not active' using errcode = '42501';
  end if;
  insert into public.daily_xp_claims (user_id, day, points) values (v_me, v_day, v_points)
  on conflict (user_id, day) do nothing;
  return (select c.points from public.daily_xp_claims c where c.user_id = v_me and c.day = v_day);
end;
$$;
revoke execute on function public.claim_daily_xp() from public, anon;
grant execute on function public.claim_daily_xp() to authenticated;

-- Profiles: XP includes the daily check-ins.
do $$
declare
  d text := pg_get_functiondef('public.profile_task_stats(uuid)'::regprocedure);
  v_old constant text := 'coalesce((select ob.points from public.onboarding_bonuses ob where ob.user_id = p_id), 0),';
  v_new constant text := 'coalesce((select ob.points from public.onboarding_bonuses ob where ob.user_id = p_id), 0) + coalesce((select sum(dx.points) from public.daily_xp_claims dx where dx.user_id = p_id), 0)::int,';
begin
  if position(v_old in d) = 0 then
    raise exception 'profile_task_stats() is not the expected version (run 20261117000000 first); nothing changed';
  end if;
  execute replace(d, v_old, v_new);
end;
$$;

commit;
