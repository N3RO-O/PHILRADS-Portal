import { useMemo, useState } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { formatShortDate } from '../../lib/format';
import { daysBetween, LIST_META } from '../../lib/tasks';
import type { Task } from '../../services/tasks/types';
import { PersonAvatar } from '../ui/PersonAvatar';
import { SlidingPill } from '../ui/SlidingPill';
import { LIST_STYLE } from './taskMeta';

/** Where a task given to someone stands, by colour. */
type Standing = 'done' | 'in_progress' | 'review' | 'not_started' | 'overdue';

const STANDING: Record<Standing, { label: string; row: string; chip: string; dot: string }> = {
  done: { label: 'Done', row: 'border-l-status-in bg-status-in/[0.08]', chip: 'border-status-in/40 bg-status-in/15 text-status-in', dot: 'bg-status-in' },
  in_progress: { label: 'In progress', row: 'border-l-status-low bg-status-low/[0.08]', chip: 'border-status-low/40 bg-status-low/15 text-status-low', dot: 'bg-status-low' },
  review: { label: 'For review', row: 'border-l-sky-300 bg-sky-300/[0.07]', chip: 'border-sky-300/40 bg-sky-300/15 text-sky-300', dot: 'bg-sky-300' },
  not_started: { label: 'Not started', row: 'border-l-ink-mute bg-white/[0.02]', chip: 'border-line bg-white/[0.04] text-ink-soft', dot: 'bg-ink-mute' },
  overdue: { label: 'Overdue', row: 'border-l-status-out bg-status-out/[0.08]', chip: 'border-status-out/40 bg-status-out/15 text-status-out', dot: 'bg-status-out' },
};
const ORDER: Standing[] = ['overdue', 'not_started', 'in_progress', 'review', 'done'];

export const standingOf = (t: Task, today: string): Standing =>
  t.status === 'done'
    ? 'done'
    : t.status === 'review'
      ? 'review'
      : t.status === 'in_progress'
        ? 'in_progress'
        : t.dueDate && daysBetween(today, t.dueDate) < 0
          ? 'overdue'
          : 'not_started';

/**
 * Coordinators and admins: every task given to someone else, by person, coloured by where it
 * stands: done green, in progress yellow, for review blue, not started grey (red once overdue).
 * Admins can switch between the tasks they gave and everyone's.
 */
export function TeamTasks({ tasks, me, today, canSeeAll, onOpen }: { tasks: Task[]; me: string | null; today: string; canSeeAll: boolean; onOpen: (t: Task) => void }) {
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [only, setOnly] = useState<Standing | null>(null);

  const given = useMemo(
    () => tasks.filter((t) => t.status !== 'cancelled' && t.assigneeId && t.assigneeId !== t.createdById && (scope === 'all' ? true : t.createdById === me)),
    [tasks, scope, me],
  );
  const counts = useMemo(() => {
    const c: Record<Standing, number> = { done: 0, in_progress: 0, review: 0, not_started: 0, overdue: 0 };
    for (const t of given) c[standingOf(t, today)]++;
    return c;
  }, [given, today]);
  const people = useMemo(() => {
    const byPerson = new Map<string, { id: string; name: string; tasks: Task[] }>();
    for (const t of given) {
      if (only && standingOf(t, today) !== only) continue;
      const p = byPerson.get(t.assigneeId!) ?? { id: t.assigneeId!, name: t.assigneeName ?? 'Staff member', tasks: [] };
      p.tasks.push(t);
      byPerson.set(t.assigneeId!, p);
    }
    const rank = (t: Task) => ORDER.indexOf(standingOf(t, today));
    return [...byPerson.values()]
      .map((p) => ({ ...p, tasks: p.tasks.sort((a, b) => rank(a) - rank(b) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [given, only, today]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {canSeeAll && (
          <div role="group" aria-label="Whose tasks" className="relative flex gap-1 rounded-lg bg-surface-sunken p-0.5">
            <SlidingPill className="rounded-md bg-surface-raised shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.06]" />
            {(
              [
                ['mine', 'Given by me'],
                ['all', 'Everyone’s'],
              ] as const
            ).map(([s, label]) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => setScope(s)}
                className="tap min-h-8 rounded-md px-2.5 text-xs font-semibold text-ink-soft relative z-10 transition-colors duration-500 aria-pressed:text-ink"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {/* The counts double as filters. */}
        {ORDER.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={only === s}
            onClick={() => setOnly(only === s ? null : s)}
            className={`tap inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition ${STANDING[s].chip} ${only && only !== s ? 'opacity-40' : ''}`}
          >
            <span className={`h-2 w-2 rounded-full ${STANDING[s].dot}`} aria-hidden /> {STANDING[s].label} <span className="tabular-nums">{counts[s]}</span>
          </button>
        ))}
      </div>

      {people.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line/70 px-4 py-8 text-center text-sm text-muted">
          {given.length ? 'Nothing with this status.' : scope === 'all' ? 'No one has been given a task yet.' : 'You haven’t given anyone a task yet.'}
        </p>
      ) : (
        people.map((p) => {
          const done = p.tasks.filter((t) => t.status === 'done').length;
          return (
            <section key={p.id} aria-label={p.name} className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2.5">
                <PersonAvatar id={p.id} name={p.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="text-xs text-muted tabular-nums">
                  {done} of {p.tasks.length} done
                </span>
              </h3>
              <ul className="flex flex-col gap-1.5">
                {p.tasks.map((t) => {
                  const s = standingOf(t, today);
                  const style = LIST_STYLE[t.list];
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => onOpen(t)} className={`tap flex w-full items-center gap-3 rounded-lg border border-l-4 border-line/50 px-3 py-2.5 text-left transition hover:brightness-125 ${STANDING[s].row}`}>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-medium ${s === 'done' ? 'text-ink-soft line-through decoration-ink-mute/60' : 'text-ink'}`}>{t.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-muted">
                            <span className={`inline-flex items-center gap-1 ${style.text}`}>
                              <style.icon className="h-3 w-3" aria-hidden /> {LIST_META[t.list].label}
                            </span>
                            {t.dueDate && (
                              <span className={`inline-flex items-center gap-1 ${s === 'overdue' ? 'font-semibold text-status-out' : ''}`}>
                                <CalendarDays className="h-3 w-3" aria-hidden /> {formatShortDate(t.dueDate)}
                              </span>
                            )}
                            {t.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" aria-hidden /> {t.location}
                              </span>
                            )}
                            {scope === 'all' && t.createdByName && <span>from {t.createdByName}</span>}
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold ${STANDING[s].chip}`}>{STANDING[s].label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
