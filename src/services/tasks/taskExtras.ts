import type { SupabaseClient } from '@supabase/supabase-js';
import { demoProfile } from '../../data/mockDashboard';
import type { TaskPriority } from '../../types';
import { TASK_LISTS, TaskRuleError, type TaskList, type WorkSetting } from './types';

/** A note on a task, between the person who gave it and the person doing it (and anyone else who can see it). */
export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}

/** One task in a template: what it is and how many days after the start it's due. */
export interface TemplateItem {
  title: string;
  /** Days after the start date (0 = the start date). */
  day: number;
  priority: TaskPriority;
  requiresPhoto: boolean;
}

/** A set of tasks for work PHILRADS does again and again (a relief distribution, a training). */
export interface TaskTemplate {
  id: string;
  name: string;
  list: TaskList;
  setting: WorkSetting;
  items: TemplateItem[];
  createdById: string | null;
  createdByName: string;
  updatedAt: string;
}

export type TemplateDraft = Pick<TaskTemplate, 'name' | 'list' | 'setting' | 'items'> & { id?: string };

export const COMMENT_MAX = 1000;
export const TEMPLATE_MAX_ITEMS = 30;

export interface TaskExtrasService {
  comments(taskId: string): Promise<TaskComment[]>;
  addComment(taskId: string, body: string): Promise<TaskComment>;
  /** Your own comments only. */
  removeComment(id: string): Promise<void>;
  templates(): Promise<TaskTemplate[]>;
  saveTemplate(t: TemplateDraft): Promise<TaskTemplate>;
  /** Yours, or any (tasks.manage). */
  removeTemplate(id: string): Promise<void>;
}

const cleanItems = (items: TemplateItem[]): TemplateItem[] =>
  items
    .map((i) => ({ title: i.title.trim().slice(0, 200), day: Math.max(0, Math.min(365, Math.round(i.day) || 0)), priority: i.priority, requiresPhoto: Boolean(i.requiresPhoto) }))
    .filter((i) => i.title)
    .slice(0, TEMPLATE_MAX_ITEMS);

const checkTemplate = (t: TemplateDraft) => {
  if (!t.name.trim()) throw new TaskRuleError('Give the template a name.');
  if (!cleanItems(t.items).length) throw new TaskRuleError('Add at least one task to the template.');
};

// ───────────────────────── Sample (demo) ─────────────────────────

const KEY = 'philrads.taskExtras.v1';
interface SampleState {
  comments: TaskComment[];
  templates: TaskTemplate[];
}
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const seed = (): SampleState => ({
  comments: [],
  templates: [
    {
      id: 'tpl-distribution',
      name: 'Relief distribution',
      list: 'emergency',
      setting: 'field',
      items: [
        { title: 'Confirm the beneficiary list with the barangay', day: 0, priority: 'high', requiresPhoto: false },
        { title: 'Arrange the truck and driver', day: 0, priority: 'high', requiresPhoto: false },
        { title: 'Pack the family food packs', day: 1, priority: 'medium', requiresPhoto: true },
        { title: 'Distribute and collect signed acknowledgement forms', day: 2, priority: 'high', requiresPhoto: true },
        { title: 'Submit distribution photos and the report', day: 3, priority: 'medium', requiresPhoto: false },
      ],
      createdById: 'p-ana',
      createdByName: 'Ana Reyes',
      updatedAt: ago(72),
    },
    {
      id: 'tpl-training',
      name: 'Community training day',
      list: 'training',
      setting: 'field',
      items: [
        { title: 'Book the venue and confirm the date', day: 0, priority: 'medium', requiresPhoto: false },
        { title: 'Print the attendance sheets and handouts', day: 5, priority: 'medium', requiresPhoto: false },
        { title: 'Run the training and take photos', day: 7, priority: 'high', requiresPhoto: true },
        { title: 'Write the training report', day: 9, priority: 'medium', requiresPhoto: false },
      ],
      createdById: demoProfile.id,
      createdByName: demoProfile.displayName,
      updatedAt: ago(200),
    },
  ],
});
const read = (): SampleState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as SampleState;
  } catch {
    /* fall back to the seed */
  }
  return seed();
};
const write = (s: SampleState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* demo only */
  }
};
const later = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));
const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export const mockTaskExtras: TaskExtrasService = {
  async comments(taskId) {
    return later(read().comments.filter((c) => c.taskId === taskId));
  },
  async addComment(taskId, body) {
    const text = body.trim().slice(0, COMMENT_MAX);
    if (!text) throw new TaskRuleError('Write something first.');
    const s = read();
    const c: TaskComment = { id: newId(), taskId, authorId: demoProfile.id, authorName: demoProfile.displayName, body: text, createdAt: new Date().toISOString() };
    s.comments.push(c);
    write(s);
    return later(c);
  },
  async removeComment(id) {
    const s = read();
    s.comments = s.comments.filter((c) => !(c.id === id && c.authorId === demoProfile.id));
    write(s);
    await later(null);
  },
  async templates() {
    return later(read().templates);
  },
  async saveTemplate(t) {
    checkTemplate(t);
    const s = read();
    const saved: TaskTemplate = {
      id: t.id ?? newId(),
      name: t.name.trim().slice(0, 80),
      list: t.list,
      setting: t.setting,
      items: cleanItems(t.items),
      createdById: demoProfile.id,
      createdByName: demoProfile.displayName,
      updatedAt: new Date().toISOString(),
    };
    const old = s.templates.find((x) => x.id === saved.id);
    if (old && old.createdById !== demoProfile.id) throw new TaskRuleError(`Only ${old.createdByName} can change this template.`);
    s.templates = old ? s.templates.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...s.templates];
    write(s);
    return later(saved);
  },
  async removeTemplate(id) {
    const s = read();
    s.templates = s.templates.filter((x) => x.id !== id);
    write(s);
    await later(null);
  },
};

// ───────────────────────── Supabase ─────────────────────────

export function createSupabaseTaskExtras(client: SupabaseClient): TaskExtrasService {
  const fail = (what: string, error: { message: string; code?: string }): never => {
    console.error(`[tasks] ${what}`, error);
    if (!navigator.onLine || /failed to fetch|networkerror|load failed/i.test(error.message)) throw new TaskRuleError('You’re offline. Connect and try again.');
    if (error.code === '42501') throw new TaskRuleError(/row-level security|permission denied/i.test(error.message) ? 'Your role does not allow this.' : error.message);
    if (error.code?.startsWith('23')) throw new TaskRuleError('The server rejected this. Check what you wrote and try again.');
    throw new Error(`Couldn’t ${what}. Try again.`);
  };
  const name = (r: Record<string, unknown>, key: string) => (((r[key] as { display_name?: string } | null)?.display_name ?? '').trim() || 'Former staff member');
  const mapComment = (r: Record<string, unknown>): TaskComment => ({
    id: r.id as string,
    taskId: r.task_id as string,
    authorId: (r.author_id as string | null) ?? null,
    authorName: name(r, 'author'),
    body: r.body as string,
    createdAt: r.created_at as string,
  });
  const mapTemplate = (r: Record<string, unknown>): TaskTemplate => ({
    id: r.id as string,
    name: r.name as string,
    list: (TASK_LISTS as readonly string[]).includes(r.list as string) ? (r.list as TaskList) : 'emergency',
    setting: r.work_setting === 'office' ? 'office' : 'field',
    items: cleanItems(Array.isArray(r.items) ? (r.items as TemplateItem[]) : []),
    createdById: (r.created_by as string | null) ?? null,
    createdByName: name(r, 'creator'),
    updatedAt: r.updated_at as string,
  });
  const commentCols = 'id, task_id, author_id, body, created_at, author:profiles!task_comments_author_id_fkey(display_name)';
  const templateCols = 'id, name, list, work_setting, items, created_by, updated_at, creator:profiles!task_templates_created_by_fkey(display_name)';

  return {
    async comments(taskId) {
      const { data, error } = await client.from('task_comments').select(commentCols).eq('task_id', taskId).order('created_at').limit(500);
      if (error) fail('load the comments', error);
      return (data ?? []).map((r) => mapComment(r as Record<string, unknown>));
    },
    async addComment(taskId, body) {
      const text = body.trim().slice(0, COMMENT_MAX);
      if (!text) throw new TaskRuleError('Write something first.');
      const { data, error } = await client.from('task_comments').insert({ task_id: taskId, body: text }).select(commentCols).single();
      if (error) fail('post the comment', error);
      return mapComment(data as Record<string, unknown>);
    },
    async removeComment(id) {
      const { error } = await client.from('task_comments').delete().eq('id', id);
      if (error) fail('delete the comment', error);
    },
    async templates() {
      const { data, error } = await client.from('task_templates').select(templateCols).order('name').limit(200);
      if (error) fail('load the templates', error);
      return (data ?? []).map((r) => mapTemplate(r as Record<string, unknown>));
    },
    async saveTemplate(t) {
      checkTemplate(t);
      const row = { name: t.name.trim().slice(0, 80), list: t.list, work_setting: t.setting, items: cleanItems(t.items) };
      const q = t.id ? client.from('task_templates').update(row).eq('id', t.id) : client.from('task_templates').insert(row);
      const { data, error } = await q.select(templateCols).single();
      if (error) fail('save the template', error);
      return mapTemplate(data as Record<string, unknown>);
    },
    async removeTemplate(id) {
      const { error } = await client.from('task_templates').delete().eq('id', id);
      if (error) fail('delete the template', error);
    },
  };
}
