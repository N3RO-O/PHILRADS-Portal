import type { SupabaseClient } from '@supabase/supabase-js';
import { flushPush } from '../../lib/push';
import { demoProfile } from '../../data/mockDashboard';
import type { TaskPriority, TaskStatus } from '../../types';
import { TaskRuleError } from './types';

/** One person on the Staff Tasks board. */
export interface BoardPerson {
  id: string;
  name: string;
  /** admin, coordinator, staff, volunteer or viewer: the Active list groups by it. */
  roleKey: string;
  roleName: string | null;
  open: number;
  inProgress: number;
  overdue: number;
  /** Given to them and not answered yet. */
  pending: number;
  doneWeek: number;
  /** Who gave them their open tasks: up to three, the latest first. */
  givers: string[];
}

/** A task as the Staff Tasks board shows it (only tasks given by others, unless it's you or you can see everything). */
export interface BoardTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  acceptance: 'pending' | 'accepted' | 'declined';
  givenBy: string | null;
  givenById: string | null;
  completedAt: string | null;
  nudgedAt: string | null;
}

/** What someone handed in when they finished a task. */
export interface TaskOutput {
  id: string;
  authorName: string;
  note: string | null;
  links: string[];
  /** Small JPEG data URLs. */
  photos: string[];
  createdAt: string;
}
export interface OutputDraft {
  note: string;
  links: string[];
  photos: string[];
}

export interface StaffBoardService {
  board(): Promise<BoardPerson[]>;
  tasksOf(personId: string): Promise<BoardTask[]>;
  /** Accept or decline a task given to you (a reason is needed to decline). */
  respond(taskId: string, accept: boolean, reason?: string): Promise<void>;
  /** A gentle reminder to the person a task is with (once an hour per task). */
  nudge(taskId: string, message?: string): Promise<void>;
  /** Hand in an output for a task given to you (the giver is told). */
  submitOutput(taskId: string, output: OutputDraft): Promise<void>;
  outputsOf(taskId: string): Promise<TaskOutput[]>;
}

const friendly = (message: string) => {
  // The database's own sentences are written for people; anything else is a connection problem.
  if (/^[A-Z][^]*\.$/.test(message) && !/violates|permission denied|function|relation/.test(message)) return message;
  return 'That didn’t work. Check the connection and try again.';
};

export function createSupabaseStaffBoard(client: SupabaseClient): StaffBoardService {
  const fail = (e: { message: string }): never => {
    console.error('[staff board]', e);
    throw new TaskRuleError(friendly(e.message));
  };
  return {
    async board() {
      const { data, error } = await client.rpc('staff_task_board');
      if (error) fail(error);
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: r.profile_id as string,
        name: r.name as string,
        roleKey: (r.role_key as string | null) ?? 'staff',
        roleName: (r.role_name as string | null) ?? null,
        open: Number(r.open_count),
        inProgress: Number(r.in_progress),
        overdue: Number(r.overdue),
        pending: Number(r.pending),
        doneWeek: Number(r.done_week),
        // Missing before the board_givers migration: no pictures, nothing else changes.
        givers: (r.givers as string[] | null | undefined) ?? [],
      }));
    },
    async tasksOf(personId) {
      const { data, error } = await client.rpc('staff_tasks_of', { p_person: personId });
      if (error) fail(error);
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        status: r.status as TaskStatus,
        priority: r.priority as TaskPriority,
        dueDate: (r.due_date as string | null) ?? null,
        acceptance: r.acceptance as BoardTask['acceptance'],
        givenBy: (r.given_by as string | null) ?? null,
        givenById: (r.given_by_id as string | null) ?? null,
        completedAt: (r.completed_at as string | null) ?? null,
        nudgedAt: (r.nudged_at as string | null) ?? null,
      }));
    },
    async respond(taskId, accept, reason) {
      const { error } = await client.rpc('accept_task', { p_task: taskId, p_accept: accept, p_reason: reason ?? null });
      if (error) fail(error);
      flushPush();
    },
    async nudge(taskId, message) {
      const { error } = await client.rpc('nudge_task', { p_task: taskId, p_message: message ?? null });
      if (error) fail(error);
      flushPush();
    },
    async submitOutput(taskId, o) {
      const { error } = await client.from('task_outputs').insert({ task_id: taskId, note: o.note.trim() || null, links: o.links, photos: o.photos });
      if (error) {
        console.error('[outputs] submit', error);
        throw new TaskRuleError(error.code === '42501' ? 'Only the person this task is for can hand in its output.' : 'The output couldn’t be sent. Check the connection and try again.');
      }
      flushPush();
    },
    async outputsOf(taskId) {
      const { data, error } = await client
        .from('task_outputs')
        .select('id, note, links, photos, created_at, author:profiles!task_outputs_author_id_fkey(display_name)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) fail(error);
      return (data ?? []).map((r) => ({
        id: r.id as string,
        authorName: ((r as Record<string, unknown>).author as { display_name?: string } | null)?.display_name ?? 'Staff member',
        note: (r.note as string | null) ?? null,
        links: (r.links as string[]) ?? [],
        photos: (r.photos as string[]) ?? [],
        createdAt: r.created_at as string,
      }));
    },
  };
}

// ───────────────────────── Sample data ─────────────────────────

const day = (n: number) => new Date(Date.now() + n * 86_400_000 + 8 * 3600_000).toISOString().slice(0, 10);
const SAMPLE_BOARD: BoardPerson[] = [
  { id: demoProfile.id, name: demoProfile.displayName, roleKey: 'admin', roleName: 'Administrator', open: 4, inProgress: 1, overdue: 0, pending: 0, doneWeek: 3, givers: ['p-ana', 'p-maria'] },
  { id: 'p-ana', name: 'Ana Reyes', roleKey: 'coordinator', roleName: 'Coordinator', open: 3, inProgress: 2, overdue: 1, pending: 0, doneWeek: 5, givers: [demoProfile.id] },
  { id: 'p-jun', name: 'Jun Dela Cruz', roleKey: 'staff', roleName: 'Field staff', open: 5, inProgress: 1, overdue: 0, pending: 1, doneWeek: 2, givers: ['p-ana', demoProfile.id, 'p-maria'] },
  { id: 'p-maria', name: 'Maria Santos', roleKey: 'staff', roleName: 'Field staff', open: 2, inProgress: 0, overdue: 0, pending: 0, doneWeek: 6, givers: [demoProfile.id] },
  { id: 'p-leo', name: 'Leo Mendoza', roleKey: 'volunteer', roleName: 'Volunteer', open: 1, inProgress: 1, overdue: 1, pending: 0, doneWeek: 1, givers: ['p-maria'] },
  { id: 'p-grace', name: 'Grace Lim', roleKey: 'staff', roleName: 'Field staff', open: 0, inProgress: 0, overdue: 0, pending: 0, doneWeek: 4, givers: [] },
];
const sampleTasks = (personId: string): BoardTask[] => {
  const base: BoardTask[] = [
    { id: `${personId}-1`, title: 'Repack 200 hygiene kits for Glan', status: 'in_progress', priority: 'high', dueDate: day(1), acceptance: 'accepted', givenBy: 'Ana Reyes', givenById: 'p-ana', completedAt: null, nudgedAt: null },
    { id: `${personId}-2`, title: 'Submit distribution photos to Documentation', status: 'todo', priority: 'medium', dueDate: day(-1), acceptance: 'accepted', givenBy: demoProfile.displayName, givenById: demoProfile.id, completedAt: null, nudgedAt: null },
    { id: `${personId}-3`, title: 'Call the barangay captain about the venue', status: 'todo', priority: 'medium', dueDate: day(3), acceptance: 'pending', givenBy: 'Maria Santos', givenById: 'p-maria', completedAt: null, nudgedAt: null },
    { id: `${personId}-4`, title: 'Encode the beneficiary list (Batch 2)', status: 'done', priority: 'low', dueDate: day(-2), acceptance: 'accepted', givenBy: demoProfile.displayName, givenById: demoProfile.id, completedAt: new Date(Date.now() - 86_400_000).toISOString(), nudgedAt: null },
  ];
  const n = SAMPLE_BOARD.find((p) => p.id === personId);
  return n && n.open + n.inProgress === 0 ? base.slice(3) : base;
};
const nudged = new Map<string, number>();
const sampleOutputs = new Map<string, TaskOutput[]>();
const later = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));

export const mockStaffBoard: StaffBoardService = {
  board: () => later(structuredClone(SAMPLE_BOARD)),
  tasksOf: (id) => later(sampleTasks(id)),
  async respond(_id, accept, reason) {
    if (!accept && !reason?.trim()) throw new TaskRuleError('Say in a few words why you can’t take it.');
    await later(null);
  },
  async submitOutput(id, o) {
    sampleOutputs.set(id, [{ id: `out-${Date.now()}`, authorName: demoProfile.displayName, note: o.note.trim() || null, links: o.links, photos: o.photos, createdAt: new Date().toISOString() }, ...(sampleOutputs.get(id) ?? [])]);
    await later(null);
  },
  outputsOf: (id) => later(sampleOutputs.get(id) ?? []),
  async nudge(id) {
    if (Date.now() - (nudged.get(id) ?? 0) < 3600_000) throw new TaskRuleError('They were nudged about this in the last hour. Give them a little time.');
    nudged.set(id, Date.now());
    await later(null);
  },
};
