-- =============================================================================
-- PHILRADS Staff Portal: initial schema
--
-- * Every table that holds application data has Row Level Security enabled.
-- * Access is decided by a configurable role -> permission model.
--   The seeded roles and permissions are PLACEHOLDERS (is_confirmed = false):
--   PHILRADS has not yet confirmed its real staff roles. Review them before
--   go-live (see docs/roles-and-permissions.md).
-- * New sign-ups get an INACTIVE profile; an administrator must activate them.
-- * No real staff or beneficiary data is seeded here.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles and permissions (configurable)
-- ---------------------------------------------------------------------------
create table public.roles (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text,
  is_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.roles is 'Staff roles. Rows with is_confirmed = false are placeholders awaiting PHILRADS confirmation (TBC).';

create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null,
  is_confirmed boolean not null default false
);
comment on table public.permissions is 'Permission catalogue. Rows with is_confirmed = false are proposals (TBC).';

create table public.role_permissions (
  role_key text not null references public.roles (key) on update cascade on delete cascade,
  permission_key text not null references public.permissions (key) on update cascade on delete cascade,
  primary key (role_key, permission_key)
);

-- Placeholder catalogue (TBC). Safe to edit: policies only reference permission keys.
insert into public.permissions (key, description) values
  ('projects.read_all',   'See every project, not only those you belong to (TBC)'),
  ('projects.manage',     'Create and edit projects and their members (TBC)'),
  ('tasks.read_all',      'See every task (TBC)'),
  ('tasks.manage',        'Edit or delete any task (TBC)'),
  ('inventory.read',      'See inventory items and movements (TBC)'),
  ('inventory.record',    'Record receipts, releases, transfers and adjustments (TBC)'),
  ('inventory.manage',    'Create and edit inventory items (TBC)'),
  ('response.read',       'See response activities (TBC)'),
  ('response.manage',     'Create and edit response activities (TBC)'),
  ('documents.read_all',  'See all document records (TBC)'),
  ('documents.upload',    'Upload documents (TBC)'),
  ('documents.manage',    'Edit or delete document records (TBC)'),
  ('activity.read',       'See the activity log (TBC)'),
  ('staff.manage',        'Activate staff accounts and assign roles (TBC)'),
  ('settings.manage',     'Change application settings and Drive destinations (TBC)');

insert into public.roles (key, name, description) values
  ('admin',       'Administrator (placeholder)', 'Full access. TBC'),
  ('coordinator', 'Coordinator (placeholder)',   'Manages projects, tasks and response. TBC'),
  ('staff',       'Staff (placeholder)',         'Day-to-day staff access. TBC'),
  ('viewer',      'Viewer (placeholder)',        'Read-only access. TBC');

insert into public.role_permissions (role_key, permission_key)
select 'admin', key from public.permissions;

insert into public.role_permissions (role_key, permission_key) values
  ('coordinator', 'projects.read_all'), ('coordinator', 'projects.manage'),
  ('coordinator', 'tasks.read_all'),    ('coordinator', 'tasks.manage'),
  ('coordinator', 'inventory.read'),    ('coordinator', 'inventory.record'),
  ('coordinator', 'response.read'),     ('coordinator', 'response.manage'),
  ('coordinator', 'documents.read_all'),('coordinator', 'documents.upload'),
  ('coordinator', 'activity.read'),
  ('staff', 'inventory.read'), ('staff', 'inventory.record'),
  ('staff', 'response.read'),  ('staff', 'documents.upload'),
  ('staff', 'activity.read'),
  ('viewer', 'inventory.read'), ('viewer', 'response.read'), ('viewer', 'activity.read');

-- ---------------------------------------------------------------------------
-- Staff profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  display_name text not null default '',
  role_key text not null default 'staff' references public.roles (key) on update cascade,
  office text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.is_active is 'Inactive accounts can sign in but see no data until an administrator activates them.';

create index profiles_role_key_idx on public.profiles (role_key);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Permission helpers. SECURITY DEFINER so policies can read profiles/role_permissions
-- without recursive RLS; they only ever answer questions about the calling user.
create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_key = p.role_key
    where p.id = (select auth.uid())
      and p.is_active
      and rp.permission_key = p_permission
  );
$$;

-- Create a profile for every new auth user (inactive by default).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only staff administrators (or the service role / SQL editor) may change role or activation.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role_key is distinct from old.role_key or new.is_active is distinct from old.is_active)
     and coalesce((select auth.role()), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin')
     and not public.has_permission('staff.manage') then
    raise exception 'Only staff administrators can change roles or account activation'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null check (length(trim(name)) > 0),
  description text,
  program_area text,
  status text not null default 'planned'
    check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  start_date date,
  end_date date,
  lead_id uuid references public.profiles (id) on delete set null,
  drive_folder_id text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);
create index projects_status_idx on public.projects (status, updated_at desc);
create index projects_lead_id_idx on public.projects (lead_id);
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'member',
  added_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index project_members_profile_idx on public.project_members (profile_id);

create or replace function public.is_project_member(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.profile_id = (select auth.uid())
  ) or exists (
    select 1 from public.projects p
    where p.id = p_project and p.lead_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done', 'cancelled')),
  module text check (module in ('live-map', 'inventory', 'pdm', 'documentation', 'response', 'projects', 'tasks', 'print-docs')),
  due_date date,
  project_id uuid references public.projects (id) on delete set null,
  assignee_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_assignee_idx on public.tasks (assignee_id, status, due_date);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_created_by_idx on public.tasks (created_by);
create index tasks_due_idx on public.tasks (due_date) where status not in ('done', 'cancelled');
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null check (length(trim(name)) > 0),
  category text,
  unit text not null default 'pcs',
  location text,
  reorder_level numeric(14, 2) not null default 0 check (reorder_level >= 0),
  -- Maintained only by the inventory_movements trigger.
  quantity_on_hand numeric(14, 2) not null default 0 check (quantity_on_hand >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inventory_items_active_idx on public.inventory_items (is_active, name);
create trigger inventory_items_set_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();

create table public.response_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  -- Activity types are not yet confirmed by PHILRADS; kept as free text for now (TBC).
  activity_type text,
  status text not null default 'ongoing' check (status in ('planned', 'ongoing', 'completed', 'cancelled')),
  location_name text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  summary text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  project_id uuid references public.projects (id) on delete set null,
  lead_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint response_dates_check check (ended_at is null or ended_at >= started_at)
);
create index response_started_idx on public.response_activities (started_at desc);
create index response_project_idx on public.response_activities (project_id);
create trigger response_activities_set_updated_at before update on public.response_activities
  for each row execute function public.set_updated_at();

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete restrict,
  movement_type text not null check (movement_type in ('receipt', 'release', 'transfer_in', 'transfer_out', 'adjustment')),
  quantity_change numeric(14, 2) not null check (quantity_change <> 0),
  reference text,
  notes text,
  project_id uuid references public.projects (id) on delete set null,
  response_activity_id uuid references public.response_activities (id) on delete set null,
  recorded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint movement_sign_check check (
    (movement_type in ('receipt', 'transfer_in') and quantity_change > 0)
    or (movement_type in ('release', 'transfer_out') and quantity_change < 0)
    or movement_type = 'adjustment'
  )
);
comment on table public.inventory_movements is 'Append-only stock ledger. Correct mistakes with an adjustment, never by editing rows.';
create index inventory_movements_item_idx on public.inventory_movements (item_id, occurred_at desc);
create index inventory_movements_response_idx on public.inventory_movements (response_activity_id);
create index inventory_movements_project_idx on public.inventory_movements (project_id);

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inventory_items
     set quantity_on_hand = quantity_on_hand + new.quantity_change
   where id = new.item_id;
  return new;
end;
$$;

create trigger inventory_movements_apply after insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

-- ---------------------------------------------------------------------------
-- Documents (file content lives in Google Drive; metadata lives here)
-- ---------------------------------------------------------------------------
create table public.drive_destinations (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('live-map', 'inventory', 'pdm', 'documentation', 'response', 'projects', 'tasks', 'print-docs')),
  category text,
  project_id uuid references public.projects (id) on delete cascade,
  drive_folder_id text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index drive_destinations_unique_idx
  on public.drive_destinations (module, coalesce(category, ''), coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid));
create trigger drive_destinations_set_updated_at before update on public.drive_destinations
  for each row execute function public.set_updated_at();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  category text not null,
  module text not null check (module in ('live-map', 'inventory', 'pdm', 'documentation', 'response', 'projects', 'tasks', 'print-docs')),
  mime_type text not null,
  size_bytes bigint check (size_bytes >= 0),
  storage text not null default 'google_drive' check (storage in ('google_drive')),
  drive_file_id text not null unique,
  drive_folder_id text,
  project_id uuid references public.projects (id) on delete set null,
  response_activity_id uuid references public.response_activities (id) on delete set null,
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.documents.drive_file_id is 'Google Drive file id. Files are shared with authorised accounts only, never via public links by default.';
create index documents_uploaded_idx on public.documents (uploaded_at desc);
create index documents_project_idx on public.documents (project_id);
create index documents_response_idx on public.documents (response_activity_id);
create index documents_uploaded_by_idx on public.documents (uploaded_by);
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notifications, activity log, settings
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  link_path text check (link_path is null or link_path like '/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null default auth.uid(),
  module text not null check (module in ('live-map', 'inventory', 'pdm', 'documentation', 'response', 'projects', 'tasks', 'print-docs', 'system')),
  action text not null,
  entity_type text,
  entity_id text,
  summary text not null,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_actor_idx on public.activity_logs (actor_id);

create table public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]*$'),
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.roles               enable row level security;
alter table public.permissions         enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.profiles            enable row level security;
alter table public.projects            enable row level security;
alter table public.project_members     enable row level security;
alter table public.tasks               enable row level security;
alter table public.inventory_items     enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.response_activities enable row level security;
alter table public.drive_destinations  enable row level security;
alter table public.documents           enable row level security;
alter table public.notifications       enable row level security;
alter table public.activity_logs       enable row level security;
alter table public.app_settings        enable row level security;

-- Role model: readable by active staff, managed by staff administrators.
create policy roles_read on public.roles for select to authenticated using ((select public.is_active_staff()));
create policy roles_manage on public.roles for all to authenticated
  using ((select public.has_permission('staff.manage'))) with check ((select public.has_permission('staff.manage')));
create policy permissions_read on public.permissions for select to authenticated using ((select public.is_active_staff()));
create policy permissions_manage on public.permissions for all to authenticated
  using ((select public.has_permission('staff.manage'))) with check ((select public.has_permission('staff.manage')));
create policy role_permissions_read on public.role_permissions for select to authenticated using ((select public.is_active_staff()));
create policy role_permissions_manage on public.role_permissions for all to authenticated
  using ((select public.has_permission('staff.manage'))) with check ((select public.has_permission('staff.manage')));

-- Profiles: you can always see your own; active staff see colleagues (names for assignment).
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_active_staff()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.has_permission('staff.manage')))
  with check (id = (select auth.uid()) or (select public.has_permission('staff.manage')));
-- Inserts come from the auth trigger; deletes cascade from auth.users. No client policies for either.

-- Projects
create policy projects_read on public.projects for select to authenticated
  using ((select public.has_permission('projects.read_all')) or ((select public.is_active_staff()) and public.is_project_member(id)));
create policy projects_insert on public.projects for insert to authenticated
  with check ((select public.has_permission('projects.manage')));
create policy projects_update on public.projects for update to authenticated
  using ((select public.has_permission('projects.manage'))) with check ((select public.has_permission('projects.manage')));
create policy projects_delete on public.projects for delete to authenticated
  using ((select public.has_permission('projects.manage')));

create policy project_members_read on public.project_members for select to authenticated
  using (
    (select public.is_active_staff())
    and (profile_id = (select auth.uid()) or (select public.has_permission('projects.read_all')) or public.is_project_member(project_id))
  );
create policy project_members_manage on public.project_members for all to authenticated
  using ((select public.has_permission('projects.manage'))) with check ((select public.has_permission('projects.manage')));

-- Tasks: yours (assigned or created), your projects', or everything with tasks.read_all.
create policy tasks_read on public.tasks for select to authenticated
  using (
    (select public.is_active_staff()) and (
      assignee_id = (select auth.uid())
      or created_by = (select auth.uid())
      or (select public.has_permission('tasks.read_all'))
      or (project_id is not null and public.is_project_member(project_id))
    )
  );
create policy tasks_insert on public.tasks for insert to authenticated
  with check ((select public.is_active_staff()) and created_by = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (
    (select public.is_active_staff())
    and (assignee_id = (select auth.uid()) or created_by = (select auth.uid()) or (select public.has_permission('tasks.manage')))
  )
  with check (
    (select public.is_active_staff())
    and (assignee_id = (select auth.uid()) or created_by = (select auth.uid()) or (select public.has_permission('tasks.manage')))
  );
create policy tasks_delete on public.tasks for delete to authenticated
  using ((select public.has_permission('tasks.manage')));

-- Inventory
create policy inventory_items_read on public.inventory_items for select to authenticated
  using ((select public.has_permission('inventory.read')));
create policy inventory_items_manage on public.inventory_items for all to authenticated
  using ((select public.has_permission('inventory.manage'))) with check ((select public.has_permission('inventory.manage')));

create policy inventory_movements_read on public.inventory_movements for select to authenticated
  using ((select public.has_permission('inventory.read')));
create policy inventory_movements_insert on public.inventory_movements for insert to authenticated
  with check ((select public.has_permission('inventory.record')) and recorded_by = (select auth.uid()));
-- No update/delete policies: the ledger is append-only.

-- Response
create policy response_read on public.response_activities for select to authenticated
  using ((select public.has_permission('response.read')));
create policy response_insert on public.response_activities for insert to authenticated
  with check ((select public.has_permission('response.manage')) and created_by = (select auth.uid()));
create policy response_update on public.response_activities for update to authenticated
  using ((select public.has_permission('response.manage'))) with check ((select public.has_permission('response.manage')));
create policy response_delete on public.response_activities for delete to authenticated
  using ((select public.has_permission('response.manage')));

-- Documents
create policy drive_destinations_read on public.drive_destinations for select to authenticated
  using ((select public.is_active_staff()));
create policy drive_destinations_manage on public.drive_destinations for all to authenticated
  using ((select public.has_permission('settings.manage'))) with check ((select public.has_permission('settings.manage')));

create policy documents_read on public.documents for select to authenticated
  using (
    (select public.is_active_staff()) and (
      uploaded_by = (select auth.uid())
      or (select public.has_permission('documents.read_all'))
      or (project_id is not null and public.is_project_member(project_id))
    )
  );
create policy documents_insert on public.documents for insert to authenticated
  with check ((select public.has_permission('documents.upload')) and uploaded_by = (select auth.uid()));
create policy documents_update on public.documents for update to authenticated
  using ((select public.has_permission('documents.manage'))) with check ((select public.has_permission('documents.manage')));
create policy documents_delete on public.documents for delete to authenticated
  using ((select public.has_permission('documents.manage')));

-- Notifications: only your own. Created server-side (service role / triggers).
create policy notifications_read on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));
-- Clients may only change read_at.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Activity log: append-only.
create policy activity_read on public.activity_logs for select to authenticated
  using ((select public.has_permission('activity.read')));
create policy activity_insert on public.activity_logs for insert to authenticated
  with check ((select public.is_active_staff()) and actor_id = (select auth.uid()));

-- Settings
create policy app_settings_read on public.app_settings for select to authenticated
  using ((select public.is_active_staff()));
create policy app_settings_manage on public.app_settings for all to authenticated
  using ((select public.has_permission('settings.manage'))) with check ((select public.has_permission('settings.manage')));

-- Nothing is readable without signing in.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Dashboard functions (SECURITY INVOKER: results respect the caller's RLS)
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_summary()
returns table (metric text, value bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'active_projects'::text, count(*) from public.projects where status = 'active'
  union all
  select 'pending_tasks', count(*) from public.tasks where status in ('todo', 'in_progress', 'review')
  union all
  select 'inventory_alerts', count(*) from public.inventory_items where is_active and quantity_on_hand < reorder_level
  union all
  select 'response_activities', count(*) from public.response_activities where started_at >= now() - interval '30 days'
  union all
  select 'documentation_updates', count(*) from public.documents where uploaded_at >= now() - interval '7 days'
  union all
  select 'upcoming_deadlines', count(*) from public.tasks
    where status not in ('done', 'cancelled') and due_date between current_date and current_date + 14;
$$;

create or replace function public.get_weekly_response_counts(p_weeks integer default 8)
returns table (week_start date, activity_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with weeks as (
    select (date_trunc('week', now()) - make_interval(weeks => g))::date as week_start
    from generate_series(least(greatest(p_weeks, 1), 52) - 1, 0, -1) as g
  )
  select w.week_start, count(r.id)
  from weeks w
  left join public.response_activities r
    on r.started_at >= w.week_start and r.started_at < w.week_start + 7
  group by w.week_start
  order by w.week_start;
$$;

-- Function privileges: signed-in staff only.
revoke execute on function public.get_dashboard_summary() from public, anon;
revoke execute on function public.get_weekly_response_counts(integer) from public, anon;
revoke execute on function public.has_permission(text) from public, anon;
revoke execute on function public.is_active_staff() from public, anon;
revoke execute on function public.is_project_member(uuid) from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated;
grant execute on function public.get_weekly_response_counts(integer) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
-- Trigger-only functions are not callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.apply_inventory_movement() from public, anon, authenticated;
