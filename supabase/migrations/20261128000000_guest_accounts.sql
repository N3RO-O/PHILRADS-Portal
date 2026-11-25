-- Guest accounts: guests may sign in with Google to read full stories, pray with us and see
-- where a fundraiser's gifts went, to set up their own profile, and to see who else is here.
--
-- A guest account is a profile with role 'guest' that is never active, so every staff policy
-- (is_active_staff(), has_permission()) keeps it out of staff data exactly as an account
-- awaiting activation is kept out. The portal sends a signed-in guest to /guest.
--
-- * New accounts made through Google sign-in become guests. Staff accounts are made by invite
--   (email), and a staff member who later signs in with Google keeps their staff account
--   (Supabase links the Google sign-in to the existing account with the same email).
-- * A guest can never be switched on as a guest: making them staff means giving them a staff
--   role and activating them together, on the Staff page.
-- * Guests don't appear in the Staff page's list.

insert into public.roles (key, name, description, is_confirmed)
values ('guest', 'Guest', 'Signed in with Google on the guest page. No access to the staff portal.', true)
on conflict (key) do nothing;

alter table public.profiles add constraint profiles_guest_never_active check (role_key <> 'guest' or not is_active);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google';
  v_full text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), '');
begin
  insert into public.profiles (id, full_name, display_name, role_key)
  values (
    new.id,
    v_full,
    case
      when v_guest then coalesce(nullif(split_part(v_full, ' ', 1), ''), 'Guest')
      else coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1))
    end,
    case when v_guest then 'guest' else 'staff' end
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- The Staff page lists staff only.
create or replace function public.list_staff()
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
    where p.role_key <> 'guest'
    order by p.is_active desc, lower(coalesce(nullif(p.full_name, ''), p.display_name));
end;
$$;
revoke execute on function public.list_staff() from public, anon;
grant execute on function public.list_staff() to authenticated;

