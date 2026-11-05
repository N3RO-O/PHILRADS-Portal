import type { ModuleId, TaskPriority, TaskStatus } from '../../types';
import { MODULES } from '../../config/modules';

export const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const PRIORITY_BADGE: Record<TaskPriority, string> = {
  high: 'border-status-out/40 text-status-out',
  medium: 'border-line text-ink-soft',
  low: 'border-line text-muted',
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

/** Task status as a word in its state colour (docs/design-system.md): no dot. */
export const STATUS_TEXT: Record<TaskStatus, string> = {
  todo: 'text-ink-soft',
  in_progress: 'text-ink',
  review: 'text-ink-soft',
  done: 'text-status-in',
  cancelled: 'text-muted line-through',
};

/**
 * Figures, rows and badges are neutral; only a progress bar takes the accent. Kept as a list so
 * older callers that pick a tone by index still work, but every entry is the same.
 */
const NEUTRAL = { text: 'text-ink-soft', bar: 'bg-uplift', badge: 'border-line text-ink-soft', soft: 'text-ink-soft' } as const;
export const TONES = [NEUTRAL, NEUTRAL, NEUTRAL] as const;

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
