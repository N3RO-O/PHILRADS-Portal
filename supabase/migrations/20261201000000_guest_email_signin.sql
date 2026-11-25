-- Guests sign in with an emailed code, as staff do, instead of with Google.
--
-- * Every account made by signing in on its own becomes a guest (role 'guest', never active),
--   so opening sign-ups gives a stranger nothing in the staff portal.
-- * Staff are made by invitation. Supabase writes invited_at just after it creates the user,
--   so an invited account starts as a guest and is turned into a pending staff account the
--   moment the invitation goes out (from the Staff page or the Supabase dashboard). The Staff
--   page then sets the chosen role and switches it on, as before.

update public.roles
set description = 'Signed in on the guest page with an emailed code. No access to the staff portal.'
where key = 'guest';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest boolean := new.invited_at is null;
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

-- An invitation turns a guest account (made moments earlier, or a guest who signed up first)
-- into a pending staff account: role 'staff', still switched off until an administrator says so.
create or replace function public.handle_user_invited()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set role_key = 'staff',
      display_name = coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(display_name, ''), split_part(coalesce(new.email, ''), '@', 1))
  where id = new.id and role_key = 'guest';
  return new;
end;
$$;

revoke execute on function public.handle_user_invited() from public, anon, authenticated;

drop trigger if exists on_auth_user_invited on auth.users;
create trigger on_auth_user_invited
  after update of invited_at on auth.users
  for each row
  when (old.invited_at is null and new.invited_at is not null)
  execute function public.handle_user_invited();
