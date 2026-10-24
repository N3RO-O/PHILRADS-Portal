-- =============================================================================
-- PHILRADS Staff Portal: Staff page (administrators manage portal accounts)
--
-- * list_staff(): every portal account with its email and sign-in status, for
--   staff with staff.manage. Emails live in auth.users, which the browser can't
--   read, so this SECURITY DEFINER function is the only way to see them.
-- * Role and on/off changes are ordinary profile updates (profiles_update policy +
--   guard_profile_privileges already limit them to staff.manage). Two safety rules
--   are added on top:
--     - you can't change your own role or switch off your own account;
--     - the last active staff administrator can't be removed or switched off.
-- * Every role or on/off change is written to the activity log.
-- * Invitations are sent by /api/staff-invite (Vercel), which needs the service key.
-- =============================================================================

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
  created_at timestamptz
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
           u.invited_at, u.last_sign_in_at, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.is_active desc, lower(coalesce(nullif(p.full_name, ''), p.display_name));
end;
$$;
revoke execute on function public.list_staff() from public, anon;
grant execute on function public.list_staff() to authenticated;

-- Safety rules for role and on/off changes. Runs after guard_profile_privileges
-- (trigger names sort alphabetically: profiles_guard_* before profiles_protect_*).
create or replace function public.protect_staff_admins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role_key is not distinct from old.role_key and new.is_active is not distinct from old.is_active then
    return new;
  end if;

  if new.id = (select auth.uid()) then
    raise exception 'You can''t change your own role or switch off your own account. Ask another administrator.'
      using errcode = '42501';
  end if;

  -- Losing staff administration (role change or switched off): keep at least one other active administrator.
  if old.is_active
     and exists (select 1 from public.role_permissions rp where rp.role_key = old.role_key and rp.permission_key = 'staff.manage')
     and not (new.is_active and exists (select 1 from public.role_permissions rp where rp.role_key = new.role_key and rp.permission_key = 'staff.manage'))
     and not exists (
       select 1 from public.profiles p
       join public.role_permissions rp on rp.role_key = p.role_key and rp.permission_key = 'staff.manage'
       where p.is_active and p.id <> old.id
     ) then
    raise exception 'This is the last administrator. Make someone else an administrator first.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_admins before update on public.profiles
  for each row execute function public.protect_staff_admins();

-- Activity log for role and on/off changes made by a signed-in administrator.
-- (Invitations are logged by /api/staff-invite with the inviting administrator as actor.)
create or replace function public.log_staff_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text := coalesce(nullif(new.full_name, ''), nullif(new.display_name, ''), 'a staff member');
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.is_active is distinct from old.is_active then
    insert into public.activity_logs (actor_id, module, action, entity_type, entity_id, summary, metadata)
    values ((select auth.uid()), 'system', case when new.is_active then 'staff.activated' else 'staff.deactivated' end,
            'profile', new.id::text,
            case when new.is_active then 'Switched on the account of ' else 'Switched off the account of ' end || who,
            jsonb_build_object('role', new.role_key));
  end if;
  if new.role_key is distinct from old.role_key then
    insert into public.activity_logs (actor_id, module, action, entity_type, entity_id, summary, metadata)
    values ((select auth.uid()), 'system', 'staff.role_changed', 'profile', new.id::text,
            'Changed the role of ' || who || ' to ' || new.role_key,
            jsonb_build_object('from', old.role_key, 'to', new.role_key));
  end if;
  return new;
end;
$$;

create trigger profiles_log_staff_change after update on public.profiles
  for each row execute function public.log_staff_change();

revoke execute on function public.protect_staff_admins() from public, anon, authenticated;
revoke execute on function public.log_staff_change() from public, anon, authenticated;
