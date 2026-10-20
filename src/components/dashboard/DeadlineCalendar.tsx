import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AsyncState } from '../../hooks/useAsyncData';
import { manilaDayKey } from '../../lib/format';
import { dashboardService } from '../../services';
import type { TaskSummary } from '../../types';
import { Card, LoadError, Skeleton } from '../ui/Card';
import { PRIORITY_LABEL } from './labels';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const pad = (n: number) => String(n).padStart(2, '0');

interface Props {
  tasks: AsyncState<TaskSummary[]> & { reload: () => void };
}

/** Month view of your task due dates. */
export function DeadlineCalendar({ tasks }: Props) {
  const todayKey = manilaDayKey(new Date().toISOString());
  const [year, setYear] = useState(Number(todayKey.slice(0, 4)));
  const [month, setMonth] = useState(Number(todayKey.slice(5, 7)) - 1);
  const [selected, setSelected] = useState(todayKey);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskSummary[]>();
    if (tasks.status === 'success')
      for (const t of tasks.data) if (t.dueDate) map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
    return map;
  }, [tasks]);

  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  };

  const selectedTasks = byDay.get(selected) ?? [];
  const selectedLabel = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${selected}T00:00:00Z`),
  );

  return (
    <Card id="deadlines" title="Deadlines calendar" note="Due dates of your tasks" source={dashboardService.source} className="h-full">
      <div className="flex items-center justify-between">
        <button type="button" className="icon-btn h-9 w-9" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <p className="text-sm font-semibold" aria-live="polite">
          {monthLabel}
        </p>
        <button type="button" className="icon-btn h-9 w-9" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {tasks.status === 'error' && <LoadError message={tasks.error.message} onRetry={tasks.reload} />}
      {tasks.status === 'loading' && <Skeleton className="h-56" />}
      {tasks.status === 'success' && (
        <>
          <div key={`${year}-${month}`} className="grid animate-fade-in grid-cols-7 gap-1.5 text-center" role="grid" aria-label={monthLabel}>
            {WEEKDAYS.map((d) => (
              <span key={d} role="columnheader" className="pb-1 text-[0.6875rem] font-semibold text-muted">
                {d}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`b${i}`} aria-hidden />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const key = `${year}-${pad(month + 1)}-${pad(day)}`;
              const due = byDay.get(key) ?? [];
              const high = due.some((t) => t.priority === 'high');
              const isToday = key === todayKey;
              const isSelected = key === selected;
              const tone = isSelected
                ? 'border-uplift bg-uplift text-page'
                : high
                  ? 'border-rose/50 bg-rose/15 text-rose hover:bg-rose/25'
                  : due.length
                    ? 'border-ink-mute/50 bg-surface-raised text-ink hover:bg-[#3a3b42]'
                    : `border-transparent bg-surface-sunken hover:bg-surface-raised ${isToday ? 'text-uplift' : 'text-ink-soft'}`;
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`${day}${isToday ? ', today' : ''}${due.length ? `, ${due.length} due` : ''}`}
                  onClick={() => setSelected(key)}
                  className={`h-9 rounded-lg border text-xs font-semibold tabular-nums transition-colors ${tone} ${
                    isToday && !isSelected ? 'ring-1 ring-uplift' : ''
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-muted" aria-hidden>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-ink-mute/50 bg-surface-raised" /> Due</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-rose/50 bg-rose/15" /> High priority due</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm ring-1 ring-uplift" /> Today</span>
          </div>
          <div className="tile mt-auto px-4 py-3" aria-live="polite">
            <p className="text-xs font-semibold text-ink">{selectedLabel}</p>
            {selectedTasks.length === 0 ? (
              <p className="text-xs text-muted">Nothing due.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {selectedTasks.map((t) => (
                  <li key={t.id} className="text-xs text-ink-soft">
                    {t.title} <span className="text-muted">· {PRIORITY_LABEL[t.priority]} priority</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
