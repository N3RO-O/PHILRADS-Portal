import type { ModuleId, TaskPriority, TaskStatus } from '../../types';
import { MODULES } from '../../config/modules';

export const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const PRIORITY_STYLE: Record<TaskPriority, { pill: string; bar: string }> = {
  high: { pill: 'bg-burgundy-50 text-burgundy', bar: 'bg-burgundy' },
  medium: { pill: 'bg-uplift-100 text-uplift-700', bar: 'bg-uplift' },
  low: { pill: 'bg-white text-muted ring-1 ring-black/10', bar: 'bg-black/15' },
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: 'bg-black/25',
  in_progress: 'bg-uplift',
  review: 'bg-burgundy',
  done: 'bg-emerald-600',
  cancelled: 'bg-black/10',
};

export const moduleLabel = (id: ModuleId | null) => (id ? MODULES.find((m) => m.id === id)?.label ?? '' : '');

export const matchesSearch = (query: string, ...parts: (string | undefined | null)[]) =>
  !query || parts.filter(Boolean).join(' ').toLowerCase().includes(query);
