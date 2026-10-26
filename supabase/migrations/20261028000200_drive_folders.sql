-- =============================================================================
-- PHILRADS Staff Portal: the Documentation folders the portal made in Google Drive
--
-- Uploads are filed as <Documentation folder> / <uploader> / <category> / <day> (PHILRADS,
-- 2026-10-26): one folder per person, one per category inside it, one per upload day inside that.
-- Google Drive's search only sees a new folder after a few seconds, so several photos uploaded
-- together each made their own folder. The server now records every folder it makes here and
-- looks it up here first; one upload "claims" a folder before creating it so two can't both make it.
-- Server only (the upload function); no browser access.
-- =============================================================================

create table public.drive_folders (
  parent_id text not null,
  -- What the folder is for: philradsStaffId (a person), philradsCategory, philradsDay.
  tag_key text not null check (tag_key in ('philradsStaffId', 'philradsCategory', 'philradsDay')),
  tag_value text not null check (length(tag_value) between 1 and 100),
  -- Null while the upload that claimed it is still creating it.
  folder_id text check (folder_id is null or folder_id ~ '^[A-Za-z0-9_-]{10,100}$'),
  name text,
  claimed_at timestamptz not null default now(),
  primary key (parent_id, tag_key, tag_value)
);
create index drive_folders_folder_idx on public.drive_folders (folder_id);
comment on table public.drive_folders is 'Drive folders made for Documentation uploads (person / category / day), so each is made once. Server only.';
alter table public.drive_folders enable row level security;
revoke all on public.drive_folders from authenticated, anon;
