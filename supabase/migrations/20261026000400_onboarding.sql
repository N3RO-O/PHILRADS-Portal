-- =============================================================================
-- PHILRADS Staff Portal: first-run progress ("Get started")
--
-- Each person's first-run progress lives on their own profile, so it follows them
-- from phone to computer and survives "Skip for now":
--   { "focus": "stock", "question": "answered" | "skipped", "hidden": true,
--     "coachSeen": true, "steps": { "task": "2026-10-26T…Z", … } }
-- Changed only through update_onboarding(), which merges what it's given into the
-- caller's own row (steps are merged one by one, so two devices never undo each other).
-- =============================================================================

alter table public.profiles
  add column onboarding jsonb not null default '{}'::jsonb
  check (jsonb_typeof(onboarding) = 'object' and pg_column_size(onboarding) < 4096);
comment on column public.profiles.onboarding is 'First-run progress (Get started checklist). Written by update_onboarding() only.';

create or replace function public.update_onboarding(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or (p_patch ? 'steps' and jsonb_typeof(p_patch -> 'steps') <> 'object') then
    raise exception 'Not a valid progress update' using errcode = '22023';
  end if;

  update public.profiles
  set onboarding = (onboarding - 'steps') || (p_patch - 'steps')
                   || jsonb_build_object('steps', coalesce(onboarding -> 'steps', '{}'::jsonb) || coalesce(p_patch -> 'steps', '{}'::jsonb))
  where id = (select auth.uid())
  returning onboarding into result;
  return result;
end;
$$;
revoke execute on function public.update_onboarding(jsonb) from public, anon;
grant execute on function public.update_onboarding(jsonb) to authenticated;
