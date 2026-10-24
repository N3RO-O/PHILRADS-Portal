-- =============================================================================
-- PHILRADS Staff Portal: archive staff and volunteer accounts (Staff page)
--
-- Archiving tidies away people who no longer help (swipe right on the Staff page,
-- with a few seconds to undo). An archived account is switched off and listed
-- under "Archived"; restoring brings it back to the list, still switched off.
--   * only staff administrators can archive or restore, never their own account;
--   * administrators can't be archived (change their role first);
--   * archive and restore are written to the activity log.
-- =============================================================================

alter table public.profiles add column archived_at timestamptz;
comment on column public.profiles.archived_at is 'Set when an administrator archives the account (always switched off while archived).';

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
  archived_at timestamptz
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
           u.invited_at, u.last_sign_in_at, p.created_at, p.archived_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.is_active desc, lower(coalesce(nullif(p.full_name, ''), p.display_name));
end;
$$;
revoke execute on function public.list_staff() from public, anon;
grant execute on function public.list_staff() to authenticated;

create or replace function public.protect_staff_admins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  archiving boolean := new.archived_at is not null and old.archived_at is null;
  archive_changed boolean := new.archived_at is distinct from old.archived_at;
begin
  -- An archived account is always switched off.
  if new.archived_at is not null then
    new.is_active := false;
  end if;

  if new.role_key is not distinct from old.role_key and new.is_active is not distinct from old.is_active and not archive_changed then
    return new;
  end if;

  if archive_changed and (select auth.uid()) is not null and not public.has_permission('staff.manage') then
    raise exception 'Only staff administrators can archive or restore accounts' using errcode = '42501';
  end if;

  if new.id = (select auth.uid()) then
    raise exception 'You can''t change your own role or switch off your own account. Ask another administrator.'
      using errcode = '42501';
  end if;

  if archiving and exists (select 1 from public.role_permissions rp where rp.role_key = new.role_key and rp.permission_key = 'staff.manage') then
    raise exception 'Administrators can''t be archived. Change their role first.' using errcode = '42501';
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
  if new.archived_at is distinct from old.archived_at then
    insert into public.activity_logs (actor_id, module, action, entity_type, entity_id, summary, metadata)
    values ((select auth.uid()), 'system', case when new.archived_at is not null then 'staff.archived' else 'staff.restored' end,
            'profile', new.id::text,
            case when new.archived_at is not null then 'Archived the account of ' else 'Restored the account of ' end || who,
            jsonb_build_object('role', new.role_key));
    return new; -- archiving also switches the account off; one log line is enough
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
