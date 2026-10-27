import { useId, useState, type FormEvent } from 'react';
import { Building2, CalendarDays, Flag, Loader2, MapPin, Plus, SlidersHorizontal, Sun } from 'lucide-react';
import { dueLabel, LIST_META, parseQuickAdd } from '../../lib/tasks';
import type { TaskDraft, TaskList, WorkSetting } from '../../services/tasks/types';
import { LIST_STYLE } from './taskMeta';

interface Props {
  today: string;
  /** Defaults from the view being looked at (a list, Field/Office, My Day). */
  defaults: { list: TaskList; setting: WorkSetting; myDay: boolean; dueDate?: string | null };
  onAdd: (draft: TaskDraft) => Promise<boolean>;
  /** Open the full form with what was typed so far. */
  onMore: (draft: TaskDraft) => void;
  disabled?: boolean;
}

/** Type a task and press Enter. Dates, times, !priority, #list and @field / @office are understood. */
export function QuickAdd({ today, defaults, onAdd, onMore, disabled }: Props) {
  const uid = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = parseQuickAdd(text, today);

  const draft = (): TaskDraft => ({
    title: parsed.title,
    notes: '',
    list: parsed.list ?? defaults.list,
    setting: parsed.setting ?? (parsed.list ? LIST_META[parsed.list].setting : defaults.setting),
    priority: parsed.priority ?? 'medium',
    dueDate: parsed.dueDate ?? defaults.dueDate ?? (defaults.myDay ? today : null),
    dueTime: parsed.dueTime,
    // Added from My Day: planned for today, unless another day was typed.
    myDay: (defaults.myDay && !parsed.dueDate) || (parsed.dueDate ?? defaults.dueDate) === today ? today : null,
    subtasks: [],
    recurrence: 'none',
    location: '',
    assigneeId: null,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed.title || busy) return;
    setBusy(true);
    const ok = await onAdd(draft());
    setBusy(false);
    if (ok) setText('');
  };

  const d = draft();
  const due = dueLabel(d, today);
  const style = LIST_STYLE[d.list];
  const typed = text.trim().length > 0;

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`${uid}-q`} className="sr-only">
            Add a task
          </label>
          <Plus className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-uplift" aria-hidden />
          <input
            id={`${uid}-q`}
            data-quick-add
            className="field pl-11"
            placeholder="Add a task…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            enterKeyHint="done"
            autoComplete="off"
            aria-describedby={typed ? `${uid}-hint` : undefined}
            disabled={disabled}
          />
        </div>
        <button type="button" className="btn-ghost shrink-0 px-3" onClick={() => (onMore(d), setText(''))} disabled={disabled} title="Add with details">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Details</span>
        </button>
        <button type="submit" className="btn-primary shrink-0 px-4" disabled={disabled || busy || !parsed.title}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          <span className="sr-only sm:not-sr-only">Add</span>
        </button>
      </div>
      {typed && (
        <p id={`${uid}-hint`} className="flex flex-wrap items-center gap-1.5 text-xs" aria-live="polite">
          <span className={`badge gap-1 border-transparent ${style.soft} ${style.text}`}>
            <style.icon className="h-3 w-3" aria-hidden /> {LIST_META[d.list].label}
          </span>
          <span className="badge gap-1 border-line text-ink-soft">
            {d.setting === 'field' ? <MapPin className="h-3 w-3" aria-hidden /> : <Building2 className="h-3 w-3" aria-hidden />}
            {d.setting === 'field' ? 'Field' : 'Office'}
          </span>
          {due && (
            <span className="badge gap-1 border-uplift/40 bg-uplift/10 text-uplift">
              <CalendarDays className="h-3 w-3" aria-hidden /> {due}
            </span>
          )}
          {d.myDay && (
            <span className="badge gap-1 border-uplift/40 text-uplift">
              <Sun className="h-3 w-3" aria-hidden /> My Day
            </span>
          )}
          {d.priority !== 'medium' && (
            <span className={`badge gap-1 ${d.priority === 'high' ? 'border-rose/40 bg-rose/10 text-rose' : 'border-line text-ink-soft'}`}>
              <Flag className="h-3 w-3" aria-hidden /> {d.priority === 'high' ? 'High' : 'Low'} priority
            </span>
          )}
        </p>
      )}
    </form>
  );
}
