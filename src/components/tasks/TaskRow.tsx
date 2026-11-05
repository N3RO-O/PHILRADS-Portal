import { Building2, Camera, CloudOff, Flag, Hourglass, ListChecks, MapPin, Repeat, Sun, TriangleAlert } from 'lucide-react';
import { daysBetween, dueLabel, LIST_META } from '../../lib/tasks';
import type { Task } from '../../services/tasks/types';
import { LIST_STYLE } from './taskMeta';
import { SuccessTick } from '../ui/SuccessTick';

interface Props {
  /** Tasks being removed: they slide away (see LeavingRow). */
  leavingIds?: ReadonlySet<string>;
  task: Task;
  today: string;
  me: string | null;
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  onMyDay?: (t: Task) => void;
  /** Mark a task you're doing as in progress (Start). Finish goes through onToggle. */
  onStart?: (t: Task) => void;
  /** "+30 XP" shown briefly after ticking it off. */
  flash?: number | null;
  /** Show which list it's in (not needed inside a list's own view). */
  showList?: boolean;
  /** Changed on this device and not on the server yet (`waiting`), or refused by the server (`failed`). */
  syncOf?: (t: Task) => 'waiting' | 'failed' | null;
}

/** One task, Any.do style: a round checkbox in the list's colour, the title, and one line of details. */
export function TaskRow({ task: t, today, me, onToggle, onOpen, onMyDay, onStart, flash, showList = true, syncOf, leavingIds }: Props) {
  const leaving = leavingIds?.has(t.id) ?? false;
  const sync = syncOf?.(t) ?? null;
  const done = t.status === 'done';
  const style = LIST_STYLE[t.list];
  const due = dueLabel(t, today);
  const overdue = !done && t.dueDate !== null && daysBetween(today, t.dueDate) < 0;
  const subDone = t.subtasks.filter((s) => s.done).length;
  const fromOther = t.createdById && t.createdById !== me && t.assigneeId === me ? t.createdByName : null;
  const forOther = t.assigneeId && t.assigneeId !== me ? t.assigneeName : null;
  const inMyDay = t.myDay === today;
  // Waiting to be accepted: the person it's for answers first (the checkbox opens the task instead).
  const pending = t.acceptance === 'pending';
  const needsMe = pending && t.assigneeId === me && t.createdById !== me;

  return (
    <li className={`leave-row ${leaving ? 'is-leaving' : ''}`} aria-hidden={leaving || undefined}>
      <div className="leave-row-inner">
        <div className="group relative flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-raised/50">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
            onClick={() => (needsMe ? onOpen(t) : onToggle(t))}
            className="-m-2 grid h-10 w-10 shrink-0 place-items-center rounded-full"
          >
            {done ? (
              <SuccessTick className="h-[1.375rem] w-[1.375rem] text-uplift" />
            ) : (
              <span className={`grid h-[1.375rem] w-[1.375rem] place-items-center rounded-full border-2 transition ${style.ring} group-hover:bg-ink/5`} />
            )}
          </button>

          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(t)}>
            <span className={`block text-sm font-medium leading-snug ${done ? 'text-muted line-through decoration-ink-mute/60' : 'text-ink'}`}>{t.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
              {sync === 'waiting' && (
                <span className="inline-flex items-center gap-1 font-semibold text-ink-soft">
                  <CloudOff className="h-3 w-3" aria-hidden /> Waiting to sync
                </span>
              )}
              {sync === 'failed' && (
                <span className="inline-flex items-center gap-1 font-semibold text-rose">
                  <TriangleAlert className="h-3 w-3" aria-hidden /> Couldn’t sync
                </span>
              )}
              {needsMe && (
                <span className="inline-flex items-center gap-1 rounded border border-line px-1.5 font-semibold text-ink-soft">
                  <Hourglass className="h-3 w-3" aria-hidden /> Accept or decline
                </span>
              )}
              {pending && !needsMe && t.assigneeId !== me && <span className="rounded border border-line px-1.5 font-semibold text-ink-soft">Waiting for {t.assigneeName ?? 'them'} to accept</span>}
              {t.acceptance === 'declined' && <span className="rounded bg-status-out/15 px-1.5 font-semibold text-status-out">Declined</span>}
              {t.status === 'in_progress' && <span className="rounded bg-status-low/15 px-1.5 font-semibold text-status-low">In progress</span>}
              {due && <span className={overdue ? 'font-semibold text-rose' : t.dueDate === today && !done ? 'font-semibold text-status-low' : ''}>{due}</span>}
              {showList && (
                <span className={`inline-flex items-center gap-1 ${style.text}`}>
                  <style.icon className="h-3 w-3" aria-hidden /> {LIST_META[t.list].label}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                {t.setting === 'field' ? <MapPin className="h-3 w-3" aria-hidden /> : <Building2 className="h-3 w-3" aria-hidden />}
                {t.setting === 'field' ? 'Field' : 'Office'}
              </span>
              {t.subtasks.length > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <ListChecks className="h-3 w-3" aria-hidden /> {subDone}/{t.subtasks.length}
                </span>
              )}
              {t.requiresPhoto && !done && (
                <span className="inline-flex items-center gap-1 rounded bg-uplift/15 px-1.5 font-semibold text-uplift">
                  <Camera className="h-3 w-3" aria-hidden /> Photo needed
                </span>
              )}
              {t.recurrence !== 'none' && <Repeat className="h-3 w-3" aria-label="Repeats" />}
              {fromOther && <span>from {fromOther}</span>}
              {forOther && <span>for {forOther}</span>}
            </span>
          </button>

          <span className="flex shrink-0 items-center gap-1">
            {flash ? (
              <span className="animate-pop-in rounded-full border border-uplift/50 bg-uplift/15 px-2 py-0.5 text-xs font-bold tabular-nums text-uplift">+{flash} XP</span>
            ) : (
              t.priority === 'high' && !done && <Flag className="h-4 w-4 fill-rose/30 text-rose" aria-label="High priority" />
            )}
            {/* Your task: Start it, then Finish it (finishing one from someone else asks for an output). */}
            {onStart && !done && !pending && (t.assigneeId ?? t.createdById) === me && (
              t.status === 'in_progress' ? (
                <button type="button" className="press rounded-full border border-status-in/40 bg-status-in/10 px-2.5 py-1 text-xs font-semibold text-status-in hover:bg-status-in/20" onClick={() => onToggle(t)}>
                  Finish
                </button>
              ) : (
                <button type="button" className="press rounded-full border border-status-low/40 bg-status-low/10 px-2.5 py-1 text-xs font-semibold text-status-low hover:bg-status-low/20" onClick={() => onStart(t)}>
                  Start
                </button>
              )
            )}
            {onMyDay && !done && (
              <button
                type="button"
                className={`icon-btn h-9 w-9 ${inMyDay ? 'text-ink' : 'opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100'}`}
                aria-pressed={inMyDay}
                aria-label={inMyDay ? `Take “${t.title}” off today’s plan` : `Plan “${t.title}” for today`}
                title={inMyDay ? 'Planned for today' : 'Plan for today'}
                onClick={() => onMyDay(t)}
              >
                <Sun className={`h-4 w-4 ${inMyDay ? 'fill-uplift/30' : ''}`} aria-hidden />
              </button>
            )}
          </span>
        </div>
      </div>
    </li>
  );
}
