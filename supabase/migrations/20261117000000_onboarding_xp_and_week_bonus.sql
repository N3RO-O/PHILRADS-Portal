-- =============================================================================
-- PHILRADS Staff Portal: XP for finishing Get started, and a bigger week bonus
--
-- * Finishing the Get started checklist earns +50 XP, once per person
--   (onboarding_bonuses, written only by claim_onboarding_xp()).
-- * The full working week bonus (a task finished every day Monday to Friday) goes from
--   +25 to +50 XP for weeks earned from now on. Weeks already earned keep what they got.
-- * profile_task_stats() counts the Get started XP, so colleagues see the same level.
--
-- award_task_xp() and profile_task_stats() are changed in place from their live definitions
-- (one exact text swap each), and stop with an error if the live text isn't the expected one.
-- =============================================================================

begin;

-- ── Get started XP ─────────────────────────────────────────────────────────
create table public.onboarding_bonuses (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  points int not null check (points > 0),
  created_at timestamptz not null default now()
);
comment on table public.onboarding_bonuses is 'XP for finishing the Get started checklist, once per person. Written only by claim_onboarding_xp().';
alter table public.onboarding_bonuses enable row level security;
create policy onboarding_bonuses_read on public.onboarding_bonuses for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.onboarding_bonuses from authenticated;
revoke all on public.onboarding_bonuses from anon;

-- Pays the Get started XP once, when the steps every role has are all done (the others depend
-- on the role, and the app checks those). Returns the points this person has from it.
create or replace function public.claim_onboarding_xp()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_steps jsonb;
  v_points constant int := 50;
begin
  if v_me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select p.onboarding -> 'steps' into v_steps from public.profiles p where p.id = v_me;
  if v_steps is null or not (v_steps ?& array['task', 'search', 'profile', 'unlock', 'notify', 'install']) then
    raise exception 'Finish Get started first' using errcode = '22023';
  end if;
  insert into public.onboarding_bonuses (user_id, points) values (v_me, v_points)
  on conflict (user_id) do nothing;
  return (select b.points from public.onboarding_bonuses b where b.user_id = v_me);
end;
$$;
revoke execute on function public.claim_onboarding_xp() from public, anon;
grant execute on function public.claim_onboarding_xp() to authenticated;

-- ── Week bonus: +25 → +50 ──────────────────────────────────────────────────
do $$
declare
  d text := pg_get_functiondef('public.award_task_xp()'::regprocedure);
begin
  if position('v_week_points constant int := 25;' in d) = 0 then
    raise exception 'award_task_xp() is not the expected version; nothing changed';
  end if;
  execute replace(d, 'v_week_points constant int := 25;', 'v_week_points constant int := 50;');
end;
$$;

-- ── Profiles: XP includes Get started ──────────────────────────────────────
do $$
declare
  d text := pg_get_functiondef('public.profile_task_stats(uuid)'::regprocedure);
  v_old constant text := '(select pts from k) + (select pts from w),';
  v_new constant text := '(select pts from k) + (select pts from w) + coalesce((select ob.points from public.onboarding_bonuses ob where ob.user_id = p_id), 0),';
begin
  if position(v_old in d) = 0 then
    raise exception 'profile_task_stats() is not the expected version; nothing changed';
  end if;
  execute replace(d, v_old, v_new);
end;
$$;

commit;
