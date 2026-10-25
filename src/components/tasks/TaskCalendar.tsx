import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { compareTasks } from '../../lib/tasks';
import type { Task } from '../../services/tasks/types';
import { LIST_STYLE } from './taskMeta';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');

interface Props {
  /** The person's tasks with a due date (open and done). */
  tasks: Task[];
  today: string;
  selected: string;
  onSelect: (day: string) => void;
  /** The selected day's tasks, rendered by the page (rows with checkboxes). */
  children: (dayTasks: Task[], label: string) => ReactNode;
}

/**
 * Month view of tasks on their due dates, Any.do style: titles in each day where the boxes are wide
 * enough, coloured dots where they're narrow. Tap a day to see its tasks below.
 */
export function TaskCalendar({ tasks, today, selected, onSelect, children }: Props) {
  const [year, setYear] = useState(Number(selected.slice(0, 4)));
  const [month, setMonth] = useState(Number(selected.slice(5, 7)) - 1);
  // Follow the selected day when it moves to another month (e.g. "Today").
  useEffect(() => {
    setYear(Number(selected.slice(0, 4)));
    setMonth(Number(selected.slice(5, 7)) - 1);
  }, [selected]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of [...tasks].sort(compareTasks)) if (t.dueDate) map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
    return map;
  }, [tasks]);

  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const monthPrefix = `${year}-${pad(month + 1)}`;
  const openThisMonth = tasks.filter((t) => t.status !== 'done' && t.dueDate?.startsWith(monthPrefix)).length;

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  };

  const dayTasks = byDay.get(selected) ?? [];
  const label = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${selected}T00:00:00Z`));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="icon-btn h-9 w-9" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <p className="text-center text-sm font-semibold" aria-live="polite">
          {monthLabel}
          <span className="block text-xs font-normal text-muted">{openThisMonth} open task{openThisMonth === 1 ? '' : 's'} due</span>
        </p>
        <div className="flex items-center gap-1">
          {selected !== today && (
            <button type="button" className="chip min-h-9" onClick={() => onSelect(today)}>
              Today
            </button>
          )}
          <button type="button" className="icon-btn h-9 w-9" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div key={monthPrefix} className="grid animate-fade-in grid-cols-7 gap-1" role="grid" aria-label={monthLabel}>
        {WEEKDAYS.map((d) => (
          <span key={d} role="columnheader" className="pb-1 text-center text-[0.6875rem] font-semibold text-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const key = `${monthPrefix}-${pad(i + 1)}`;
          const due = byDay.get(key) ?? [];
          const open = due.filter((t) => t.status !== 'done');
          const overdue = key < today && open.length > 0;
          const isToday = key === today;
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`))}${isToday ? ', today' : ''}${
                open.length ? `, ${open.length} open` : ''
              }${due.length - open.length ? `, ${due.length - open.length} done` : ''}`}
              onClick={() => onSelect(key)}
              className={`flex min-h-[3.25rem] min-w-0 flex-col items-stretch gap-1 rounded-lg border p-1 text-left transition-colors md:min-h-[5.5rem] md:p-1.5 xl:min-h-[3.25rem] xl:p-1 2xl:min-h-[5.5rem] 2xl:p-1.5 ${
                isSelected ? 'border-uplift bg-uplift/10' : 'border-transparent bg-surface-sunken hover:bg-surface-raised'
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center self-center rounded-full text-xs font-semibold tabular-nums md:self-start xl:self-center 2xl:self-start ${
                  isToday ? 'bg-uplift text-page' : overdue ? 'text-rose' : open.length ? 'text-ink' : 'text-muted'
                }`}
              >
                {i + 1}
              </span>
              {/* Narrow day boxes (phones, and the three-column layout at xl): one dot per task (up to 3). */}
              {due.length > 0 && (
                <span className="flex flex-wrap items-center justify-center gap-0.5 md:hidden xl:flex 2xl:hidden" aria-hidden>
                  {due.slice(0, 3).map((t) => (
                    <span key={t.id} className={`h-1.5 w-1.5 rounded-full bg-current ${t.status === 'done' ? 'text-ink-mute/50' : LIST_STYLE[t.list].text}`} />
                  ))}
                  {due.length > 3 && <span className="text-[0.5625rem] leading-none text-muted">+{due.length - 3}</span>}
                </span>
              )}
              {/* Wide day boxes: the first two titles. */}
              <span className="hidden min-w-0 flex-col gap-0.5 md:flex xl:hidden 2xl:flex" aria-hidden>
                {due.slice(0, 2).map((t) => (
                  <span
                    key={t.id}
                    className={`truncate rounded px-1 py-px text-[0.625rem] font-medium leading-tight ${
                      t.status === 'done' ? 'text-muted line-through' : `${LIST_STYLE[t.list].soft} ${LIST_STYLE[t.list].text}`
                    }`}
                  >
                    {t.title}
                  </span>
                ))}
                {due.length > 2 && <span className="px-1 text-[0.625rem] text-muted">+{due.length - 2} more</span>}
              </span>
            </button>
          );
        })}
      </div>

      <section aria-live="polite" aria-label={label}>
        {children(dayTasks, label)}
      </section>
    </div>
  );
}
