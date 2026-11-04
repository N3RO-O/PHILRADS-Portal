-- The "PHILRADS Admin" avatar frame (avatar_frame = 'admin') is for administrators only.
-- Choosing it without the admin role is refused; when someone stops being an administrator,
-- the frame comes off on its own. The trigger's name sorts after profiles_guard_owner, so the
-- owner check sees the row before the frame is taken off (an administrator changing someone's
-- role is allowed to cause that).

create or replace function public.guard_admin_frame()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.avatar_frame = 'admin' and new.role_key is distinct from 'admin' then
    if tg_op = 'UPDATE' and old.avatar_frame = 'admin' and new.role_key is distinct from old.role_key then
      new.avatar_frame := null;
    else
      raise exception 'The PHILRADS Admin frame is for administrators.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_admin_frame() from public, anon, authenticated;

create trigger profiles_zz_admin_frame before insert or update of avatar_frame, role_key on public.profiles
  for each row execute function public.guard_admin_frame();
