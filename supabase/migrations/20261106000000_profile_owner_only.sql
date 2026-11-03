-- Profiles: only the person themself edits their profile (name, position, office, phone, bio,
-- picture, colour, who can see it). Administrators keep what the Staff page does: role,
-- switching accounts on or off, and archiving (guard_profile_privileges and protect_staff_admins
-- still decide those). Server code (invites, with the service key) isn't limited.

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
  if (new.full_name, new.display_name, new.job_title, new.office, new.phone, new.bio, new.avatar_data, new.avatar_color, new.profile_public)
     is distinct from
     (old.full_name, old.display_name, old.job_title, old.office, old.phone, old.bio, old.avatar_data, old.avatar_color, old.profile_public) then
    raise exception 'Only the person can change their own profile.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_owner before update on public.profiles
  for each row execute function public.guard_profile_owner();
revoke execute on function public.guard_profile_owner() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who's online, without depending on Realtime: each open portal saves its status about every
-- 45 seconds; anyone seen in the last 2 minutes counts as on. Invisible removes the row.
-- ---------------------------------------------------------------------------
create table public.staff_presence (
  profile_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  status text not null check (status in ('online', 'idle', 'dnd')),
  seen_at timestamptz not null default now()
);
alter table public.staff_presence enable row level security;
create policy staff_presence_read on public.staff_presence for select to authenticated
  using ((select public.is_active_staff()));
create policy staff_presence_insert on public.staff_presence for insert to authenticated
  with check (profile_id = (select auth.uid()) and (select public.is_active_staff()));
create policy staff_presence_update on public.staff_presence for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy staff_presence_delete on public.staff_presence for delete to authenticated
  using (profile_id = (select auth.uid()));
revoke all on public.staff_presence from anon;
