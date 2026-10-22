-- =============================================================================
-- PHILRADS Staff Portal: who sees "Add served" on relief events (placeholder, TBC)
--
-- Served beneficiaries are recorded in PHILRADS IMS, area by area, through the IMS
-- window the portal opens (prds-ims: public/portal_action.php). The IMS decides for
-- real: only its administrators and warehouse managers can add them. This
-- permission only controls whether the portal offers the button, so it mirrors that:
-- administrators and coordinators by default.
-- Release approvals in the portal use the existing inventory.approve permission.
-- =============================================================================
insert into public.permissions (key, description) values
  ('beneficiaries.record', 'Add served beneficiaries to relief events (in PHILRADS IMS) (TBC)')
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values
  ('admin', 'beneficiaries.record'),
  ('coordinator', 'beneficiaries.record')
on conflict do nothing;
