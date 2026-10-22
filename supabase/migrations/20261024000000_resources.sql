-- =============================================================================
-- PHILRADS Staff Portal: Resources module + Google Drive folder rule
--
-- * resources: shared files and links (forms, policies, manuals, reports, brand
--   files) that staff open or download from Google Drive. Managed by staff with
--   resources.manage; everyone with resources.read can see them.
-- * Uploads are filed in Google Drive as  <Module> / <Uploader's name> / <Category>
--   (decided by PHILRADS on 2026-10-22). documents.drive_path records that path so
--   the portal can show where each file lives and who uploaded it.
-- =============================================================================

-- 'resources' joins the module lists.
alter table public.tasks drop constraint if exists tasks_module_check;
alter table public.tasks add constraint tasks_module_check
  check (module in ('live-map', 'inventory', 'pdm', 'documentation', 'response', 'projects', 'tasks', 'print-docs', 'resources'));
alter table public.drive_destinations drop constraint if exists drive_destinations_module_check;
alter table public.drive_destinations add constraint drive_destinations_module_check
  check (module in ('live-map', 'inventory', 'pdm', 'documentation', 'response', 'projects', 'tasks', 'print-docs', 'resources'));
alter table public.documents drop constraint if exists documents_module_check;
alter table public.documents add constraint documents_module_check
  check (module in ('live-map', 'inventory', 'pdm', 'documentation', 'response', 'projects', 'tasks', 'print-docs', 'resources'));
alter table public.activity_logs drop constraint if exists activity_logs_module_check;
alter table public.activity_logs add constraint activity_logs_module_check
  check (module in ('live-map', 'inventory', 'pdm', 'documentation', 'response', 'projects', 'tasks', 'print-docs', 'resources', 'system'));

-- Where an uploaded file sits in Drive, e.g. 'Documentation/Maria Santos/Photos'.
alter table public.documents add column drive_path text check (drive_path is null or length(drive_path) <= 400);
comment on column public.documents.drive_path is 'Drive folder path: <Module>/<Uploader name>/<Category>. Set by the upload function.';
comment on table public.drive_destinations is
  'Root Drive folder per module (category and project left null). Inside it, the upload function files by uploader name, then category.';

-- Permissions (placeholders, TBC)
insert into public.permissions (key, description) values
  ('resources.read',   'Open and download shared resources (TBC)'),
  ('resources.manage', 'Add, edit, pin and remove shared resources (TBC)')
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values
  ('admin', 'resources.read'), ('admin', 'resources.manage'),
  ('coordinator', 'resources.read'), ('coordinator', 'resources.manage'),
  ('staff', 'resources.read'),
  ('viewer', 'resources.read')
on conflict do nothing;

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  description text check (description is null or length(description) <= 500),
  category text not null check (category in (
    'Forms and templates', 'Policies and guidelines', 'Training and manuals',
    'Reports and publications', 'Brand and media', 'Other'
  )),
  -- https only: no javascript:, data: or plain-http links.
  url text not null check (url ~ '^https://[^\s/]+\.[^\s]+$' and length(url) <= 2000),
  kind text not null check (kind in ('drive_file', 'drive_folder', 'google_doc', 'google_sheet', 'google_slides', 'web')),
  file_type text check (file_type is null or file_type in ('PDF', 'Word', 'Excel', 'PowerPoint', 'Image', 'Video', 'Folder', 'Web page')),
  pinned boolean not null default false,
  -- Set when the resource was uploaded through the portal (then filed in Drive by uploader and category).
  document_id uuid references public.documents (id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index resources_url_active_unique on public.resources (url) where is_active;
create index resources_list_idx on public.resources (is_active, updated_at desc);
create trigger resources_set_updated_at before update on public.resources
  for each row execute function public.set_updated_at();

alter table public.resources enable row level security;
create policy resources_read on public.resources for select to authenticated
  using ((select public.has_permission('resources.read')));
create policy resources_insert on public.resources for insert to authenticated
  with check ((select public.has_permission('resources.manage')) and created_by = (select auth.uid()));
create policy resources_update on public.resources for update to authenticated
  using ((select public.has_permission('resources.manage'))) with check ((select public.has_permission('resources.manage')));
-- No delete policy: removing a resource sets is_active = false, so the history stays.
revoke delete on public.resources from authenticated;
revoke all on public.resources from anon;
-- Who added a resource can't be rewritten.
revoke update on public.resources from authenticated;
grant update (title, description, category, url, kind, file_type, pinned, is_active) on public.resources to authenticated;

-- Every change lands in the activity log: who added, edited or removed what.
create or replace function public.log_resource_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_logs (actor_id, module, action, entity_type, entity_id, summary, metadata)
  values (
    auth.uid(),
    'resources',
    case when tg_op = 'INSERT' then 'resource.added'
         when old.is_active and not new.is_active then 'resource.removed'
         else 'resource.updated' end,
    'resource',
    new.id::text,
    case when tg_op = 'INSERT' then 'Added resource '
         when old.is_active and not new.is_active then 'Removed resource '
         else 'Updated resource ' end || new.title,
    jsonb_build_object('category', new.category, 'url', new.url)
  );
  return new;
end;
$$;
create trigger resources_audit after insert or update on public.resources
  for each row execute function public.log_resource_change();
revoke execute on function public.log_resource_change() from public, anon, authenticated;
