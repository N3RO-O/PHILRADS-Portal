-- Active list: each person shows who gave them their open tasks (up to three, the latest first),
-- as small pictures beside their name. The board gains a "givers" column; a new return type
-- means dropping and re-creating the function (and its grants).

drop function if exists public.staff_task_board();
create function public.staff_task_board()
returns table (profile_id uuid, name text, role_key text, role_name text, open_count int, in_progress int, overdue int, pending int, done_week int, givers uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(nullif(p.display_name, ''), p.full_name, 'Staff member'), p.role_key, r.name,
    count(t.id) filter (where t.status in ('todo', 'review') and t.acceptance <> 'declined')::int,
    count(t.id) filter (where t.status = 'in_progress')::int,
    count(t.id) filter (where t.status not in ('done', 'cancelled') and t.acceptance <> 'declined'
                          and t.due_date < (now() at time zone 'Asia/Manila')::date)::int,
    count(t.id) filter (where t.acceptance = 'pending' and t.status not in ('done', 'cancelled'))::int,
    count(t.id) filter (where t.status = 'done' and t.completed_at > now() - interval '7 days')::int,
    coalesce((
      select array_agg(g.created_by order by g.latest desc)
      from (
        select t2.created_by, max(t2.created_at) as latest
        from public.tasks t2
        where t2.assignee_id = p.id
          and t2.status not in ('done', 'cancelled')
          and t2.acceptance <> 'declined'
          and t2.created_by is not null
          and t2.created_by <> p.id
        group by t2.created_by
        order by max(t2.created_at) desc
        limit 3
      ) g
    ), '{}')
  from public.profiles p
  left join public.roles r on r.key = p.role_key
  left join public.tasks t on t.assignee_id = p.id and t.status <> 'cancelled'
  where p.is_active and public.is_active_staff()
  group by p.id, p.display_name, p.full_name, p.role_key, r.name
  order by 2
$$;
revoke execute on function public.staff_task_board() from public, anon;
grant execute on function public.staff_task_board() to authenticated;
