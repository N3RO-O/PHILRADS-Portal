import { useEffect, useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Check, CheckCircle2, Lock, Loader2, Plus, RotateCcw, Sparkles, Sun, Trash2, Undo2, X } from 'lucide-react';
import { addDays, LIST_META, RECURRENCE_LABEL, weekday } from '../../lib/tasks';
import { XP_RULES } from '../../lib/taskProgress';
import { TASK_LISTS, type Assignee, type Recurrence, type Task, type TaskDraft, type TaskList } from '../../services/tasks/types';
import { Sheet } from '../ui/Sheet';
import { Switch } from '../ui/Switch';

interface Props {
  open: boolean;
  /** Editing this task, or null for a new one (started from `initial`). */
  task: Task | null;
  initial: TaskDraft | null;
  today: string;
  me: string | null;
  canAssign: boolean;
  people: Assignee[];
  onClose: () => void;
  /** Resolves to an error message, or null when saved. */
  onSave: (draft: TaskDraft) => Promise<string | null>;
  onToggleDone: (task: Task) => void;
  onRemove: (task: Task) => Promise<void>;
  /** The person who gave a finished task sends it back with a reason. Resolves to an error message, or null. */
  onSendBack?: (task: Task, reason: string) => Promise<string | null>;
  /** Mark an open task started or not started (saved straight away). */
  onSetStatus?: (task: Task, status: 'todo' | 'in_progress') => void;
}

const EMPTY: TaskDraft = {
  title: '',
  notes: '',
  list: 'office',
  setting: 'office',
  priority: 'medium',
  dueDate: null,
  dueTime: null,
  myDay: null,
  subtasks: [],
  recurrence: 'none',
  location: '',
  assigneeId: null,
};

export const draftOf = (t: Task): TaskDraft => ({
  id: t.id,
  title: t.title,
  notes: t.notes ?? '',
  list: t.list,
  setting: t.setting,
  priority: t.priority,
  dueDate: t.dueDate,
  dueTime: t.dueTime,
  myDay: t.myDay,
  subtasks: t.subtasks,
  recurrence: t.recurrence,
  location: t.location ?? '',
  assigneeId: t.assigneeId,
  projectId: t.projectId,
});

/** Add or edit a task with everything Any.do offers: list, Field/Office, due date and time, My Day, repeat, subtasks. */
export function TaskSheet({ open, task, initial, today, me, canAssign, people, onClose, onSave, onToggleDone, onRemove, onSendBack, onSetStatus }: Props) {
  const uid = useId();
  const [d, setD] = useState<TaskDraft>(EMPTY);
  const [base, setBase] = useState<TaskDraft>(EMPTY);
  const [sub, setSub] = useState('');
  const [busy, setBusy] = useState<'save' | 'remove' | 'sendBack' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    const start = task ? draftOf(task) : { ...EMPTY, ...initial };
    setD(start);
    setBase(start);
    setSub('');
    setError(null);
    setReason('');
  }, [open, task, initial]);

  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(d) !== JSON.stringify(base) || sub.trim().length > 0;
  const done = task?.status === 'done';
  const forSelf = (d.assigneeId ?? me) === me && (!task || task.createdById === me);
  const worth = forSelf ? XP_RULES.self : XP_RULES.base[d.priority];
  // Given to me by someone else: what the task is stays theirs to change (the database enforces this too).
  const given = Boolean(task && task.createdById !== me && !canAssign);
  // Finished: locked until re-opened (My Day can still be planned).
  const locked = done;
  const fixed = locked || given;
  const canSendBack = Boolean(done && task && task.assigneeId && task.assigneeId !== me && (task.createdById === me || canAssign) && onSendBack);
  const sendBack = async () => {
    if (!task || !onSendBack || busy) return;
    if (reason.trim().length < 3) {
      setError('Say in a few words what still needs doing.');
      return;
    }
    setBusy('sendBack');
    setError(null);
    const err = await onSendBack(task, reason.trim());
    setBusy(null);
    if (err) setError(err);
    else onClose();
  };

  const addSub = () => {
    const title = sub.trim();
    if (!title) return;
    set('subtasks', [...d.subtasks, { id: `s-${Date.now().toString(36)}`, title, done: false }]);
    setSub('');
  };
  const onSubKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSub();
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!d.title.trim()) {
      setError('Give the task a title.');
      return;
    }
    setBusy('save');
    setError(null);
    // A subtask still in the box is kept, not lost.
    const toSave = sub.trim() ? { ...d, subtasks: [...d.subtasks, { id: `s-${Date.now().toString(36)}`, title: sub.trim(), done: false }] } : d;
    const err = await onSave(toSave);
    setBusy(null);
    if (err) setError(err);
    else onClose();
  };

  const dateChips: [string, string | null][] = [
    ['Today', today],
    ['Tomorrow', addDays(today, 1)],
    ['Next week', addDays(today, ((8 - weekday(today)) % 7) || 7)],
    ['Someday', null],
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      title={task ? 'Task details' : 'New task'}
      subtitle={task?.createdByName && task.createdById !== me ? `From ${task.createdByName}` : undefined}
      footer={
        <div className="flex gap-2">
          {task && (
            <>
              {!given && (
              <button type="button" className="btn-ghost px-3 text-status-out" onClick={() => void (setBusy('remove'), onRemove(task).finally(() => setBusy(null)))} disabled={Boolean(busy)} title="Remove task">
                {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                <span className="sr-only">Remove task</span>
              </button>
              )}
              <button type="button" className="btn-ghost px-3" onClick={() => (onToggleDone(task), onClose())} disabled={Boolean(busy)}>
                {done ? <RotateCcw className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4 text-status-in" aria-hidden />}
                {done ? 'Re-open' : 'Done'}
              </button>
            </>
          )}
          <button type="submit" form={`${uid}-form`} className="btn-primary h-12 flex-1 text-base" disabled={Boolean(busy)}>
            {busy === 'save' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            {task ? 'Save changes' : 'Add task'}
          </button>
        </div>
      }
    >
      <form id={`${uid}-form`} noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
        {error && (
          <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
            <strong className="font-semibold text-status-out">Not saved.</strong> {error}
          </p>
        )}
        {task && !done && onSetStatus && (task.assigneeId ?? task.createdById) === me && (
          // Where you are with it: the person who gave it sees this (Team tasks).
          <div className="flex gap-1 rounded-xl bg-surface-sunken p-1" role="radiogroup" aria-label="Progress">
            {(
              [
                ['todo', 'Not started'],
                ['in_progress', 'In progress'],
              ] as const
            ).map(([s, label]) => {
              const on = (task.status === 'in_progress' ? 'in_progress' : 'todo') === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => !on && onSetStatus(task, s)}
                  className={`tap min-h-10 flex-1 rounded-lg text-sm font-semibold transition-colors ${
                    on ? (s === 'in_progress' ? 'bg-status-low/20 text-status-low' : 'bg-surface-raised text-ink') : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {(locked || given) && (
          <p className="flex items-start gap-2 rounded-xl border border-line/70 bg-white/[0.03] px-4 py-3 text-xs text-ink-soft">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
            {locked
              ? 'Finished, so it’s locked. Re-open it to make changes (its XP is taken back until it’s done again).'
              : `Set by ${task?.createdByName ?? 'a coordinator'}. You can tick off its steps, add notes and plan it in My Day; ask them to change the title, due date or priority.`}
          </p>
        )}
        {canSendBack && (
          <section className="flex flex-col gap-2 rounded-xl border border-uplift/30 bg-uplift/[0.06] p-4" aria-labelledby={`${uid}-back`}>
            <h3 id={`${uid}-back`} className="text-sm font-semibold">
              Not really done?
            </h3>
            <p className="text-xs text-muted">Send it back to {task?.assigneeName ?? 'them'} with what still needs doing. It re-opens and the XP is taken back until it’s done.</p>
            <textarea className="field min-h-20" rows={2} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Only 40 of the 50 boxes were counted" aria-label="What still needs doing" />
            <button type="button" className="btn-ghost min-h-11 self-start px-4" onClick={() => void sendBack()} disabled={Boolean(busy) || reason.trim().length < 3}>
              {busy === 'sendBack' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Undo2 className="h-4 w-4" aria-hidden />} Send it back
            </button>
          </section>
        )}
        <fieldset disabled={fixed} className="contents">
        <Field id={`${uid}-title`} label="Task">
          <input id={`${uid}-title`} className="field" data-autofocus={task ? undefined : true} value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={200} placeholder="What needs doing?" />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field id={`${uid}-list`} label="List">
            <select id={`${uid}-list`} className="field" value={d.list} onChange={(e) => set('list', e.target.value as TaskList)}>
              {TASK_LISTS.map((l) => (
                <option key={l} value={l}>
                  {LIST_META[l].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Where">
            <Segmented value={d.setting} onChange={(v) => set('setting', v)} options={[['field', 'Field'], ['office', 'Office']]} label="Field or office" />
          </Field>
        </div>

        <Field label="Due">
          <div className="flex flex-wrap gap-2">
            {dateChips.map(([label, day]) => (
              <button key={label} type="button" className="chip" aria-pressed={d.dueDate === day} onClick={() => setD((x) => ({ ...x, dueDate: day, dueTime: day ? x.dueTime : null }))}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="Due date" className="field" value={d.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} />
            <input type="time" aria-label="Due time" className="field" value={d.dueTime ?? ''} onChange={(e) => set('dueTime', e.target.value || null)} disabled={!d.dueDate} />
          </div>
        </Field>

        <Field label="Priority">
          <Segmented value={d.priority} onChange={(v) => set('priority', v)} options={[['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]} label="Priority" />
        </Field>
        </fieldset>

        <label className="tap flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-line/70 px-4">
          <span className="flex items-center gap-3">
            <Sun className={`h-5 w-5 ${d.myDay === today ? 'text-uplift' : 'text-muted'}`} aria-hidden />
            <span>
              <span className="block text-sm font-semibold">Add to My Day</span>
              <span className="block text-xs text-muted">Plan it for today.</span>
            </span>
          </span>
          <Switch checked={d.myDay === today} onChange={(on) => set('myDay', on ? today : null)} />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id={`${uid}-repeat`} label="Repeat">
            <select id={`${uid}-repeat`} className="field" disabled={fixed} value={d.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence)}>
              {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${uid}-assignee`} label="Assigned to">
            {canAssign ? (
              <select id={`${uid}-assignee`} className="field" disabled={locked} value={d.assigneeId ?? me ?? ''} onChange={(e) => set('assigneeId', e.target.value === me ? null : e.target.value)}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === me ? `${p.name} (you)` : p.name}
                  </option>
                ))}
              </select>
            ) : (
              <p id={`${uid}-assignee`} className="field text-ink-soft">
                {task && task.assigneeId !== me ? task.assigneeName : 'You'}
              </p>
            )}
          </Field>
        </div>

        <Field id={`${uid}-place`} label="Place" hint="Optional">
          <input id={`${uid}-place`} className="field" disabled={locked} value={d.location} onChange={(e) => set('location', e.target.value)} maxLength={200} placeholder="Barangay, evacuation centre, warehouse…" />
        </Field>

        <Field id={`${uid}-sub`} label="Subtasks" hint={d.subtasks.length ? `${d.subtasks.filter((s) => s.done).length} of ${d.subtasks.length} done` : 'Optional'}>
          {d.subtasks.length > 0 && (
            <ul className="flex flex-col gap-1">
              {d.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg bg-surface-sunken px-2 py-1">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={s.done}
                    aria-label={s.title}
                    className="grid h-8 w-8 shrink-0 place-items-center disabled:opacity-60"
                    disabled={locked}
                    onClick={() => set('subtasks', d.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                  >
                    <span className={`grid h-5 w-5 place-items-center rounded-md border-2 ${s.done ? 'border-uplift bg-uplift text-page' : 'border-ink-mute'}`}>
                      {s.done && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                    </span>
                  </button>
                  <span className={`min-w-0 flex-1 text-sm ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</span>
                  {!fixed && (
                    <button type="button" className="icon-btn h-8 w-8" aria-label={`Remove subtask ${s.title}`} onClick={() => set('subtasks', d.subtasks.filter((x) => x.id !== s.id))}>
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!fixed && (
          <div className="flex gap-2">
            <input id={`${uid}-sub`} className="field" value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={onSubKey} maxLength={200} placeholder="Add a step and press Enter" />
            <button type="button" className="btn-ghost shrink-0 px-3" onClick={addSub} aria-label="Add subtask" disabled={!sub.trim()}>
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
          )}
        </Field>

        <Field id={`${uid}-notes`} label="Notes" hint="Optional">
          <textarea id={`${uid}-notes`} className="field min-h-24" rows={3} disabled={locked} value={d.notes} onChange={(e) => set('notes', e.target.value)} maxLength={4000} />
        </Field>

        <p className="flex items-start gap-2 rounded-xl border border-uplift/25 bg-uplift/[0.06] px-4 py-3 text-xs text-ink-soft">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
          <span>
            {forSelf ? (
              <>
                Worth <strong className="text-ink">{worth} XP</strong>. Tasks you set for yourself earn {XP_RULES.self} XP each, up to {XP_RULES.selfDailyCap} XP a day.
              </>
            ) : (
              <>
                Worth <strong className="text-ink">{worth} XP</strong>, +{XP_RULES.onTime} if done by the due date, +{XP_RULES.perSubtask} for each finished subtask (up to +
                {XP_RULES.maxSubtasks}).
              </>
            )}
          </span>
        </p>
      </form>
    </Sheet>
  );
}

function Field({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        {id ? (
          <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
            {label}
          </label>
        ) : (
          <span className="text-sm font-semibold text-ink-soft">{label}</span>
        )}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-sunken p-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className="tap min-h-10 rounded-lg px-3 text-sm font-semibold text-ink-soft transition aria-checked:bg-surface-raised aria-checked:text-ink"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

