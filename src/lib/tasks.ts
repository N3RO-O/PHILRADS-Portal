import type { TaskPriority } from '../types';
import type { Recurrence, Task, TaskList, WorkSetting } from '../services/tasks/types';
import { todayKey } from './inventory';

/** Task list names, where that work usually happens, and the words quick add understands (#relief, #warehouse…). */
export const LIST_META: Record<TaskList, { label: string; setting: WorkSetting; words: string[] }> = {
  relief: { label: 'Relief distribution', setting: 'field', words: ['relief', 'distribution', 'distro'] },
  assessment: { label: 'Needs assessment', setting: 'field', words: ['assessment', 'assess', 'rna', 'survey'] },
  logistics: { label: 'Warehouse and logistics', setting: 'field', words: ['logistics', 'warehouse', 'stock', 'transport'] },
  beneficiaries: { label: 'Beneficiary records', setting: 'office', words: ['beneficiaries', 'beneficiary', 'records', 'masterlist'] },
  reports: { label: 'Reports and documentation', setting: 'office', words: ['reports', 'report', 'docs', 'documentation'] },
  volunteers: { label: 'Volunteers and training', setting: 'office', words: ['volunteers', 'volunteer', 'training'] },
  coordination: { label: 'Coordination and meetings', setting: 'office', words: ['coordination', 'meeting', 'meetings', 'lgu'] },
  office: { label: 'Office and admin', setting: 'office', words: ['office', 'admin', 'finance'] },
};

export const SETTING_LABEL: Record<WorkSetting, string> = { field: 'Field', office: 'Office' };
export const RECURRENCE_LABEL: Record<Recurrence, string> = { none: 'Does not repeat', daily: 'Every day', weekly: 'Every week', monthly: 'Every month' };

// ───────────────────────── Dates (Manila days, YYYY-MM-DD) ─────────────────────────

const DAY = 86_400_000;
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const keyMs = (key: string) => Date.parse(`${key}T00:00:00Z`);

export const addDays = (key: string, n: number) => toKey(keyMs(key) + n * DAY);
export const addMonths = (key: string, n: number) => {
  const d = new Date(keyMs(key));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  // Keep the 31st as the month's last day.
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return toKey(d.getTime());
};
/** 0 = Sunday. */
export const weekday = (key: string) => new Date(keyMs(key)).getUTCDay();
export const daysBetween = (from: string, to: string) => Math.round((keyMs(to) - keyMs(from)) / DAY);

/** The next due date of a repeating task, counted from its due date (or today). */
export function nextOccurrence(task: Pick<Task, 'dueDate' | 'recurrence'>, today = todayKey()): string | null {
  const from = task.dueDate ?? today;
  if (task.recurrence === 'daily') return addDays(from, 1);
  if (task.recurrence === 'weekly') return addDays(from, 7);
  if (task.recurrence === 'monthly') return addMonths(from, 1);
  return null;
}

export type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'someday';
export const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'Next 7 days',
  later: 'Later',
  someday: 'Someday',
};
export const BUCKETS: Bucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'someday'];

export function bucketOf(dueDate: string | null, today = todayKey()): Bucket {
  if (!dueDate) return 'someday';
  const d = daysBetween(today, dueDate);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  return d <= 7 ? 'week' : 'later';
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
/** Soonest first, then high priority, then time of day. */
export const compareTasks = (a: Task, b: Task) =>
  (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
  (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') ||
  a.createdAt.localeCompare(b.createdAt);

/** "Today", "Tomorrow", "Mon 3 Nov", with the time when there is one. */
export function dueLabel(task: Pick<Task, 'dueDate' | 'dueTime'>, today = todayKey()) {
  if (!task.dueDate) return null;
  const d = daysBetween(today, task.dueDate);
  const day =
    d === 0
      ? 'Today'
      : d === 1
        ? 'Tomorrow'
        : d === -1
          ? 'Yesterday'
          : new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(keyMs(task.dueDate)));
  return task.dueTime ? `${day}, ${formatTime12(task.dueTime)}` : day;
}

export const formatTime12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};

// ───────────────────────── Quick add ─────────────────────────

export interface QuickAddResult {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: TaskPriority | null;
  list: TaskList | null;
  setting: WorkSetting | null;
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const listFor = (word: string): TaskList | null => {
  const w = word.toLowerCase();
  return (Object.keys(LIST_META) as TaskList[]).find((k) => k === w || LIST_META[k].words.includes(w)) ?? null;
};

/** A month and day, in this year or the next if it has already passed. */
const monthDay = (month: number, day: number, today: string) => {
  const year = Number(today.slice(0, 4));
  const fmt = (y: number) => `${y}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (day < 1 || day > 31 || Number.isNaN(Date.parse(`${fmt(year)}T00:00:00Z`))) return null;
  return fmt(year) < today ? fmt(year + 1) : fmt(year);
};

/**
 * Reads what staff type in the quick-add box, Any.do style:
 * "Pack 200 hygiene kits tomorrow 3pm !high #relief @field".
 * Understands today / tonight / tomorrow / weekdays / "next week" / "in 3 days" / "Nov 3" / "3/11",
 * a time (3pm, 15:30), !high / !low, #list and @field / @office. Everything else is the title.
 */
export function parseQuickAdd(input: string, today = todayKey()): QuickAddResult {
  let text = ` ${input.trim()} `;
  const out: QuickAddResult = { title: '', dueDate: null, dueTime: null, priority: null, list: null, setting: null };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = text.match(re);
    if (m && fn(m) !== false) text = text.replace(m[0], ' ');
  };

  take(/\s!(high|h|urgent|!!)(?=\s)/i, () => void (out.priority = 'high'));
  take(/\s!(medium|med|m)(?=\s)/i, () => void (out.priority = 'medium'));
  take(/\s!(low|l)(?=\s)/i, () => void (out.priority = 'low'));
  take(/\s#([a-z]+)(?=\s)/i, (m) => {
    out.list = listFor(m[1]);
    return out.list !== null;
  });
  take(/\s@(field|office)(?=\s)/i, (m) => void (out.setting = m[1].toLowerCase() as WorkSetting));

  // Time: "at 3pm", "3:30 pm", "15:00".
  take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s)/i, (m) => {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === 'pm') h += 12;
    if (Number(m[1]) > 12 || Number(m[2] ?? 0) > 59) return false;
    out.dueTime = `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
  });
  if (!out.dueTime)
    take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/, (m) => void (out.dueTime = `${m[1].padStart(2, '0')}:${m[2]}`));

  // Day.
  take(/\s(today|tonight|tdy)(?=\s)/i, (m) => {
    out.dueDate = today;
    if (m[1].toLowerCase() === 'tonight' && !out.dueTime) out.dueTime = '19:00';
  });
  if (!out.dueDate) take(/\s(tomorrow|tmrw|tmr|bukas)(?=\s)/i, () => void (out.dueDate = addDays(today, 1)));
  if (!out.dueDate) take(/\snext\s+week(?=\s)/i, () => void (out.dueDate = addDays(today, ((8 - weekday(today)) % 7) || 7)));
  if (!out.dueDate) take(/\sin\s+(\d{1,3})\s+days?(?=\s)/i, (m) => void (out.dueDate = addDays(today, Number(m[1]))));
  if (!out.dueDate)
    take(/\s(?:on\s+|next\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*(?=\s)/i, (m) => {
      const target = WEEKDAYS.indexOf(m[1].slice(0, 3).toLowerCase());
      const ahead = (target - weekday(today) + 7) % 7 || 7;
      out.dueDate = addDays(today, ahead);
    });
  if (!out.dueDate)
    take(/\s(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?=\s)/i, (m) => {
      out.dueDate = monthDay(MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), Number(m[2]), today);
      return out.dueDate !== null;
    });
  if (!out.dueDate)
    take(/\s(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?=\s)/i, (m) => {
      out.dueDate = monthDay(MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), Number(m[1]), today);
      return out.dueDate !== null;
    });
  // Month/day, as dates are usually written in the Philippines: 11/3 is 3 November.
  if (!out.dueDate)
    take(/\s(?:on\s+)?(\d{1,2})\/(\d{1,2})(?=\s)/, (m) => {
      out.dueDate = monthDay(Number(m[1]) - 1, Number(m[2]), today);
      return out.dueDate !== null;
    });
  // A time on its own means today.
  if (out.dueTime && !out.dueDate) out.dueDate = today;

  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}
