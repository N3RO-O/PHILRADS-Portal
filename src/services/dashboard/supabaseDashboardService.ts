import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityItem,
  ActivityKind,
  ModuleId,
  SummaryKey,
  TaskPriority,
  TaskStatus,
} from '../../types';
import type { DashboardService } from './types';

/**
 * Live dashboard data. Every query runs as the signed-in staff member with the
 * anon key, so Row Level Security decides what they can see
 * (supabase/migrations/20261018000000_initial_schema.sql).
 */

const SUMMARY_KEYS: SummaryKey[] = [
  'active_projects',
  'pending_tasks',
  'inventory_alerts',
  'response_activities',
  'documentation_updates',
  'upcoming_deadlines',
];

const MODULE_TO_KIND: Record<string, ActivityKind> = {
  projects: 'project',
  inventory: 'inventory',
  documentation: 'document',
  tasks: 'task',
  response: 'response',
};

/** Turn a PostgREST error into a plain Error without leaking internals to the UI. */
function fail(context: string, error: { message: string; code?: string } | null): never {
  console.error(`[dashboard] ${context}`, error);
  throw new Error(`Could not load ${context}.`);
}

async function currentUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('You are signed out. Please sign in again.');
  return data.user.id;
}

export function createSupabaseDashboardService(client: SupabaseClient): DashboardService {
  return {
    source: 'supabase',

    async getSummary() {
      const { data, error } = await client.rpc('get_dashboard_summary');
      if (error) fail('overview counts', error);
      const rows = (data ?? []) as { metric: string; value: number | string }[];
      return SUMMARY_KEYS.map((key) => ({
        key,
        value: Number(rows.find((r) => r.metric === key)?.value ?? 0),
      }));
    },

    async getMyTasks() {
      const uid = await currentUserId(client);
      const { data, error } = await client
        .from('tasks')
        .select('id, title, priority, status, due_date, module')
        .eq('assignee_id', uid)
        .in('status', ['todo', 'in_progress', 'review'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(1000);
      if (error) fail('your tasks', error);
      return (data ?? []).map((t) => ({
        id: t.id as string,
        title: t.title as string,
        priority: t.priority as TaskPriority,
        status: t.status as TaskStatus,
        dueDate: (t.due_date as string | null) ?? null,
        module: (t.module as ModuleId | null) ?? null,
      }));
    },

    async getOngoingProjects(limit = 3) {
      const { data, error } = await client
        .from('projects')
        .select('id, name, program_area, progress_percent, end_date, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (error) fail('ongoing projects', error);
      return (data ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        programArea: (p.program_area as string | null) ?? 'General',
        progress: Number(p.progress_percent ?? 0),
        endDate: (p.end_date as string | null) ?? null,
        updatedAt: p.updated_at as string,
      }));
    },

    async getRecentActivity(limit = 12) {
      const { data, error } = await client
        .from('activity_logs')
        .select('id, module, summary, details, created_at, actor:profiles!activity_logs_actor_id_fkey(display_name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) fail('recent activity', error);
      return (data ?? []).map((row): ActivityItem => {
        const actor = row.actor as unknown as { display_name?: string } | null;
        return {
          id: String(row.id),
          occurredAt: row.created_at as string,
          kind: MODULE_TO_KIND[row.module as string] ?? 'other',
          title: row.summary as string,
          detail: (row.details as string | null) ?? undefined,
          actor: actor?.display_name ?? undefined,
        };
      });
    },

    async getStockLevels() {
      const { data, error } = await client
        .from('inventory_items')
        .select('id, name, location, quantity_on_hand, reorder_level, unit')
        .eq('is_active', true)
        .order('name')
        .limit(200);
      if (error) fail('stock levels', error);
      return (data ?? [])
        .map((r) => ({
          id: r.id as string,
          item: r.name as string,
          location: (r.location as string | null) ?? '—',
          onHand: Number(r.quantity_on_hand),
          reorderLevel: Number(r.reorder_level),
          unit: r.unit as string,
        }))
        .sort((a, b) => a.onHand / (a.reorderLevel || 1) - b.onHand / (b.reorderLevel || 1))
        .slice(0, 8);
    },

    async getWeeklyResponse(weeks = 8) {
      const { data, error } = await client.rpc('get_weekly_response_counts', { p_weeks: weeks });
      if (error) fail('response activity trend', error);
      return ((data ?? []) as { week_start: string; activity_count: number | string }[]).map((r) => ({
        weekStart: r.week_start,
        count: Number(r.activity_count),
      }));
    },

    async getNotifications() {
      const uid = await currentUserId(client);
      const { data, error } = await client
        .from('notifications')
        .select('id, title, body, link_path, read_at, created_at')
        .eq('recipient_id', uid)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) fail('notifications', error);
      return (data ?? []).map((n) => ({
        id: n.id as string,
        title: n.title as string,
        body: (n.body as string | null) ?? undefined,
        createdAt: n.created_at as string,
        read: Boolean(n.read_at),
        linkPath: (n.link_path as string | null) ?? undefined,
      }));
    },

    async markNotificationsRead(ids) {
      if (!ids.length) return;
      // Only read_at is writable, and only on your own notifications (RLS).
      const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null);
      if (error) fail('mark notifications read', error);
    },
  };
}
