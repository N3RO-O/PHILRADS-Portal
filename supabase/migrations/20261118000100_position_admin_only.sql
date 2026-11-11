-- =============================================================================
-- PHILRADS Staff Portal: only an administrator changes someone's position
--
-- A person's position (profiles.job_title) is set by an administrator (staff.manage), on anyone's
-- profile. People can no longer change their own; until one is set, the portal shows the role
-- they were invited with.
--
-- * guard_profile_owner(): as in 20261109000000_avatar_frames.sql, minus job_title (the rest of
--   the profile is still the person's own).
-- * guard_profile_position(): a change to job_title needs staff.manage.
-- * list_staff(): also returns job_title, so the Staff page can show and set positions
--   (as in 20261026000300_staff_archive.sql, plus that column).
-- =============================================================================

begin;

create or replace function public.guard_profile_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or new.id = (select auth.uid()) then
    return new;
  end if;
  if (new.full_name, new.display_name, new.office, new.phone, new.bio, new.avatar_data, new.avatar_color, new.avatar_frame, new.profile_public)
     is distinct from
     (old.full_name, old.display_name, old.office, old.phone, old.bio, old.avatar_data, old.avatar_color, old.avatar_frame, old.profile_public) then
    raise exception 'Only the person can change their own profile.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.guard_profile_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Server-side jobs (no signed-in user) and administrators may set it.
  if (select auth.uid()) is null or new.job_title is not distinct from old.job_title then
    return new;
  end if;
  if not public.has_permission('staff.manage') then
    raise exception 'Only an administrator can change a position.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_profile_position() from public, anon, authenticated;

create trigger profiles_guard_position before update of job_title on public.profiles
  for each row execute function public.guard_profile_position();

drop function public.list_staff();
create function public.list_staff()
returns table (
  id uuid,
  email text,
  full_name text,
  display_name text,
  role_key text,
  is_active boolean,
  invite_pending boolean,
  invited_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  archived_at timestamptz,
  job_title text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('staff.manage') then
    raise exception 'Only staff administrators can see staff accounts' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.display_name, p.role_key, p.is_active,
           (u.invited_at is not null and u.email_confirmed_at is null) as invite_pending,
           u.invited_at, u.last_sign_in_at, p.created_at, p.archived_at, p.job_title
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.is_active desc, lower(coalesce(nullif(p.full_name, ''), p.display_name));
end;
$$;
revoke execute on function public.list_staff() from public, anon;
grant execute on function public.list_staff() to authenticated;

commit;
