import type { ModuleId, TaskPriority, TaskStatus } from '../../types';
import { MODULES } from '../../config/modules';

export const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const PRIORITY_BADGE: Record<TaskPriority, string> = {
  high: 'border-rose/40 bg-rose/10 text-rose',
  medium: 'border-uplift/40 bg-uplift/10 text-uplift',
  low: 'border-line bg-surface-raised text-ink-soft',
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: 'bg-ink-mute',
  in_progress: 'bg-uplift',
  review: 'bg-rose',
  done: 'bg-emerald-400',
  cancelled: 'bg-line',
};

/** The three accent tones used for KPI tiles, table rows and badges, in rotation. */
export const TONES = [
  { text: 'text-uplift', bar: 'bg-uplift', badge: 'border-uplift/40 bg-uplift/10 text-uplift', soft: 'bg-uplift/10 text-uplift' },
  { text: 'text-rose', bar: 'bg-rose', badge: 'border-rose/40 bg-rose/10 text-rose', soft: 'bg-rose/10 text-rose' },
  { text: 'text-ink-soft', bar: 'bg-ink-soft', badge: 'border-ink-mute/40 bg-white/5 text-ink-soft', soft: 'bg-white/5 text-ink-soft' },
] as const;

export const moduleLabel = (id: ModuleId | null) => (id ? MODULES.find((m) => m.id === id)?.label ?? '' : '');

export const matchesSearch = (query: string, ...parts: (string | undefined | null)[]) =>
  !query || parts.filter(Boolean).join(' ').toLowerCase().includes(query);

const DAY = 86_400_000;
/** "9 days left", "Ends today", "Past end date" or "No end date". */
export function timeLeft(endDate: string | null) {
  if (!endDate) return 'No end date';
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - start) / DAY);
  if (days < 0) return 'Past end date';
  if (days === 0) return 'Ends today';
  return `${days} ${days === 1 ? 'day' : 'days'} left`;
}
