import type { SupabaseClient } from '@supabase/supabase-js';
import { PLACEHOLDER_ROLE_PERMISSIONS, type PermissionKey } from '../../config/permissions';
import { demoProfile } from '../../data/mockDashboard';
import { createTaskSeed, SAMPLE_PEOPLE } from '../../data/mockTaskSeed';
import { todayKey } from '../../lib/inventory';
import { nextOccurrence } from '../../lib/tasks';
import { scoreCompletion, XP_RULES } from '../../lib/taskProgress';
import type { TaskPriority, TaskStatus } from '../../types';
import {
  TaskOfflineError,
  TaskRuleError,
  type Kudos,
  type Recurrence,
  type Subtask,
  type Task,
  type TaskDraft,
  type TaskList,
  type TasksService,
  type WorkSetting,
  type XpAward,
} from './types';

const validate = (d: TaskDraft) => {
  if (!d.title.trim()) throw new TaskRuleError('Give the task a title.');
  if (d.title.trim().length > 200) throw new TaskRuleError('Keep the title under 200 characters.');
  if (d.notes.length > 4000) throw new TaskRuleError('Keep the notes under 4,000 characters.');
  if (d.location.trim().length > 200) throw new TaskRuleError('Keep the place under 200 characters.');
  if (d.subtasks.length > 50) throw new TaskRuleError('A task can have up to 50 subtasks.');
};

/** The next occurrence of a repeating task: same details, fresh checklist. */
export const nextDraft = (t: Task): TaskDraft | null => {
  const due = nextOccurrence(t);
  if (!due) return null;
  return {
    title: t.title,
    notes: t.notes ?? '',
    list: t.list,
    setting: t.setting,
    priority: t.priority,
    dueDate: due,
    dueTime: t.dueTime,
    myDay: null,
    subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
    recurrence: t.recurrence,
    location: t.location ?? '',
    assigneeId: t.assigneeId,
  };
};

// ───────────────────────── Sample data (this browser only) ─────────────────────────

interface SampleState {
  tasks: Task[];
  awards: XpAward[];
  kudos: Kudos[];
  goal: number;
}
const STORE_KEY = 'philrads.sample.tasks.v1';
let sample: SampleState | null = null;
const sampleState = (): SampleState => {
  if (sample) return sample;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return (sample = JSON.parse(raw) as SampleState);
  } catch {
    /* fall back to the seed */
  }
  return (sample = { ...createTaskSeed(todayKey(), demoProfile.id), goal: 300 });
};
const persist = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(sampleState()));
  } catch {
    /* storage unavailable: changes last until reload */
  }
};
const later = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 150));
const demoCan = (permission: PermissionKey) => {
  let role = demoProfile.roleKey;
  try {
    role = localStorage.getItem('philrads.demo.role') ?? role;
  } catch {
    /* default role */
  }
  return (PLACEHOLDER_ROLE_PERMISSIONS[role] ?? []).includes(permission);
};
const me = demoProfile.id;
/** Sample mode behaves like the live service with no connection, so the offline queue can be tried. */
const needOnline = () => {
  if (!navigator.onLine) throw new TaskOfflineError();
};
const visible = (t: Task) => t.status !== 'cancelled' && (demoCan('tasks.read_all') || t.assigneeId === me || t.createdById === me);
const find = (id: string) => {
  const t = sampleState().tasks.find((x) => x.id === id && visible(x));
  if (!t) throw new TaskRuleError('This task is no longer available.');
  return t;
};
const replace = (t: Task) => {
  sampleState().tasks = sampleState().tasks.map((x) => (x.id === t.id ? t : x));
};

function sampleSave(d: TaskDraft): Task {
  validate(d);
  // Saved before (a retry): return it rather than adding a second copy.
  const already = !d.id && d.newId ? sampleState().tasks.find((t) => t.id === d.newId) : undefined;
  if (already) return already;
  const assignee = d.assigneeId ?? me;
  if (assignee !== me && !demoCan('tasks.manage')) throw new TaskRuleError('Only coordinators and admins can give a task to someone else.');
  const now = new Date().toISOString();
  const prev = d.id ? find(d.id) : null;
  const saved: Task = {
    id: prev?.id ?? d.newId ?? `task-${crypto.randomUUID?.() ?? Date.now()}`,
    title: d.title.trim(),
    notes: d.notes.trim() || null,
    list: d.list,
    setting: d.setting,
    priority: d.priority,
    status: prev?.status ?? 'todo',
    dueDate: d.dueDate,
    dueTime: d.dueDate ? d.dueTime : null,
    myDay: d.myDay,
    subtasks: d.subtasks,
    recurrence: d.recurrence,
    location: d.location.trim() || null,
    assigneeId: assignee,
    assigneeName: SAMPLE_PEOPLE.find((p) => p.id === assignee)?.name ?? 'Staff member',
    createdById: prev?.createdById ?? me,
    createdByName: prev?.createdByName ?? demoProfile.displayName,
    completedAt: prev?.completedAt ?? null,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  if (prev) replace(saved);
  else sampleState().tasks = [saved, ...sampleState().tasks];
  persist();
  return saved;
}

export const mockTasksService: TasksService = {
  source: 'mock',
  async currentUserId() {
    return me;
  },
  async list() {
    needOnline();
    return later(sampleState().tasks.filter(visible));
  },
  async save(d) {
    needOnline();
    return later(sampleSave(d));
  },
  async patch(id, p) {
    needOnline();
    const t = { ...find(id), ...p, updatedAt: new Date().toISOString() };
    replace(t);
    persist();
    return later(t);
  },
  async complete(id, done) {
    needOnline();
    const prev = find(id);
    const s = sampleState();
    const earner = prev.assigneeId ?? prev.createdById ?? me;
    let award: XpAward | null = null;
    const task: Task = { ...prev, status: done ? 'done' : 'todo', completedAt: done ? prev.completedAt ?? new Date().toISOString() : null, updatedAt: new Date().toISOString() };
    replace(task);
    if (done && prev.status !== 'done') {
      // Only the person who did it earns XP (a coordinator ticking someone's task off earns nothing here).
      if (earner === me) {
        const today = todayKey();
        const selfToday = s.awards.filter((a) => a.day === today && a.selfSet).reduce((sum, a) => sum + a.points, 0);
        award = scoreCompletion(prev, earner, selfToday, today);
        s.awards = [...s.awards.filter((a) => a.taskId !== id), award];
      }
    }
    if (!done) s.awards = s.awards.filter((a) => a.taskId !== id);
    persist();
    return later({ task, award, next: null });
  },
  async remove(id) {
    needOnline();
    replace({ ...find(id), status: 'cancelled' });
    persist();
    await later(null);
  },
  async progress() {
    needOnline();
    const s = sampleState();
    return later({ awards: s.awards, kudos: s.kudos });
  },
  async team() {
    needOnline();
    const s = sampleState();
    const month = `${todayKey().slice(0, 7)}-01`;
    // The rest of the team's finished tasks are made up; the demo user's are counted.
    const mine = s.tasks.filter((t) => t.status === 'done' && t.completedAt && t.completedAt >= month).length;
    return later({ month, done: 118 + mine, goal: s.goal });
  },
  async setTeamGoal(goal) {
    if (!demoCan('tasks.manage')) throw new TaskRuleError('Only coordinators and admins can set the team goal.');
    if (!Number.isInteger(goal) || goal < 1 || goal > 100000) throw new TaskRuleError('The team goal must be between 1 and 100,000 tasks.');
    sampleState().goal = goal;
    persist();
    await later(null);
  },
  async assignees() {
    return later(SAMPLE_PEOPLE);
  },
  async sendKudos(toId, message) {
    if (!demoCan('tasks.manage')) throw new TaskRuleError('Only coordinators and admins can send kudos.');
    if (toId === me) throw new TaskRuleError('Kudos are for someone else.');
    if (!message.trim() || message.trim().length > 280) throw new TaskRuleError('Write a short message (up to 280 characters).');
    // In sample mode the kudos goes nowhere: the other people are made up.
    await later(null);
  },
};

// ───────────────────────── Supabase ─────────────────────────

/** Live tasks. Row Level Security and the database's triggers decide what each person can do and what XP they earn. */
export function createSupabaseTasksService(client: SupabaseClient): TasksService {
  const fail = (what: string, error: { message: string; code?: string }): never => {
    console.error(`[tasks] ${what}`, error);
    // No connection (the request never reached Supabase): the offline queue keeps the change.
    if (!navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(error.message)) throw new TaskOfflineError();
    if (error.code === '42501') throw new TaskRuleError(error.message.startsWith('Only') || error.message.startsWith('The') ? error.message : 'Your role does not allow this.');
    if (error.code === '22023') throw new TaskRuleError(error.message);
    if (error.code === '23505') throw new TaskRuleError('You already thanked them today. Try again tomorrow.');
    if (error.code && error.code.startsWith('23')) throw new TaskRuleError('The server rejected this task. Check the title and details.');
    throw new Error(`Could not ${what}. Check the connection and try again.`);
  };
  const uid = async () => (await client.auth.getSession()).data.session?.user.id ?? null;

  const columns =
    'id, title, description, priority, status, list, work_setting, due_date, due_time, my_day, subtasks, recurrence, location, assignee_id, created_by, completed_at, created_at, updated_at, assignee:profiles!tasks_assignee_id_fkey(display_name), creator:profiles!tasks_created_by_fkey(display_name)';
  const name = (p: unknown) => (p as { display_name?: string } | null)?.display_name || null;
  const map = (r: Record<string, unknown>): Task => ({
    id: r.id as string,
    title: r.title as string,
    notes: (r.description as string | null) ?? null,
    list: r.list as TaskList,
    setting: r.work_setting as WorkSetting,
    priority: r.priority as TaskPriority,
    status: r.status as TaskStatus,
    dueDate: (r.due_date as string | null) ?? null,
    dueTime: r.due_time ? (r.due_time as string).slice(0, 5) : null,
    myDay: (r.my_day as string | null) ?? null,
    subtasks: Array.isArray(r.subtasks) ? (r.subtasks as Subtask[]) : [],
    recurrence: r.recurrence as Recurrence,
    location: (r.location as string | null) ?? null,
    assigneeId: (r.assignee_id as string | null) ?? null,
    assigneeName: name(r.assignee),
    createdById: (r.created_by as string | null) ?? null,
    createdByName: name(r.creator),
    completedAt: (r.completed_at as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  });
  const row = (d: TaskDraft, me: string | null) => ({
    title: d.title.trim(),
    description: d.notes.trim() || null,
    list: d.list,
    work_setting: d.setting,
    priority: d.priority,
    due_date: d.dueDate,
    due_time: d.dueDate ? d.dueTime : null,
    my_day: d.myDay,
    subtasks: d.subtasks,
    recurrence: d.recurrence,
    location: d.location.trim() || null,
    assignee_id: d.assigneeId ?? me,
  });
  const mapAward = (r: Record<string, unknown>): XpAward => ({
    taskId: r.task_id as string,
    taskTitle: (r.task as { title?: string } | null)?.title ?? 'Task',
    points: r.points as number,
    base: r.base as number,
    onTime: r.on_time as number,
    subtasks: r.subtasks as number,
    selfSet: Boolean(r.self_set),
    capped: Boolean(r.capped),
    day: r.day as string,
    awardedAt: r.created_at as string,
  });
  const awardColumns = 'task_id, points, base, on_time, subtasks, self_set, capped, day, created_at, task:tasks(title)';

  const save = async (d: TaskDraft) => {
    validate(d);
    const r = row(d, await uid());
    const insert: Record<string, unknown> = d.newId ? { ...r, id: d.newId } : r;
    const q = d.id ? client.from('tasks').update(r).eq('id', d.id) : client.from('tasks').insert(insert);
    const { data, error } = await q.select(columns).single();
    if (error && error.code === '23505' && !d.id && d.newId) {
      // Already saved by an earlier attempt: return that one instead of adding a second task.
      const again = await client.from('tasks').select(columns).eq('id', d.newId).single();
      if (!again.error) return map(again.data as Record<string, unknown>);
    }
    if (error) fail('save this task', error);
    return map(data as Record<string, unknown>);
  };

  return {
    source: 'supabase',
    currentUserId: uid,
    async list() {
      const { data, error } = await client.from('tasks').select(columns).neq('status', 'cancelled').order('due_date', { ascending: true, nullsFirst: false }).limit(2000);
      if (error) fail('load tasks', error);
      return (data ?? []).map(map);
    },
    save,
    async patch(id, p) {
      const r: Record<string, unknown> = {};
      if ('myDay' in p) r.my_day = p.myDay;
      if ('subtasks' in p) r.subtasks = p.subtasks;
      if ('priority' in p) r.priority = p.priority;
      if ('dueDate' in p) r.due_date = p.dueDate;
      const { data, error } = await client.from('tasks').update(r).eq('id', id).select(columns).single();
      if (error) fail('update this task', error);
      return map(data as Record<string, unknown>);
    },
    async complete(id, done) {
      const { data, error } = await client.from('tasks').update({ status: done ? 'done' : 'todo' }).eq('id', id).select(columns).single();
      if (error) fail(done ? 'mark this task done' : 're-open this task', error);
      const task = map(data as Record<string, unknown>);
      if (!done) return { task, award: null, next: null };
      // The database awarded the XP (if this person earned it); read back what it gave.
      const { data: a } = await client.from('task_xp_events').select(awardColumns).eq('task_id', id).maybeSingle();
      return { task, award: a ? mapAward(a as Record<string, unknown>) : null, next: null };
    },
    async remove(id) {
      const { error } = await client.from('tasks').update({ status: 'cancelled' }).eq('id', id);
      if (error) fail('remove this task', error);
    },
    async progress() {
      const me = await uid();
      if (!me) return { awards: [], kudos: [] };
      const [awards, kudos] = await Promise.all([
        client.from('task_xp_events').select(awardColumns).eq('user_id', me).order('created_at', { ascending: false }).limit(5000),
        client.from('task_kudos').select('id, message, points, created_at, giver:profiles!task_kudos_from_user_fkey(display_name)').eq('to_user', me).order('created_at', { ascending: false }).limit(200),
      ]);
      if (awards.error) fail('load your progress', awards.error);
      if (kudos.error) fail('load your kudos', kudos.error);
      return {
        awards: (awards.data ?? []).map((r) => mapAward(r as Record<string, unknown>)),
        kudos: (kudos.data ?? []).map((r) => ({
          id: r.id as string,
          fromName: name((r as Record<string, unknown>).giver) ?? 'A coordinator',
          message: r.message as string,
          points: (r.points as number) ?? XP_RULES.kudos,
          createdAt: r.created_at as string,
        })),
      };
    },
    async team() {
      const { data, error } = await client.rpc('task_team_progress');
      if (error) fail('load the team goal', error);
      const r = (Array.isArray(data) ? data[0] : data) as { month: string; done: number; goal: number } | undefined;
      return { month: r?.month ?? `${todayKey().slice(0, 7)}-01`, done: Number(r?.done ?? 0), goal: Number(r?.goal ?? 200) };
    },
    async setTeamGoal(goal) {
      const { error } = await client.rpc('set_task_team_goal', { p_goal: goal });
      if (error) fail('save the team goal', error);
    },
    async assignees() {
      const { data, error } = await client.from('profiles').select('id, display_name').eq('is_active', true).order('display_name').limit(1000);
      if (error) fail('load staff names', error);
      return (data ?? []).map((p) => ({ id: p.id as string, name: (p.display_name as string) || 'Staff member' }));
    },
    async sendKudos(toId, message) {
      const { error } = await client.from('task_kudos').insert({ to_user: toId, message: message.trim() });
      if (error) fail('send kudos', error);
    },
  };
}
