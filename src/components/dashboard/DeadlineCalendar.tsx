import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react';
import { HOLIDAY_KIND_LABEL, HOLIDAY_STYLE, holidayOn, holidaysIn } from '../../config/holidays';
import type { AsyncState } from '../../hooks/useAsyncData';
import { manilaDayKey } from '../../lib/format';
import { dashboardService } from '../../services';
import type { TaskSummary } from '../../types';
import { Card, LoadError, Skeleton } from '../ui/Card';
import { PRIORITY_LABEL, STATUS_LABEL } from './labels';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const dateOf = (key: string) => new Date(`${key}T00:00:00Z`);
const addDays = (key: string, n: number) => {
  const d = dateOf(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
};
const fmt = (day: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-PH', { ...o, timeZone: 'UTC' }).format(dateOf(day));

interface Props {
  tasks: AsyncState<TaskSummary[]> & { reload: () => void };
}

/**
 * Month view of your due dates and Philippine holidays (src/config/holidays.ts), laid out like the
 * calendars people already know: six full weeks with the neighbouring months' days greyed, today
 * in yellow, the day you pick in burgundy, and with room the tasks written in the days themselves
 * ("+2 more" when they don't fit). Arrow keys move between days, Page Up / Page Down change month,
 * and on phones a swipe does. The agenda beside (or under) it lists the chosen day and what's next.
 */
export function DeadlineCalendar({ tasks }: Props) {
  const todayKey = manilaDayKey(new Date().toISOString());
  const [view, setView] = useState({ year: Number(todayKey.slice(0, 4)), month: Number(todayKey.slice(5, 7)) - 1 });
  const [selected, setSelected] = useState(todayKey);
  const [dir, setDir] = useState<'next' | 'prev' | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskSummary[]>();
    if (tasks.status === 'success')
      for (const t of tasks.data)
        if (t.dueDate) map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t].sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high')));
    return map;
  }, [tasks]);

  const { year, month } = view;
  const first = new Date(Date.UTC(year, month, 1));
  const prefix = `${year}-${pad(month + 1)}`;
  const lead = (first.getUTCDay() + 6) % 7;
  const start = addDays(keyOf(first), -lead);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const monthName = new Intl.DateTimeFormat('en-PH', { month: 'long', timeZone: 'UTC' }).format(first);
  const holidays = holidaysIn(prefix);
  const offDays = holidays.filter((h) => h.kind !== 'working').length;
  const dueThisMonth = [...byDay.entries()].filter(([d]) => d.startsWith(prefix)).reduce((s, [, ts]) => s + ts.length, 0);
  const onThisMonth = prefix === todayKey.slice(0, 7);

  const show = (key: string, focus = false) => {
    const target = { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 };
    if (target.year !== year || target.month !== month) {
      setDir(key > prefix ? 'next' : 'prev');
      setView(target);
    }
    setSelected(key);
    if (focus) requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-day="${key}"]`)?.focus());
  };
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setDir(delta > 0 ? 'next' : 'prev');
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
    // Keep the same day of the month picked, where it exists.
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    setSelected(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(Math.min(Number(selected.slice(8, 10)), last))}`);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) show(addDays(selected, moves[e.key]), true);
    else if (e.key === 'Home') show(addDays(selected, -((dateOf(selected).getUTCDay() + 6) % 7)), true);
    else if (e.key === 'End') show(addDays(selected, 6 - ((dateOf(selected).getUTCDay() + 6) % 7)), true);
    else if (e.key === 'PageUp') shift(-1);
    else if (e.key === 'PageDown') shift(1);
    else return;
    e.preventDefault();
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) shift(dx < 0 ? 1 : -1);
  };

  const selectedTasks = byDay.get(selected) ?? [];
  const upcoming = [...byDay.entries()]
    .filter(([d]) => d >= todayKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([d, ts]) => ts.map((t) => ({ day: d, task: t })))
    .slice(0, 5);
  const selectedHoliday = holidayOn(selected);
  const daysAway = Math.round((dateOf(selected).getTime() - dateOf(todayKey).getTime()) / 86_400_000);
  const relative = daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : daysAway === -1 ? 'Yesterday' : daysAway > 0 ? `In ${daysAway} days` : `${-daysAway} days ago`;

  return (
    <Card id="deadlines" title="Calendar" note="Your due dates and Philippine holidays" source={dashboardService.source} className="h-full">
      <div className="flex flex-col gap-4 [container-type:inline-size]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div aria-live="polite" className="leading-tight">
            <p className="font-display text-2xl tracking-wide">
              {monthName} <span className="text-muted">{year}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {dueThisMonth} due · {offDays} holiday{offDays === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => show(todayKey)} disabled={onThisMonth && selected === todayKey}>
              <CalendarDays className="h-4 w-4" aria-hidden /> Today
            </button>
            <div className="flex items-center rounded-xl border border-line bg-surface">
              <button type="button" className="press grid h-9 w-9 place-items-center rounded-l-xl text-ink-soft hover:bg-surface-raised hover:text-ink" onClick={() => shift(-1)} aria-label="Previous month">
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <span className="h-5 w-px bg-line" aria-hidden />
              <button type="button" className="press grid h-9 w-9 place-items-center rounded-r-xl text-ink-soft hover:bg-surface-raised hover:text-ink" onClick={() => shift(1)} aria-label="Next month">
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {tasks.status === 'error' && <LoadError message={tasks.error.message} onRetry={tasks.reload} />}
        {tasks.status === 'loading' && <Skeleton className="h-72" />}
        {tasks.status === 'success' && (
          <div className="grid grid-cols-1 gap-5 [@container(min-width:44rem)]:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="flex min-w-0 flex-col gap-3">
              <div
                ref={grid}
                role="grid"
                aria-label={`${monthName} ${year}`}
                onKeyDown={onKey}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                className="touch-pan-y overflow-hidden rounded-2xl border border-line bg-surface"
              >
                <div className="grid grid-cols-7 border-b border-line" role="row">
                  {WEEKDAYS.map((d, i) => (
                    <span key={d} role="columnheader" className={`py-2.5 text-center text-[0.6875rem] font-semibold uppercase tracking-wider ${i >= 5 ? 'text-ink-mute/70' : 'text-muted'}`}>
                      <span className="[@container(min-width:30rem)]:hidden">{d[0]}</span>
                      <span className="hidden [@container(min-width:30rem)]:inline">{d}</span>
                    </span>
                  ))}
                </div>
                <div
                  key={prefix}
                  className={`grid grid-cols-7 ${dir === 'next' ? 'animate-cal-next' : dir === 'prev' ? 'animate-cal-prev' : 'animate-fade-in'}`}
                >
                  {Array.from({ length: 6 }, (_, w) => (
                    <div key={w} role="row" className="contents">
                      {cells.slice(w * 7, w * 7 + 7).map((key, col) => {
                        const inMonth = key.startsWith(prefix);
                        const due = byDay.get(key) ?? [];
                        const open = due.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
                        const holiday = holidayOn(key);
                        const off = holiday && holiday.kind !== 'working';
                        const isToday = key === todayKey;
                        const isSelected = key === selected;
                        const late = key < todayKey && open.length > 0;
                        const number = isToday
                          ? 'bg-uplift font-bold text-onaccent shadow-[0_4px_12px_-4px_rgba(236,149,42,0.8)]'
                          : isSelected
                            ? 'gloss bg-burgundy-500 font-bold text-cloud'
                            : !inMonth
                              ? 'text-ink-mute/45'
                              : off
                                ? holiday.kind === 'regular'
                                  ? 'font-semibold text-status-out'
                                  : 'font-semibold text-status-low'
                                : col >= 5
                                  ? 'text-muted'
                                  : 'text-ink';
                        return (
                          <button
                            key={key}
                            type="button"
                            role="gridcell"
                            data-day={key}
                            tabIndex={isSelected ? 0 : -1}
                            aria-selected={isSelected}
                            aria-current={isToday ? 'date' : undefined}
                            title={holiday ? `${holiday.name} (${HOLIDAY_KIND_LABEL[holiday.kind]})` : undefined}
                            aria-label={`${fmt(key, { weekday: 'long', month: 'long', day: 'numeric' })}${isToday ? ', today' : ''}${holiday ? `, ${holiday.name}` : ''}${due.length ? `, ${due.length} due` : ''}`}
                            onClick={() => show(key)}
                            className={`group relative flex min-h-[3.25rem] min-w-0 flex-col items-center gap-1 border-line/60 p-1 text-left transition-colors focus-visible:z-[1] [@container(min-width:30rem)]:min-h-[5.75rem] [@container(min-width:30rem)]:items-stretch [@container(min-width:30rem)]:p-1.5 ${
                              col < 6 ? 'border-r' : ''
                            } ${w < 5 ? 'border-b' : ''} ${isSelected ? 'bg-burgundy-500/[0.12]' : 'hover:bg-ink/[0.04]'} ${!inMonth ? 'bg-surface-sunken/60' : ''}`}
                          >
                            <span className="flex items-center justify-between gap-1">
                              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs tabular-nums transition-transform group-active:scale-90 ${number}`}>
                                {Number(key.slice(8, 10))}
                              </span>
                              {off && (
                                <PartyPopper
                                  className={`hidden h-3.5 w-3.5 shrink-0 [@container(min-width:30rem)]:block ${holiday.kind === 'regular' ? 'text-status-out' : 'text-status-low'}`}
                                  aria-hidden
                                />
                              )}
                            </span>
                            {/* Phones: one small mark per task (red when late or high priority), a bar for a holiday. */}
                            <span className="flex h-1.5 items-center gap-0.5 [@container(min-width:30rem)]:hidden" aria-hidden>
                              {off && <span className={`h-1 w-3 rounded-full ${HOLIDAY_STYLE[holiday.kind].dot}`} />}
                              {due.slice(0, 3).map((t) => (
                                <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${late || t.priority === 'high' ? 'bg-status-out' : t.status === 'done' ? 'bg-ink-mute/50' : 'bg-ink-soft'}`} />
                              ))}
                            </span>
                            {/* With room: the holiday and the tasks themselves, written in the day. */}
                            <span className="hidden min-w-0 flex-col gap-0.5 [@container(min-width:30rem)]:flex" aria-hidden>
                              {off && <span className={`truncate rounded px-1 py-px text-[0.625rem] font-semibold ${HOLIDAY_STYLE[holiday.kind].chip}`}>{holiday.name}</span>}
                              {due.slice(0, off ? 1 : 2).map((t) => (
                                <span
                                  key={t.id}
                                  className={`truncate rounded border-l-2 px-1 py-px text-[0.625rem] font-medium ${
                                    t.status === 'done'
                                      ? 'border-ink-mute/40 text-ink-mute line-through'
                                      : late || t.priority === 'high'
                                        ? 'border-status-out bg-status-out/10 text-ink'
                                        : 'border-ink-soft bg-ink/[0.05] text-ink-soft'
                                  }`}
                                >
                                  {t.title}
                                </span>
                              ))}
                              {due.length > (off ? 1 : 2) && <span className="px-1 text-[0.625rem] font-semibold text-muted">+{due.length - (off ? 1 : 2)} more</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-out" aria-hidden /> High priority or late
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-3 rounded-full bg-status-out" aria-hidden /> Regular holiday
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-3 rounded-full bg-status-low" aria-hidden /> Special non-working day
                </span>
                <span className="hidden sm:inline">Arrow keys move between days · swipe on a phone</span>
              </p>
            </div>

            {/* The agenda: beside the month with room, under it otherwise. */}
            <div className="flex min-w-0 flex-col gap-5">
              <section aria-live="polite" className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{fmt(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                  <span className={`shrink-0 text-xs ${daysAway === 0 ? 'font-semibold text-uplift' : 'text-muted'}`}>{relative}</span>
                </div>
                {selectedHoliday && (
                  <p className={`inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold ${HOLIDAY_STYLE[selectedHoliday.kind].chip}`}>
                    <PartyPopper className="h-3.5 w-3.5" aria-hidden /> {selectedHoliday.name} · {HOLIDAY_KIND_LABEL[selectedHoliday.kind]}
                  </p>
                )}
                {selectedTasks.length === 0 ? (
                  <p className="text-xs text-muted">Nothing due{daysAway < 0 ? '' : ' — a clear day'}.</p>
                ) : (
                  <ul className="flex flex-col">
                    {selectedTasks.map((t) => (
                      <li key={t.id} className="flex items-start gap-2 border-t border-line py-2 text-xs first:border-t-0">
                        <span className={`mt-1 h-3 w-0.5 shrink-0 rounded-full ${t.priority === 'high' ? 'bg-status-out' : 'bg-ink-mute'}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate font-medium ${t.status === 'done' ? 'text-muted line-through' : 'text-ink'}`}>{t.title}</span>
                          <span className="text-muted">
                            {STATUS_LABEL[t.status]} · <span className={t.priority === 'high' ? 'font-semibold text-status-out' : ''}>{PRIORITY_LABEL[t.priority]} priority</span>
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to="/tasks" className="link w-fit">
                  Open Tasks
                </Link>
              </section>

              <section aria-label="Coming up" className="flex flex-col gap-1.5">
                <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted">Coming up</h3>
                {upcoming.length === 0 ? (
                  <p className="text-xs text-muted">Nothing due from today on.</p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {upcoming.map(({ day, task }) => (
                      <li key={task.id}>
                        <button type="button" onClick={() => show(day)} className="press flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left text-xs hover:bg-ink/[0.05]">
                          <span className="flex w-10 shrink-0 flex-col items-center leading-none">
                            <span className="text-[0.625rem] font-semibold uppercase text-muted">{day === todayKey ? 'Today' : fmt(day, { month: 'short' })}</span>
                            <span className={`font-display text-base ${day === todayKey ? 'text-uplift' : 'text-ink'}`}>{Number(day.slice(8, 10))}</span>
                          </span>
                          <span className="min-w-0 flex-1 truncate text-ink">{task.title}</span>
                          {task.priority === 'high' && <span className="shrink-0 font-semibold text-status-out">High</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {holidays.length > 0 && (
                <section aria-label={`Holidays in ${monthName}`} className="flex flex-col gap-1.5">
                  <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted">Holidays in {monthName}</h3>
                  <ul className="flex flex-col gap-0.5">
                    {holidays.map((h) => (
                      <li key={h.date}>
                        <button type="button" onClick={() => show(h.date)} className="press flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left text-xs hover:bg-ink/[0.05]">
                          <span className={`min-w-14 shrink-0 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-center font-semibold tabular-nums ${HOLIDAY_STYLE[h.kind].chip}`}>
                            {fmt(h.date, { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-ink">{h.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
