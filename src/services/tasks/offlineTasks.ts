import { idbDelete, idbGet, idbGetAll, idbPut } from '../../lib/idb';
import { nextDraft } from './tasksService';
import {
  TaskOfflineError,
  type Assignee,
  type CompletionResult,
  type Kudos,
  type Task,
  type TaskDraft,
  type TaskPatch,
  type TasksService,
  type TeamProgress,
  type XpAward,
} from './types';

/**
 * Tasks that keep working without a connection.
 *
 * - The last task list, XP, kudos, team goal and staff names are saved on this device (IndexedDB),
 *   so the page opens offline.
 * - Changes made offline wait in a queue ("pending") and sync when the connection is back.
 * - No duplicates: a new task gets its id on the device, so a retried or doubled sync finds it
 *   instead of adding a second one; all changes to one task are merged into ONE queue entry
 *   (the latest wins); ticking off is idempotent and the database awards XP once per task; a
 *   repeating task's next copy is made once, when it's ticked off, never by the sync.
 */

/** One queue entry per task: what still has to reach the server. */
export interface PendingChange {
  /** `task:<id>`: the outbox key, so a task never has two entries. */
  clientId: string;
  kind: 'task';
  taskId: string;
  /** Whose change it is: only synced while that person is signed in. */
  userId: string | null;
  /** New task, not on the server yet. */
  create?: TaskDraft;
  /** Edited in the form. */
  update?: TaskDraft;
  patch?: TaskPatch;
  done?: boolean;
  remove?: boolean;
  /** The server refused it (not a connection problem): shown so the person can discard it. */
  error?: string;
  updatedAt: string;
}

interface Saved {
  me: string | null;
  tasks: Task[];
  awards: XpAward[];
  kudos: Kudos[];
  team: TeamProgress | null;
  people: Assignee[];
  savedAt: string;
}

export interface OfflineTasksService extends TasksService {
  /** Changes waiting to sync, by task id. */
  pending(): Map<string, PendingChange>;
  /** When the list shown came from this device instead of the server, when it was saved. */
  savedAt(): string | null;
  /** Called when the queue changes, and after a sync with how many changes reached the server. */
  subscribe(fn: (event: { type: 'pending' } | { type: 'synced'; count: number }) => void): () => void;
  sync(): Promise<void>;
  /** Drop a change the server refused. */
  discard(taskId: string): Promise<void>;
}

const CACHE_KEY = 'tasks:v1';
const uuid = () => crypto.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
/** Only connection problems are queued; anything else (a rule the server enforces, a bug) is shown. */
const isOffline = (e: unknown) => e instanceof TaskOfflineError || !navigator.onLine;

export function createOfflineTasks(inner: TasksService): OfflineTasksService {
  let saved: Saved = { me: null, tasks: [], awards: [], kudos: [], team: null, people: [], savedAt: '' };
  let hasSaved = false;
  let fromDevice: string | null = null;
  const queue = new Map<string, PendingChange>();
  /** The tasks as last shown (server or device, with the queue applied): the base for optimistic results. */
  let current = new Map<string, Task>();
  const listeners = new Set<Parameters<OfflineTasksService['subscribe']>[0]>();
  const emit = (e: Parameters<Parameters<OfflineTasksService['subscribe']>[0]>[0]) => listeners.forEach((fn) => fn(e));

  const ready = (async () => {
    const [cache, entries] = await Promise.all([
      idbGet<Saved>('kv', CACHE_KEY).catch(() => undefined),
      idbGetAll<PendingChange>('outbox').catch(() => [] as PendingChange[]),
    ]);
    if (cache) {
      saved = cache;
      hasSaved = true;
    }
    for (const e of entries) if (e.kind === 'task') queue.set(e.taskId, e);
  })();

  const persist = (patch: Partial<Saved>) => {
    saved = { ...saved, ...patch, savedAt: new Date().toISOString() };
    hasSaved = true;
    void idbPut('kv', saved, CACHE_KEY).catch(() => undefined);
  };
  const mine = () => [...queue.values()].filter((e) => e.userId === saved.me);

  const myName = () => saved.people.find((p) => p.id === saved.me)?.name ?? 'You';
  const fromDraft = (d: TaskDraft, prev?: Task): Task => {
    const now = new Date().toISOString();
    const assignee = d.assigneeId ?? prev?.assigneeId ?? saved.me;
    return {
      id: prev?.id ?? d.id ?? d.newId ?? uuid(),
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
      assigneeName: saved.people.find((p) => p.id === assignee)?.name ?? prev?.assigneeName ?? myName(),
      createdById: prev?.createdById ?? saved.me,
      createdByName: prev?.createdByName ?? myName(),
      completedAt: prev?.completedAt ?? null,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
  };

  /** The server's list with this person's waiting changes on top. */
  const withQueue = (tasks: Task[]) => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    for (const e of mine()) {
      if (e.remove) {
        byId.delete(e.taskId);
        continue;
      }
      let t = byId.get(e.taskId);
      if (e.create) t = fromDraft(e.create, t);
      if (e.update) t = fromDraft(e.update, t);
      if (!t) continue;
      if (e.patch) t = { ...t, ...e.patch };
      if (e.done !== undefined) t = { ...t, status: e.done ? 'done' : 'todo', completedAt: e.done ? t.completedAt ?? e.updatedAt : null };
      byId.set(t.id, t);
    }
    const out = [...byId.values()];
    current = new Map(out.map((t) => [t.id, t]));
    return out;
  };

  const enqueue = async (taskId: string, change: (e: PendingChange) => PendingChange | null) => {
    await ready;
    const prev = queue.get(taskId) ?? { clientId: `task:${taskId}`, kind: 'task' as const, taskId, userId: saved.me, updatedAt: '' };
    const next = change({ ...prev, error: undefined, updatedAt: new Date().toISOString() });
    if (next) {
      queue.set(taskId, next);
      await idbPut('outbox', next).catch(() => undefined);
    } else {
      queue.delete(taskId);
      await idbDelete('outbox', `task:${taskId}`).catch(() => undefined);
    }
    emit({ type: 'pending' });
    if (navigator.onLine) void service.sync();
  };

  /** Straight to the server unless offline or this task already has changes waiting (they go first). */
  const direct = (taskId: string) => navigator.onLine && !queue.has(taskId);

  let syncing: Promise<void> | null = null;
  const runSync = async () => {
    await ready;
    let count = 0;
    const entries = mine().sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    for (const e of entries) {
      if (e.error) continue;
      try {
        if (e.remove) {
          await inner.remove(e.taskId).catch((err) => {
            // Already gone on the server: nothing left to do.
            if (isOffline(err)) throw err;
          });
        } else {
          if (e.create) await inner.save(e.create); // finds the task if an earlier attempt saved it
          if (e.update) await inner.save(e.update);
          if (e.patch) await inner.patch(e.taskId, e.patch);
          if (e.done !== undefined) await inner.complete(e.taskId, e.done); // safe to repeat
        }
        // Only clear it if nothing new was queued for this task while it synced.
        if (queue.get(e.taskId)?.updatedAt === e.updatedAt) {
          queue.delete(e.taskId);
          await idbDelete('outbox', e.clientId).catch(() => undefined);
        }
        count++;
      } catch (err) {
        if (isOffline(err)) break;
        const failed = { ...e, error: err instanceof Error ? err.message : 'The server refused this change.' };
        queue.set(e.taskId, failed);
        await idbPut('outbox', failed).catch(() => undefined);
      }
    }
    emit({ type: 'pending' });
    if (count) emit({ type: 'synced', count });
  };

  const service: OfflineTasksService = {
    source: inner.source,
    async currentUserId() {
      await ready;
      try {
        const id = await inner.currentUserId();
        if (id) {
          if (hasSaved && saved.me !== id) saved = { me: id, tasks: [], awards: [], kudos: [], team: null, people: [], savedAt: '' }; // someone else signed in
          saved.me = id;
          return id;
        }
      } catch {
        /* offline: fall back to the saved id below */
      }
      return saved.me;
    },
    async list() {
      await ready;
      try {
        const tasks = await inner.list();
        persist({ tasks });
        fromDevice = null;
        if (navigator.onLine && mine().some((e) => !e.error)) void service.sync();
        return withQueue(tasks);
      } catch (e) {
        if (!isOffline(e) || !hasSaved) throw e;
        fromDevice = saved.savedAt;
        return withQueue(saved.tasks);
      }
    },
    async save(d) {
      const draft = d.id ? d : { ...d, newId: d.newId ?? uuid() };
      const id = draft.id ?? draft.newId!;
      if (direct(id)) {
        try {
          return await inner.save(draft);
        } catch (e) {
          if (!isOffline(e)) throw e;
        }
      }
      await enqueue(id, (q) => (q.create ? { ...q, create: { ...draft, id: undefined, newId: id } } : draft.id ? { ...q, update: draft, patch: undefined } : { ...q, create: draft }));
      const t = fromDraft(draft, current.get(id));
      current.set(t.id, t);
      return t;
    },
    async patch(id, p) {
      if (direct(id)) {
        try {
          return await inner.patch(id, p);
        } catch (e) {
          if (!isOffline(e)) throw e;
        }
      }
      await enqueue(id, (q) =>
        q.create ? { ...q, create: { ...q.create, ...p } } : q.update ? { ...q, update: { ...q.update, ...p } } : { ...q, patch: { ...q.patch, ...p } },
      );
      const t = { ...(current.get(id) as Task), ...p };
      current.set(id, t);
      return t;
    },
    async complete(id, done) {
      const before = current.get(id);
      let result: CompletionResult | null = null;
      if (direct(id)) {
        try {
          result = await inner.complete(id, done);
        } catch (e) {
          if (!isOffline(e)) throw e;
        }
      }
      if (!result) {
        await enqueue(id, (q) => ({ ...q, done }));
        const base = before as Task;
        result = { task: { ...base, status: done ? 'done' : 'todo', completedAt: done ? new Date().toISOString() : null }, award: null, next: null };
      }
      current.set(id, result.task);
      // A repeating task's next copy: made here, once, when it's ticked off (never again by the sync).
      if (done && before && before.status !== 'done') {
        const nd = nextDraft(result.task);
        if (nd) result = { ...result, next: await service.save({ ...nd, assigneeId: result.task.assigneeId === saved.me ? null : result.task.assigneeId }) };
      }
      return result;
    },
    async remove(id) {
      if (direct(id)) {
        try {
          await inner.remove(id);
          current.delete(id);
          return;
        } catch (e) {
          if (!isOffline(e)) throw e;
        }
      }
      // Never reached the server: forget it. Otherwise remove it when back online.
      await enqueue(id, (q) => (q.create ? null : { clientId: q.clientId, kind: 'task', taskId: id, userId: q.userId, remove: true, updatedAt: q.updatedAt }));
      current.delete(id);
    },
    async progress() {
      await ready;
      try {
        const p = await inner.progress();
        persist({ awards: p.awards, kudos: p.kudos });
        return p;
      } catch (e) {
        if (!isOffline(e) || !hasSaved) throw e;
        return { awards: saved.awards, kudos: saved.kudos };
      }
    },
    async team() {
      await ready;
      try {
        const team = await inner.team();
        persist({ team });
        return team;
      } catch (e) {
        if (!isOffline(e) || !saved.team) throw e;
        return saved.team;
      }
    },
    setTeamGoal: (goal) => inner.setTeamGoal(goal),
    async assignees() {
      await ready;
      try {
        const people = await inner.assignees();
        persist({ people });
        return people;
      } catch (e) {
        if (!isOffline(e)) throw e;
        return saved.people;
      }
    },
    sendKudos: (toId, message) => inner.sendKudos(toId, message),
    pending: () => new Map(mine().map((e) => [e.taskId, e])),
    savedAt: () => fromDevice,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    sync() {
      if (!syncing) syncing = runSync().finally(() => (syncing = null));
      return syncing;
    },
    async discard(taskId) {
      await enqueue(taskId, () => null);
    },
  };

  if (typeof window !== 'undefined') window.addEventListener('online', () => void service.sync());
  return service;
}
