-- =============================================================================
-- PHILRADS Staff Portal: administrators can see and join every project's team chat
--
-- * Before: only the project's lead and members could read or post (20261120000000_project_chat.sql).
-- * Now: people who can manage all projects (the projects.manage permission, i.e. administrators)
--   can too, on every project. Posting still only while the project is active.
-- * Bell notifications for new messages still go to the team only, so administrators aren't
--   notified about every chat; they see unread counts when they open a project.
-- =============================================================================

begin;

/** Can use the project's chat: an active staff account that is its lead, a member, or an administrator (projects.manage). */
create or replace function public.on_project_team(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.is_active_staff()) and (
    public.has_permission('projects.manage')
    or exists (select 1 from public.project_members m where m.project_id = p_project and m.profile_id = (select auth.uid()))
    or exists (select 1 from public.projects p where p.id = p_project and p.lead_id = (select auth.uid()))
  );
$$;
comment on function public.on_project_team(uuid) is 'Project chat access: lead, members, or administrators (projects.manage).';

commit;
