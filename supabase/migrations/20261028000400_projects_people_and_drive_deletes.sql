-- =============================================================================
-- PHILRADS Staff Portal: project donors and people to reach; deleting documentation everywhere
--
-- Projects (PHILRADS, 2026-10-27):
-- * Donor and partner are separate (projects.partner stays the partner).
-- * People to reach changes as a project goes on, and people reached beyond the plan are counted
--   separately (beneficiaries_additional). Changes to either show in the project's history.
--
-- Documentation:
-- * Deleting a file in the portal also moves it to Google Drive's trash (done by /api/drive/delete,
--   which records who and why here); deleting it in Drive takes it out of the portal
--   (/api/drive/sync reads Drive's change list, keeping its place in drive_connection).
-- =============================================================================

alter table public.projects
  add column donor text check (donor is null or length(donor) <= 200),
  add column beneficiaries_additional int not null default 0 check (beneficiaries_additional between 0 and 100000000);
comment on column public.projects.partner is 'Partner organisation (the donor is separate).';
comment on column public.projects.beneficiaries_target is 'People the project plans to reach; changes as the project goes on.';
comment on column public.projects.beneficiaries_additional is 'People reached beyond the plan.';

create or replace function public.log_project_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_label text;
begin
  if tg_op = 'INSERT' then
    perform public.write_log('projects', 'project.created', public.person_name(coalesce(v_actor, new.created_by)) || ' started the project “' || new.name || '”',
      'project', new.id::text, jsonb_build_object('status', new.status), 'everyone', coalesce(v_actor, new.created_by));
    return new;
  end if;
  if new.status is distinct from old.status then
    v_label := case new.status when 'active' then 'active' when 'on_hold' then 'on hold' when 'completed' then 'completed' when 'cancelled' then 'cancelled' else 'planned' end;
    perform public.write_log('projects', 'project.status', public.person_name(v_actor) || ' marked “' || new.name || '” ' || v_label,
      'project', new.id::text, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.beneficiaries_target is distinct from old.beneficiaries_target then
    perform public.write_log('projects', 'project.people_to_reach',
      public.person_name(v_actor) || ' changed people to reach for “' || new.name || '” from ' ||
        coalesce(to_char(old.beneficiaries_target, 'FM999,999,999'), 'none') || ' to ' || coalesce(to_char(new.beneficiaries_target, 'FM999,999,999'), 'none'),
      'project', new.id::text, jsonb_build_object('from', old.beneficiaries_target, 'to', new.beneficiaries_target));
  end if;
  if new.beneficiaries_additional is distinct from old.beneficiaries_additional then
    perform public.write_log('projects', 'project.additional_beneficiaries',
      public.person_name(v_actor) || ' changed additional beneficiaries for “' || new.name || '” from ' ||
        to_char(old.beneficiaries_additional, 'FM999,999,999') || ' to ' || to_char(new.beneficiaries_additional, 'FM999,999,999'),
      'project', new.id::text, jsonb_build_object('from', old.beneficiaries_additional, 'to', new.beneficiaries_additional));
  end if;
  return new;
end;
$$;
drop trigger if exists projects_log on public.projects;
create trigger projects_log after insert or update of status, beneficiaries_target, beneficiaries_additional on public.projects
  for each row execute function public.log_project_change();
revoke execute on function public.log_project_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Documentation deletes, both ways
-- ---------------------------------------------------------------------------
alter table public.documents
  add column removed_reason text check (removed_reason is null or removed_reason in ('portal', 'drive'));
comment on column public.documents.removed_reason is 'portal: deleted in the portal (moved to Drive''s trash too). drive: deleted in Google Drive.';

alter table public.drive_connection
  add column changes_page_token text,
  add column changes_synced_at timestamptz;
comment on column public.drive_connection.changes_page_token is 'Where the server is in Google Drive''s change list (to notice files deleted in Drive).';

create or replace function public.log_document_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := coalesce((select auth.uid()), new.removed_by, new.uploaded_by);
begin
  if tg_op = 'INSERT' then
    perform public.write_log('documentation', 'document.uploaded',
      public.person_name(new.uploaded_by) || ' uploaded “' || new.title || '” (' || new.category || ')',
      'document', new.id::text,
      jsonb_build_object('category', new.category, 'size_bytes', new.size_bytes, 'mime_type', new.mime_type, 'drive_path', new.drive_path, 'ims_event', new.ims_event_name),
      'everyone', new.uploaded_by);
  elsif new.removed_at is not null and old.removed_at is null then
    if new.removed_reason = 'drive' then
      perform public.write_log('documentation', 'document.deleted_in_drive',
        '“' || new.title || '” was deleted in Google Drive, so it''s gone from the portal too',
        'document', new.id::text, jsonb_build_object('uploaded_by', new.uploaded_by, 'drive_path', new.drive_path), 'everyone', new.uploaded_by);
    else
      perform public.write_log('documentation', 'document.removed',
        public.person_name(v_actor) || ' deleted “' || new.title || '”' || case when new.removed_reason = 'portal' then ' (moved to Google Drive’s trash)' else '' end,
        'document', new.id::text, jsonb_build_object('uploaded_by', new.uploaded_by, 'drive_path', new.drive_path), 'everyone', v_actor);
    end if;
  elsif (new.title, new.category, new.notes, new.taken_on, new.ims_event_id, new.map_place_id)
        is distinct from (old.title, old.category, old.notes, old.taken_on, old.ims_event_id, old.map_place_id) then
    perform public.write_log('documentation', 'document.updated',
      public.person_name(v_actor) || ' updated “' || new.title || '”',
      'document', new.id::text, jsonb_build_object('was', old.title), 'everyone', v_actor);
  end if;
  return new;
end;
$$;
revoke execute on function public.log_document_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: everyone can describe themselves (PHILRADS, 2026-10-27)
-- The picture is kept here as a small square image (the portal shrinks it to 256 px before
-- saving), so it's only visible to signed-in staff, never on a public file host.
-- Colleagues see profiles (profiles_read); only you, or a staff administrator, can change yours.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column job_title text check (job_title is null or length(job_title) <= 100),
  add column phone text check (phone is null or phone ~ '^[0-9+() .-]{5,30}$'),
  add column bio text check (bio is null or length(bio) <= 500),
  add column avatar_data text check (avatar_data is null or (avatar_data ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' and length(avatar_data) <= 300000)),
  add column avatar_color text check (avatar_color is null or avatar_color ~ '^#[0-9a-fA-F]{6}$');
comment on column public.profiles.avatar_data is 'Profile picture: a small square image (data URL, at most ~220 kB).';
comment on column public.profiles.avatar_color is 'Colour of the initials badge when there''s no picture.';
