import type { DataSource, TaskPriority, TaskStatus } from '../../types';

/** Humanitarian task lists (supabase/migrations/20261027000000_tasks_module.sql). */
export const TASK_LISTS = ['relief', 'assessment', 'logistics', 'beneficiaries', 'reports', 'volunteers', 'coordination', 'office'] as const;
export type TaskList = (typeof TASK_LISTS)[number];

/** Where the work happens: out in the field or at the office. */
export type WorkSetting = 'field' | 'office';

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  list: TaskList;
  setting: WorkSetting;
  priority: TaskPriority;
  status: TaskStatus;
  /** YYYY-MM-DD (Manila) or null for "Someday". */
  dueDate: string | null;
  /** HH:MM or null. */
  dueTime: string | null;
  /** The day the assignee planned it for (My Day), YYYY-MM-DD. */
  myDay: string | null;
  subtasks: Subtask[];
  recurrence: Recurrence;
  /** Where: barangay, evacuation centre, warehouse… */
  location: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string | null;
  createdByName: string | null;
  /** The project it belongs to, if any. */
  projectId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDraft {
  id?: string;
  /**
   * For a new task: its id, made on this device. Saving the same new task again (a retry after a
   * dropped connection, or the offline queue syncing twice) finds it instead of adding a second one.
   */
  newId?: string;
  title: string;
  notes: string;
  list: TaskList;
  setting: WorkSetting;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  myDay: string | null;
  subtasks: Subtask[];
  recurrence: Recurrence;
  location: string;
  /** Null: the person adding it. */
  assigneeId: string | null;
  /** The project it belongs to (kept when editing). */
  projectId?: string | null;
}

/** Small changes saved straight away (My Day, a subtask ticked). */
export type TaskPatch = Partial<Pick<Task, 'myDay' | 'subtasks' | 'priority' | 'dueDate'>>;

/** XP earned for one finished task (written by the database, never by the browser). */
export interface XpAward {
  taskId: string;
  taskTitle: string;
  points: number;
  base: number;
  onTime: number;
  subtasks: number;
  /** Set by the person who did it: counts toward the daily cap. */
  selfSet: boolean;
  /** Fewer points than earned because the daily cap for self-set tasks was reached. */
  capped: boolean;
  /** added_done: the task was added already finished (no XP; not counted for badges or streaks). */
  flag: 'added_done' | null;
  /** YYYY-MM-DD (Manila). */
  day: string;
  awardedAt: string;
}

export interface Kudos {
  id: string;
  fromName: string;
  message: string;
  points: number;
  createdAt: string;
}

export interface TeamProgress {
  /** First day of the month, YYYY-MM-DD. */
  month: string;
  done: number;
  goal: number;
}

export interface Assignee {
  id: string;
  name: string;
}

/** What completing (or re-opening) a task did. */
export interface CompletionResult {
  task: Task;
  award: XpAward | null;
  /** The next occurrence of a repeating task (added by the offline layer, once, when it's ticked off). */
  next: Task | null;
}

/** No connection: the change can wait in the offline queue. */
export class TaskOfflineError extends Error {
  constructor(message = 'You’re offline.') {
    super(message);
    this.name = 'TaskOfflineError';
  }
}

export class TaskRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskRuleError';
  }
}

export interface TasksService {
  readonly source: DataSource;
  /** Whose tasks "mine" means. */
  currentUserId(): Promise<string | null>;
  /** Tasks the signed-in person can see (cancelled ones left out). */
  list(): Promise<Task[]>;
  save(draft: TaskDraft): Promise<Task>;
  patch(id: string, patch: TaskPatch): Promise<Task>;
  /** Mark done (XP is awarded) or re-open (XP is taken back). */
  complete(id: string, done: boolean): Promise<CompletionResult>;
  /** Cancels the task; history and XP records stay. */
  remove(id: string): Promise<void>;
  /** The signed-in person's XP and kudos. */
  progress(): Promise<{ awards: XpAward[]; kudos: Kudos[] }>;
  team(): Promise<TeamProgress>;
  /** tasks.manage only. */
  setTeamGoal(goal: number): Promise<void>;
  /** Active staff, for assigning (tasks.manage) and kudos. */
  assignees(): Promise<Assignee[]>;
  /** tasks.manage only: +15 XP and a bell notification for them. */
  sendKudos(toId: string, message: string): Promise<void>;
  /** The person who gave a finished task (or a coordinator) re-opens it with a reason; its XP is taken back. Online only. */
  sendBack(id: string, reason: string): Promise<Task>;
}
