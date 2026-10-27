-- =============================================================================
-- PHILRADS Staff Portal: Home figures follow the modules as they are now (PHILRADS, 2026-10-27)
--
-- get_dashboard_summary() was written before Documentation, Projects and the IMS link existed:
-- * Documentation updates counted deleted files too: now only files still in the portal.
-- * Projects: planned and on-hold projects count as well as active ones (they're all open).
-- * Upcoming deadlines: project milestones and report dates, not only tasks.
-- * Inventory alerts and response activity come from the PHILRADS IMS snapshot, which the
--   portal reads itself (src/services/dashboard/supabaseDashboardService.ts); the old
--   inventory_items and response_activities tables are no longer filled.
-- =============================================================================

create or replace function public.get_dashboard_summary()
returns table (metric text, value bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'active_projects'::text, count(*) from public.projects where status in ('planned', 'active', 'on_hold')
  union all
  select 'pending_tasks', count(*) from public.tasks where status in ('todo', 'in_progress', 'review')
  union all
  select 'documentation_updates', count(*) from public.documents where removed_at is null and uploaded_at >= now() - interval '7 days'
  union all
  select 'upcoming_deadlines',
    (select count(*) from public.tasks
      where status not in ('done', 'cancelled') and due_date between current_date and current_date + 14)
    + (select count(*) from public.project_milestones m
      join public.projects p on p.id = m.project_id
      where not m.done and p.status not in ('completed', 'cancelled') and m.due_date between current_date and current_date + 14);
$$;
revoke execute on function public.get_dashboard_summary() from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated;
