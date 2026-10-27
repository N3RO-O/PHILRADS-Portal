import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityItem,
  ActivityKind,
  ModuleId,
  SummaryKey,
  TaskPriority,
  TaskStatus,
} from '../../types';
import { manilaDayKey } from '../../lib/format';
import { buildStockRows } from '../../lib/inventory';
import { createImsInventoryService } from '../inventory/imsInventoryService';
import type { InventorySnapshot } from '../inventory/types';
import type { DashboardService } from './types';

/**
 * Live dashboard data. Every query runs as the signed-in staff member with the
 * anon key, so Row Level Security decides what they can see
 * (supabase/migrations/20261018000000_initial_schema.sql).
 * Stock and relief responses live in PHILRADS IMS: those figures come from its latest snapshot,
 * worked out the same way as the Inventory and Response pages.
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

/** Projects still going: planned, active or on hold. */
const OPEN_PROJECTS = ['planned', 'active', 'on_hold'];

/** Relief events still going in the IMS (as on the Response page). */
const openEvents = (snap: InventorySnapshot) => (snap.imsEvents ?? []).filter((e) => e.status === 'active' || e.status === 'upcoming' || e.status === 'planned');

export function createSupabaseDashboardService(client: SupabaseClient): DashboardService {
  const ims = createImsInventoryService(client);
  // One IMS snapshot for all the Home cards that need it (kept for a minute).
  let snap: { at: number; value: Promise<InventorySnapshot | null> } | null = null;
  const snapshot = () => {
    if (!snap || Date.now() - snap.at > 60_000) snap = { at: Date.now(), value: ims.getSnapshot().catch(() => null) };
    return snap.value;
  };

  return {
    source: 'supabase',

    async getSummary() {
      const [{ data, error }, stock] = await Promise.all([client.rpc('get_dashboard_summary'), snapshot()]);
      if (error) fail('overview counts', error);
      const rows = (data ?? []) as { metric: string; value: number | string }[];
      const fromIms: Partial<Record<SummaryKey, number>> = {
        inventory_alerts: stock ? buildStockRows(stock).filter((r) => r.stock !== 'in').length : 0,
        response_activities: stock ? openEvents(stock).length : 0,
      };
      return SUMMARY_KEYS.map((key) => ({
        key,
        value: fromIms[key] ?? Number(rows.find((r) => r.metric === key)?.value ?? 0),
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
        .in('status', OPEN_PROJECTS)
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
        // The everyday feed; sign-ins and flags are for the admin Logs page.
        .eq('audience', 'everyone')
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
      const stock = await snapshot();
      if (!stock) return [];
      // Per item across every location: usable stock (expired lots left out) against its reorder level.
      const byItem = new Map<string, { onHand: number; places: Set<string> }>();
      for (const r of buildStockRows(stock)) {
        const t = byItem.get(r.item.id) ?? { onHand: 0, places: new Set<string>() };
        t.onHand += r.usable;
        if (r.location && r.usable > 0) t.places.add(r.location.name);
        byItem.set(r.item.id, t);
      }
      return stock.items
        .map((i) => {
          const t = byItem.get(i.id);
          const places = [...(t?.places ?? [])];
          return {
            id: i.id,
            item: i.name,
            location: places.length > 1 ? `${places.length} locations` : (places[0] ?? '—'),
            onHand: t?.onHand ?? 0,
            reorderLevel: i.reorderLevel,
            unit: i.unit,
          };
        })
        .sort((a, b) => a.onHand / (a.reorderLevel || 1) - b.onHand / (b.reorderLevel || 1))
        .slice(0, 8);
    },

    async getWeeklyResponse(weeks = 8) {
      // Served updates recorded in the IMS (one per area's distribution), per week starting Monday (Manila).
      const stock = await snapshot();
      const day = 86_400_000;
      const today = new Date(`${manilaDayKey(new Date().toISOString())}T00:00:00Z`);
      const monday = today.getTime() - ((today.getUTCDay() + 6) % 7) * day;
      const starts = Array.from({ length: weeks }, (_, i) => new Date(monday - (weeks - 1 - i) * 7 * day).toISOString().slice(0, 10));
      const counts = new Map(starts.map((w) => [w, 0]));
      for (const e of stock?.imsEvents ?? []) {
        for (const u of e.updates) {
          if (!u.at) continue;
          const on = manilaDayKey(u.at);
          const week = [...starts].reverse().find((w) => w <= on);
          if (week && on < new Date(Date.parse(`${week}T00:00:00Z`) + 7 * day).toISOString().slice(0, 10)) counts.set(week, counts.get(week)! + 1);
        }
      }
      return starts.map((w) => ({ weekStart: w, count: counts.get(w)! }));
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
