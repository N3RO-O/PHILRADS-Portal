import { Building2, Check, Flag, ListChecks, MapPin, Repeat, Sun } from 'lucide-react';
import { daysBetween, dueLabel, LIST_META } from '../../lib/tasks';
import type { Task } from '../../services/tasks/types';
import { LIST_STYLE } from './taskMeta';

interface Props {
  task: Task;
  today: string;
  me: string | null;
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  onMyDay?: (t: Task) => void;
  /** "+30 XP" shown briefly after ticking it off. */
  flash?: number | null;
  /** Show which list it's in (not needed inside a list's own view). */
  showList?: boolean;
}

/** One task, Any.do style: a round checkbox in the list's colour, the title, and one line of details. */
export function TaskRow({ task: t, today, me, onToggle, onOpen, onMyDay, flash, showList = true }: Props) {
  const done = t.status === 'done';
  const style = LIST_STYLE[t.list];
  const due = dueLabel(t, today);
  const overdue = !done && t.dueDate !== null && daysBetween(today, t.dueDate) < 0;
  const subDone = t.subtasks.filter((s) => s.done).length;
  const fromOther = t.createdById && t.createdById !== me && t.assigneeId === me ? t.createdByName : null;
  const forOther = t.assigneeId && t.assigneeId !== me ? t.assigneeName : null;
  const inMyDay = t.myDay === today;

  return (
    <li className="group relative flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-raised/50">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
        onClick={() => onToggle(t)}
        className="-m-2 grid h-10 w-10 shrink-0 place-items-center rounded-full"
      >
        <span
          className={`grid h-[1.375rem] w-[1.375rem] place-items-center rounded-full border-2 transition ${
            done ? 'animate-pop-in border-uplift bg-uplift text-page' : `${style.ring} group-hover:bg-white/5`
          }`}
        >
          {done && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
        </span>
      </button>

      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(t)}>
        <span className={`block text-sm font-medium leading-snug ${done ? 'text-muted line-through decoration-ink-mute/60' : 'text-ink'}`}>{t.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
          {due && <span className={overdue ? 'font-semibold text-rose' : t.dueDate === today && !done ? 'text-uplift' : ''}>{due}</span>}
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
        {onMyDay && !done && (
          <button
            type="button"
            className={`icon-btn h-9 w-9 ${inMyDay ? 'text-uplift' : 'opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100'}`}
            aria-pressed={inMyDay}
            aria-label={inMyDay ? `Remove “${t.title}” from My Day` : `Add “${t.title}” to My Day`}
            title={inMyDay ? 'In My Day' : 'Add to My Day'}
            onClick={() => onMyDay(t)}
          >
            <Sun className={`h-4 w-4 ${inMyDay ? 'fill-uplift/30' : ''}`} aria-hidden />
          </button>
        )}
      </span>
    </li>
  );
}
