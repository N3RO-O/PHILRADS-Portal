import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataSource } from '../../types';

/**
 * The admin log (Logs page): every line in public.activity_logs, which only the database writes
 * and nobody can edit or delete (supabase/migrations/20261028000000_task_fairness_and_audit.sql).
 * Readable in full with audit.read (administrators).
 */

export type LogAudience = 'everyone' | 'admins';

export interface LogEntry {
  id: number;
  at: string;
  actorId: string | null;
  actorName: string;
  module: string;
  action: string;
  summary: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  audience: LogAudience;
}

export const LOG_CATEGORIES = [
  { key: 'all', label: 'Everything' },
  { key: 'flags', label: 'Flags' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'signins', label: 'Sign-ins' },
  { key: 'staff', label: 'Staff' },
  { key: 'stock', label: 'Stock' },
  { key: 'map', label: 'Live Map' },
  { key: 'resources', label: 'Resources' },
] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number]['key'];

/** Things an administrator may want to look into. */
export const FLAG_ACTIONS = ['task.quick_tick', 'task.added_done', 'task.xp_capped', 'task.deleted'];

export type LogPeriod = 'today' | '7d' | '30d' | 'all';

export interface LogQuery {
  category: LogCategory;
  search: string;
  period: LogPeriod;
  actorId: string | null;
}

export interface LogPage {
  entries: LogEntry[];
  /** More, older entries match. */
  more: boolean;
}

export interface LogCounts {
  flags: number;
  signIns: number;
  finished: number;
  sentBack: number;
}

export interface AuditService {
  readonly source: DataSource;
  /** Newest first; `before`: continue below this entry id. */
  list(q: LogQuery, before?: number, limit?: number): Promise<LogPage>;
  /** The last 7 days at a glance. */
  counts(): Promise<LogCounts>;
  /** People who appear in the log, for the "who" filter. */
  people(): Promise<{ id: string; name: string }[]>;
}

const sinceOf = (p: LogPeriod, now = new Date()) => {
  if (p === 'all') return null;
  if (p === 'today') {
    // Midnight in Manila (UTC+8, no daylight saving).
    const d = new Date(now.getTime() + 8 * 3600_000);
    d.setUTCHours(0, 0, 0, 0);
    return new Date(d.getTime() - 8 * 3600_000).toISOString();
  }
  return new Date(now.getTime() - (p === '7d' ? 7 : 30) * 86_400_000).toISOString();
};

function inCategory(e: Pick<LogEntry, 'module' | 'action'>, c: LogCategory) {
  switch (c) {
    case 'all':
      return true;
    case 'flags':
      return FLAG_ACTIONS.includes(e.action);
    case 'tasks':
      return e.module === 'tasks';
    case 'signins':
      return e.action === 'auth.signed_in';
    case 'staff':
      return e.action.startsWith('staff.');
    case 'stock':
      return e.module === 'inventory';
    case 'map':
      return e.module === 'live-map';
    case 'resources':
      return e.module === 'resources';
  }
}

// ───────────────────────── Supabase ─────────────────────────

const COLUMNS = 'id, created_at, actor_id, module, action, summary, entity_type, entity_id, metadata, audience, actor:profiles!activity_logs_actor_id_fkey(display_name)';

export function createSupabaseAuditService(client: SupabaseClient): AuditService {
  const toEntry = (r: Record<string, unknown>): LogEntry => ({
    id: Number(r.id),
    at: r.created_at as string,
    actorId: (r.actor_id as string | null) ?? null,
    actorName: ((r.actor as { display_name?: string } | null)?.display_name ?? '').trim() || (r.actor_id ? 'Someone' : 'The system'),
    module: r.module as string,
    action: r.action as string,
    summary: r.summary as string,
    entityType: (r.entity_type as string | null) ?? null,
    entityId: (r.entity_id as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    audience: (r.audience as LogAudience) ?? 'everyone',
  });

  return {
    source: 'supabase',
    async list(q, before, limit = 50) {
      let query = client.from('activity_logs').select(COLUMNS).order('id', { ascending: false }).limit(limit + 1);
      if (before) query = query.lt('id', before);
      const since = sinceOf(q.period);
      if (since) query = query.gte('created_at', since);
      if (q.actorId) query = query.eq('actor_id', q.actorId);
      const needle = q.search.trim().replace(/[%_,()\\]/g, ' ').trim();
      if (needle) query = query.ilike('summary', `%${needle}%`);
      switch (q.category) {
        case 'flags':
          query = query.in('action', FLAG_ACTIONS);
          break;
        case 'tasks':
          query = query.eq('module', 'tasks');
          break;
        case 'signins':
          query = query.eq('action', 'auth.signed_in');
          break;
        case 'staff':
          query = query.like('action', 'staff.%');
          break;
        case 'stock':
          query = query.eq('module', 'inventory');
          break;
        case 'map':
          query = query.eq('module', 'live-map');
          break;
        case 'resources':
          query = query.eq('module', 'resources');
          break;
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Record<string, unknown>[];
      return { entries: rows.slice(0, limit).map(toEntry), more: rows.length > limit };
    },
    async counts() {
      const since = sinceOf('7d')!;
      const count = async (f: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
        const { count: n, error } = await f(base());
        if (error) throw new Error(error.message);
        return n ?? 0;
      };
      const base = () => client.from('activity_logs').select('id', { count: 'exact', head: true }).gte('created_at', since);
      const [flags, signIns, finished, sentBack] = await Promise.all([
        count((q) => q.in('action', FLAG_ACTIONS)),
        count((q) => q.eq('action', 'auth.signed_in')),
        count((q) => q.eq('action', 'task.completed')),
        count((q) => q.eq('action', 'task.sent_back')),
      ]);
      return { flags, signIns, finished, sentBack };
    },
    async people() {
      const { data, error } = await client.from('profiles').select('id, display_name').order('display_name').limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []).map((p) => ({ id: p.id as string, name: ((p.display_name as string | null) ?? '').trim() || 'Unnamed' }));
    },
  };
}

// ───────────────────────── Sample data ─────────────────────────

const PEOPLE = [
  { id: 'demo-admin', name: 'Demo User' },
  { id: 'p-maria', name: 'Maria Santos' },
  { id: 'p-jun', name: 'Jun Dela Cruz' },
  { id: 'p-ana', name: 'Ana Reyes' },
  { id: 'p-leo', name: 'Leo Mendoza' },
];

function sampleLog(): LogEntry[] {
  const now = Date.now();
  const min = 60_000;
  const rows: [number, string, string, string, string, LogAudience, Record<string, unknown>?][] = [
    [12, 'p-maria', 'tasks', 'task.completed', 'Maria Santos finished “Repack 50 hygiene kits” (+45 XP)', 'everyone', { points: 45, self_set: false }],
    [15, 'p-maria', 'system', 'auth.signed_in', 'Maria Santos signed in', 'admins', { device: 'Chrome on Android' }],
    [38, 'p-jun', 'tasks', 'task.quick_tick', 'Jun Dela Cruz ticked off their own task “Check stock” 8 s after adding it', 'admins', { seconds: 8, points: 10 }],
    [39, 'p-jun', 'tasks', 'task.completed', 'Jun Dela Cruz finished “Check stock” (+10 XP)', 'everyone', { points: 10, self_set: true }],
    [55, 'demo-admin', 'tasks', 'task.sent_back', 'Demo User sent back “Barangay 12 headcount” to Leo Mendoza: Only 3 of 5 puroks counted', 'everyone', { reason: 'Only 3 of 5 puroks counted' }],
    [70, 'p-ana', 'inventory', 'item.updated', 'Ana Reyes updated “Rice 25 kg”', 'everyone'],
    [95, 'demo-admin', 'tasks', 'task.assigned', 'Demo User gave Maria Santos “Repack 50 hygiene kits”', 'everyone', { priority: 'high' }],
    [130, 'p-jun', 'tasks', 'task.xp_capped', 'Jun Dela Cruz reached today’s 60 XP limit for their own tasks', 'admins', { points: 0 }],
    [180, 'demo-admin', 'tasks', 'kudos.sent', 'Demo User gave kudos to Maria Santos (+15 XP)', 'admins', { message: 'Great work at the distribution' }],
    [240, 'p-leo', 'live-map', 'place.added', 'Leo Mendoza pinned “Brgy. 12 Covered Court” on the Live Map', 'everyone'],
    [300, 'p-ana', 'system', 'auth.signed_in', 'Ana Reyes signed in', 'admins', { device: 'Safari on iPhone' }],
    [60 * 20, 'demo-admin', 'system', 'staff.role_changed', 'Demo User made Ana Reyes a Coordinator', 'everyone', { from: 'staff', to: 'coordinator' }],
    [60 * 22, 'p-leo', 'tasks', 'task.added_done', 'Leo Mendoza added “Report” already finished: no XP', 'admins'],
    [60 * 26, 'p-maria', 'resources', 'resource.added', 'Maria Santos added “Distribution form v3”', 'everyone'],
    [60 * 30, 'p-jun', 'tasks', 'task.reopened', 'Jun Dela Cruz re-opened “Load truck” (−20 XP)', 'everyone', { points_removed: 20 }],
    [60 * 49, 'demo-admin', 'tasks', 'task.deleted', 'Demo User deleted “Old duplicate task”', 'admins', { was: 'todo' }],
    [60 * 72, 'p-leo', 'system', 'auth.signed_in', 'Leo Mendoza signed in', 'admins', { device: 'Chrome on Windows' }],
    [60 * 100, 'demo-admin', 'system', 'staff.activated', 'Demo User switched on Leo Mendoza’s account', 'everyone'],
  ];
  return rows.map(([ago, actorId, module, action, summary, audience, metadata], i) => ({
    id: 1000 - i,
    at: new Date(now - ago * min).toISOString(),
    actorId,
    actorName: PEOPLE.find((p) => p.id === actorId)?.name ?? 'Someone',
    module,
    action,
    summary,
    entityType: module === 'tasks' ? 'task' : null,
    entityId: null,
    metadata: metadata ?? {},
    audience,
  }));
}

export const mockAuditService: AuditService = {
  source: 'mock',
  async list(q, before, limit = 50) {
    const since = sinceOf(q.period);
    const needle = q.search.trim().toLowerCase();
    const all = sampleLog().filter(
      (e) =>
        (!before || e.id < before) &&
        (!since || e.at >= since) &&
        (!q.actorId || e.actorId === q.actorId) &&
        (!needle || e.summary.toLowerCase().includes(needle)) &&
        inCategory(e, q.category),
    );
    return { entries: all.slice(0, limit), more: all.length > limit };
  },
  async counts() {
    const week = sampleLog().filter((e) => e.at >= sinceOf('7d')!);
    return {
      flags: week.filter((e) => FLAG_ACTIONS.includes(e.action)).length,
      signIns: week.filter((e) => e.action === 'auth.signed_in').length,
      finished: week.filter((e) => e.action === 'task.completed').length,
      sentBack: week.filter((e) => e.action === 'task.sent_back').length,
    };
  },
  async people() {
    return PEOPLE;
  },
};
