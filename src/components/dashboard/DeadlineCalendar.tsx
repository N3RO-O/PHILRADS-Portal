import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react';
import { DAY_TONE, HOLIDAY_KIND_LABEL, HOLIDAY_STYLE, holidayOn, holidaysIn } from '../../config/holidays';
import type { AsyncState } from '../../hooks/useAsyncData';
import { manilaDayKey } from '../../lib/format';
import { dashboardService } from '../../services';
import type { TaskSummary } from '../../types';
import { Card, LoadError, Skeleton } from '../ui/Card';
import { PRIORITY_LABEL } from './labels';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (day: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-PH', { ...o, timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

interface Props {
  tasks: AsyncState<TaskSummary[]> & { reload: () => void };
}

/**
 * Month view of your task due dates, with weekends set apart (Saturday blue, Sunday rose) and
 * Philippine holidays marked (src/config/holidays.ts).
 */
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
  const prefix = `${year}-${pad(month + 1)}`;
  const monthName = new Intl.DateTimeFormat('en-PH', { month: 'long', timeZone: 'UTC' }).format(first);
  const holidays = holidaysIn(prefix);
  const dueThisMonth = [...byDay.entries()].filter(([d]) => d.startsWith(prefix)).reduce((s, [, ts]) => s + ts.length, 0);

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  };
  const goToday = () => {
    setYear(Number(todayKey.slice(0, 4)));
    setMonth(Number(todayKey.slice(5, 7)) - 1);
    setSelected(todayKey);
  };

  const selectedTasks = byDay.get(selected) ?? [];
  const selectedHoliday = holidayOn(selected);
  const onThisMonth = prefix === todayKey.slice(0, 7);

  return (
    <Card id="deadlines" title="Calendar" note="Your due dates and Philippine holidays" source={dashboardService.source} className="h-full">
      <div className="flex items-center justify-between gap-2">
        <p aria-live="polite" className="leading-tight">
          <span className="text-lg font-bold tracking-tight">{monthName}</span> <span className="text-lg font-medium text-muted">{year}</span>
          <span className="block text-[0.6875rem] text-muted">
            {dueThisMonth} due · {holidays.filter((h) => h.kind !== 'working').length} holiday{holidays.filter((h) => h.kind !== 'working').length === 1 ? '' : 's'}
          </span>
        </p>
        <div className="flex items-center gap-1 rounded-xl border border-line/70 bg-surface-sunken p-1">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-raised hover:text-ink" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className={`h-8 rounded-lg px-2.5 text-xs font-semibold ${onThisMonth && selected === todayKey ? 'text-muted' : 'text-ink hover:bg-surface-raised'}`}
            onClick={goToday}
          >
            Today
          </button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-raised hover:text-ink" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {tasks.status === 'error' && <LoadError message={tasks.error.message} onRetry={tasks.reload} />}
      {tasks.status === 'loading' && <Skeleton className="h-64" />}
      {tasks.status === 'success' && (
        <>
          <div key={prefix} className="animate-fade-in overflow-hidden rounded-xl border border-line/60" role="grid" aria-label={`${monthName} ${year}`}>
            <div className="grid grid-cols-7 border-b border-line/60 bg-surface-sunken" role="row">
              {WEEKDAYS.map((d, i) => (
                <span
                  key={d}
                  role="columnheader"
                  className={`py-2 text-center text-[0.625rem] font-bold uppercase tracking-[0.08em] ${i === 5 ? `${DAY_TONE.saturday} bg-sky-300/[0.06]` : i === 6 ? `${DAY_TONE.sunday} bg-rose/[0.07]` : 'text-muted'}`}
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7" role="rowgroup">
              {Array.from({ length: lead }, (_, i) => (
                <span key={`b${i}`} aria-hidden className={`h-11 border-b border-r border-line/40 ${i === 5 ? 'bg-sky-300/[0.04]' : ''}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const key = `${prefix}-${pad(day)}`;
                const col = (lead + i) % 7;
                const due = byDay.get(key) ?? [];
                const holiday = holidayOn(key);
                const isToday = key === todayKey;
                const isSelected = key === selected;
                const weekendBg = col === 5 ? 'bg-sky-300/[0.04]' : col === 6 ? 'bg-rose/[0.05]' : '';
                const holidayBg = holiday?.kind === 'regular' ? 'bg-status-out/[0.09]' : holiday?.kind === 'special' ? 'bg-uplift/[0.08]' : '';
                const numberTone = isToday
                  ? 'bg-uplift text-page'
                  : holiday && holiday.kind !== 'working'
                    ? DAY_TONE[holiday.kind]
                    : col === 5
                      ? DAY_TONE.saturday
                      : col === 6
                        ? DAY_TONE.sunday
                        : 'text-ink-soft';
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    title={holiday ? `${holiday.name} (${HOLIDAY_KIND_LABEL[holiday.kind]})` : undefined}
                    aria-label={`${fmt(key, { weekday: 'long', month: 'long', day: 'numeric' })}${isToday ? ', today' : ''}${holiday ? `, ${holiday.name}` : ''}${due.length ? `, ${due.length} due` : ''}`}
                    onClick={() => setSelected(key)}
                    className={`relative flex h-11 flex-col items-center justify-center gap-0.5 border-b border-r border-line/40 transition-colors ${holidayBg || weekendBg} ${
                      col === 6 ? 'border-r-0' : ''
                    } ${isSelected ? 'z-[1] outline outline-2 -outline-offset-2 outline-uplift' : 'hover:bg-white/[0.05]'}`}
                  >
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold tabular-nums ${numberTone}`}>{day}</span>
                    <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                      {holiday && holiday.kind !== 'working' && <span className={`h-1.5 w-3 rounded-full ${HOLIDAY_STYLE[holiday.kind].dot}`} />}
                      {due.slice(0, 3).map((t) => (
                        <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${t.priority === 'high' ? 'bg-rose' : 'bg-ink-soft'}`} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.6875rem] text-muted" aria-hidden>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-ink-soft" /> Due</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose" /> High priority</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-status-out" /> Regular holiday</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-uplift" /> Special non-working</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-300/30" /><span className="h-2.5 w-2.5 rounded-sm bg-rose/30" /> Weekend</span>
          </div>

          <div className="tile flex flex-col gap-2 px-4 py-3" aria-live="polite">
            <p className="text-xs font-semibold text-ink">{fmt(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            {selectedHoliday && (
              <p className={`inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold ${HOLIDAY_STYLE[selectedHoliday.kind].chip}`}>
                <PartyPopper className="h-3 w-3" aria-hidden /> {selectedHoliday.name} · {HOLIDAY_KIND_LABEL[selectedHoliday.kind]}
              </p>
            )}
            {selectedTasks.length === 0 ? (
              <p className="text-xs text-muted">Nothing due.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {selectedTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-xs text-ink-soft">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.priority === 'high' ? 'bg-rose' : 'bg-ink-soft'}`} aria-hidden />
                    <span className="min-w-0 truncate">{t.title}</span>
                    <span className="shrink-0 text-muted">· {PRIORITY_LABEL[t.priority]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {holidays.length > 0 && (
            <section aria-label={`Holidays in ${monthName}`} className="flex flex-col gap-1.5">
              <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted">Holidays in {monthName}</h3>
              <ul className="flex flex-col gap-1">
                {holidays.map((h) => (
                  <li key={h.date}>
                    <button
                      type="button"
                      onClick={() => setSelected(h.date)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/[0.04]"
                    >
                      <span className={`w-14 shrink-0 rounded-md border px-1.5 py-0.5 text-center font-semibold tabular-nums ${HOLIDAY_STYLE[h.kind].chip}`}>
                        {fmt(h.date, { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">{h.name}</span>
                      <span className="hidden shrink-0 text-muted sm:inline">{fmt(h.date, { weekday: 'short' })} · {HOLIDAY_KIND_LABEL[h.kind]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Card>
  );
}
