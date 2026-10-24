-- =============================================================================
-- PHILRADS Staff Portal: Volunteer role (placeholder, TBC)
--
-- Volunteers help on the ground: they see their own tasks, stock levels, response
-- activities and Resources, and can upload field photos and documents. Unlike staff,
-- they can't record stock movements or read the activity log.
-- =============================================================================
insert into public.roles (key, name, description) values
  ('volunteer', 'Volunteer (placeholder)', 'Field volunteers: own tasks, read stock and response, upload documents. TBC')
on conflict (key) do nothing;

insert into public.role_permissions (role_key, permission_key) values
  ('volunteer', 'inventory.read'),
  ('volunteer', 'response.read'),
  ('volunteer', 'documents.upload'),
  ('volunteer', 'resources.read')
on conflict do nothing;
