-- Avatar frames: an animated ring around someone's picture (like Discord's decorations), chosen
-- on their own profile. The 20 frames are drawn by the portal (src/lib/avatarFrames.ts); the
-- database keeps only the frame's name. Only the person changes it (guard_profile_owner).

alter table public.profiles
  add column avatar_frame text check (avatar_frame is null or avatar_frame ~ '^[a-z][a-z-]{1,23}$');
-- Readable like the picture (the table's columns are granted one by one since profile privacy).
grant select (avatar_frame) on public.profiles to authenticated;

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
  if (new.full_name, new.display_name, new.job_title, new.office, new.phone, new.bio, new.avatar_data, new.avatar_color, new.avatar_frame, new.profile_public)
     is distinct from
     (old.full_name, old.display_name, old.job_title, old.office, old.phone, old.bio, old.avatar_data, old.avatar_color, old.avatar_frame, old.profile_public) then
    raise exception 'Only the person can change their own profile.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.view_profile(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  v_me uuid := (select auth.uid());
  v_full boolean;
  v_role text;
begin
  if not (p_id = v_me or public.is_active_staff()) then
    return null;
  end if;
  select * into p from public.profiles where id = p_id;
  if not found then
    return null;
  end if;
  select name into v_role from public.roles where key = p.role_key;
  v_full := p.id = v_me or p.profile_public or public.has_permission('staff.manage');
  return jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'full_name', p.full_name,
    'role_key', p.role_key,
    'role_name', v_role,
    'is_active', p.is_active,
    'avatar_data', p.avatar_data,
    'avatar_color', p.avatar_color,
    'avatar_frame', p.avatar_frame,
    'profile_public', p.profile_public,
    'details', v_full,
    'created_at', case when v_full then p.created_at end,
    'job_title', case when v_full then p.job_title end,
    'office', case when v_full then p.office end,
    'phone', case when v_full then p.phone end,
    'bio', case when v_full then p.bio end
  );
end;
$$;
