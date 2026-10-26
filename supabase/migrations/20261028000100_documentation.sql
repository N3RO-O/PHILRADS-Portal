-- =============================================================================
-- PHILRADS Staff Portal: Documentation (field photos, videos and reports in Google Drive)
--
-- * Files go into one Google Drive folder that PHILRADS connects once (an administrator signs in
--   with Google; the folder is shared with that account as Editor), filed as
--   <folder> / <uploader's name> / <category> / file.
-- * The portal keeps a record of each file (documents). Records are written only by the server
--   (/api/drive/*) after it has checked the file arrived in Drive, so a record never points at
--   nothing. Every active staff member (volunteers too) can see them; files are never public.
-- * The uploader (or documents.manage) can fix a record's title, category, notes and tags, or remove
--   it from the portal; removing keeps the file in Drive.
-- * The Drive connection (an encrypted refresh token) and upload sessions are server-only tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Records
-- ---------------------------------------------------------------------------
alter table public.documents
  add column notes text check (notes is null or length(notes) <= 1000),
  add column file_name text check (file_name is null or length(file_name) <= 255),
  add column taken_on date,
  add column ims_event_id text check (ims_event_id is null or length(ims_event_id) <= 64),
  add column ims_event_name text check (ims_event_name is null or length(ims_event_name) <= 200),
  add column map_place_id uuid references public.map_places (id) on delete set null,
  add column width int,
  add column height int,
  add column duration_ms bigint,
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id) on delete set null;
alter table public.documents add constraint documents_title_length check (length(title) <= 200);
alter table public.documents add constraint documents_category_check
  check (category in ('Photos', 'Videos', 'Reports', 'Assessments', 'Distribution records', 'Contracts and agreements', 'Other'));
create index documents_live_idx on public.documents (uploaded_at desc) where removed_at is null;
create index documents_event_idx on public.documents (ims_event_id) where ims_event_id is not null;
comment on column public.documents.ims_event_id is 'The PHILRADS IMS relief event this is evidence of (IMS id; the name is kept for display).';
comment on column public.documents.taken_on is 'When the photo, video or report was made (the uploader says; defaults to the upload day).';

-- Everyone active sees the record (PHILRADS, 2026-10-28); removed ones only documents.manage.
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated
  using (
    (select public.is_active_staff())
    and (removed_at is null or (select public.has_permission('documents.manage')))
  );
-- Records come only from the upload server, after it has seen the file in Drive.
drop policy if exists documents_insert on public.documents;
revoke insert on public.documents from authenticated, anon;
-- The uploader (or documents.manage) can correct the description; nothing about the file itself.
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated
  using ((select public.is_active_staff()) and (uploaded_by = (select auth.uid()) or (select public.has_permission('documents.manage'))))
  with check ((select public.is_active_staff()) and (uploaded_by = (select auth.uid()) or (select public.has_permission('documents.manage'))));
revoke update on public.documents from authenticated;
grant update (title, category, notes, taken_on, ims_event_id, ims_event_name, map_place_id) on public.documents to authenticated;
drop policy if exists documents_delete on public.documents;
revoke delete on public.documents from authenticated, anon;

-- Remove from the portal (the file stays in Drive, where an administrator can delete it).
create or replace function public.remove_document(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.documents%rowtype;
begin
  select * into d from public.documents where id = p_id and removed_at is null;
  if not found then
    raise exception 'That file is no longer in the portal.' using errcode = 'P0002';
  end if;
  if not public.is_active_staff() or not (d.uploaded_by = (select auth.uid()) or public.has_permission('documents.manage')) then
    raise exception 'Only the person who uploaded it, or an administrator, can remove it.' using errcode = '42501';
  end if;
  update public.documents set removed_at = now(), removed_by = (select auth.uid()) where id = p_id;
end;
$$;
revoke execute on function public.remove_document(uuid) from public, anon;
grant execute on function public.remove_document(uuid) to authenticated;

-- The activity feed: uploads, corrections, removals.
create or replace function public.log_document_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := coalesce((select auth.uid()), new.uploaded_by);
begin
  if tg_op = 'INSERT' then
    perform public.write_log('documentation', 'document.uploaded',
      public.person_name(new.uploaded_by) || ' uploaded “' || new.title || '” (' || new.category || ')',
      'document', new.id::text,
      jsonb_build_object('category', new.category, 'size_bytes', new.size_bytes, 'mime_type', new.mime_type, 'drive_path', new.drive_path, 'ims_event', new.ims_event_name),
      'everyone', new.uploaded_by);
  elsif new.removed_at is not null and old.removed_at is null then
    perform public.write_log('documentation', 'document.removed',
      public.person_name(v_actor) || ' removed “' || new.title || '” from the portal (still in Google Drive)',
      'document', new.id::text, jsonb_build_object('uploaded_by', new.uploaded_by, 'drive_path', new.drive_path), 'everyone', v_actor);
  elsif (new.title, new.category, new.notes, new.taken_on, new.ims_event_id, new.map_place_id)
        is distinct from (old.title, old.category, old.notes, old.taken_on, old.ims_event_id, old.map_place_id) then
    perform public.write_log('documentation', 'document.updated',
      public.person_name(v_actor) || ' updated “' || new.title || '”',
      'document', new.id::text, jsonb_build_object('was', old.title), 'everyone', v_actor);
  end if;
  return new;
end;
$$;
create trigger documents_log after insert or update on public.documents
  for each row execute function public.log_document_change();
revoke execute on function public.log_document_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The Google Drive connection (one), and uploads in progress: server only
-- ---------------------------------------------------------------------------
create table public.drive_connection (
  id int primary key default 1 check (id = 1),
  google_email text not null,
  folder_id text not null check (folder_id ~ '^[A-Za-z0-9_-]{10,100}$'),
  folder_name text,
  -- AES-GCM with a key only the server derives; never sent to a browser.
  refresh_token_enc text not null,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz not null default now(),
  last_error text,
  last_error_at timestamptz
);
comment on table public.drive_connection is 'The Google account and Drive folder Documentation uploads go to. Server only (no browser access).';
alter table public.drive_connection enable row level security;
revoke all on public.drive_connection from authenticated, anon;

create table public.drive_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  category text not null,
  notes text,
  taken_on date,
  ims_event_id text,
  ims_event_name text,
  map_place_id uuid references public.map_places (id) on delete set null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  folder_id text not null,
  drive_path text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  document_id uuid references public.documents (id) on delete set null
);
create index drive_upload_sessions_user_idx on public.drive_upload_sessions (user_id, created_at desc);
comment on table public.drive_upload_sessions is 'An upload the server opened in Drive; finished into a documents row once the file is there. Server only.';
alter table public.drive_upload_sessions enable row level security;
revoke all on public.drive_upload_sessions from authenticated, anon;

-- What the portal may show about the connection (no secrets).
create or replace function public.drive_status()
returns table (connected boolean, google_email text, folder_id text, folder_name text, connected_at timestamptz, last_error text, last_error_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select true, c.google_email, c.folder_id, c.folder_name, c.connected_at, c.last_error, c.last_error_at
  from public.drive_connection c
  where (select public.is_active_staff())
  union all
  select false, null, null, null, null, null, null
  where (select public.is_active_staff()) and not exists (select 1 from public.drive_connection)
$$;
revoke execute on function public.drive_status() from public, anon;
grant execute on function public.drive_status() to authenticated;
