import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowLeft, Camera, Layers, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { addDays, LIST_META } from '../../lib/tasks';
import { projectsService, taskExtras } from '../../services';
import type { Project } from '../../services/projects/projectsService';
import { TEMPLATE_MAX_ITEMS, type TaskTemplate, type TemplateDraft, type TemplateItem } from '../../services/tasks/taskExtras';
import { TASK_LISTS, type Assignee, type TaskDraft } from '../../services/tasks/types';
import type { TaskPriority } from '../../types';
import { BusyLabel } from '../ui/BusyLabel';
import { Sheet } from '../ui/Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  today: string;
  me: string | null;
  /** Can give the tasks to someone else. */
  canGive: boolean;
  /** Can change or delete anyone's template. */
  canManage: boolean;
  people: Assignee[];
  /** Adds the tasks. Resolves to an error message, or null when they were all added. */
  onApply: (drafts: TaskDraft[]) => Promise<string | null>;
}

type Mode = { at: 'list' } | { at: 'use'; t: TaskTemplate } | { at: 'edit'; t: TemplateDraft };

const blankItem = (): TemplateItem => ({ title: '', day: 0, priority: 'medium', requiresPhoto: false });
const blank = (): TemplateDraft => ({ name: '', list: 'emergency', setting: 'field', items: [blankItem(), blankItem(), blankItem()] });
const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const PRIORITY: [TaskPriority, string][] = [
  ['high', 'High'],
  ['medium', 'Medium'],
  ['low', 'Low'],
];
const dateLabel = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const plural = (n: number, word = 'task') => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Task templates: a set of tasks PHILRADS does again and again (a relief distribution, a training
 * day). Pick one, choose the start date, who does it and the project, and every task is added at
 * once with its own due date. Anyone can make a template; only its maker (or a coordinator) changes it.
 */
export function TemplatesSheet({ open, onClose, today, me, canGive, canManage, people, onApply }: Props) {
  const uid = useId();
  const [mode, setMode] = useState<Mode>({ at: 'list' });
  const [templates, setTemplates] = useState<TaskTemplate[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Using a template
  const [start, setStart] = useState(today);
  const [forId, setForId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  // The new tasks' ids stay the same while this template is open, so pressing Add again after a
  // dropped connection doesn't add any task twice.
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setMode({ at: 'list' });
    setError(null);
    setTemplates(null);
    taskExtras
      .templates()
      .then(setTemplates)
      .catch((e: Error) => {
        setTemplates([]);
        setError(e.message);
      });
    projectsService
      .list()
      .then((ps) => setProjects(ps.filter((p) => p.status === 'active' || p.status === 'planned')))
      .catch(() => setProjects([]));
  }, [open]);

  const mine = (t: TaskTemplate) => canManage || (me !== null && t.createdById === me);
  const use = (t: TaskTemplate) => {
    setStart(today);
    setForId('');
    setProjectId('');
    setIds(t.items.map(() => newId()));
    setError(null);
    setMode({ at: 'use', t });
  };
  const edit = (t: TemplateDraft) => {
    setError(null);
    setMode({ at: 'edit', t: { ...t, items: t.items.map((i) => ({ ...i })) } });
  };

  const apply = async (t: TaskTemplate) => {
    setBusy(true);
    setError(null);
    const drafts: TaskDraft[] = t.items.map((i, n) => ({
      newId: ids[n],
      title: i.title,
      notes: `From the “${t.name}” template.`,
      list: t.list,
      setting: t.setting,
      priority: i.priority,
      dueDate: addDays(start, i.day),
      dueTime: null,
      myDay: null,
      subtasks: [],
      recurrence: 'none',
      location: '',
      assigneeId: forId || null,
      projectId: projectId || null,
      requiresPhoto: i.requiresPhoto,
    }));
    const problem = await onApply(drafts);
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  };

  const save = async (t: TemplateDraft) => {
    setBusy(true);
    setError(null);
    try {
      const saved = await taskExtras.saveTemplate(t);
      setTemplates((ts) => [saved, ...(ts ?? []).filter((x) => x.id !== saved.id)].sort((a, b) => a.name.localeCompare(b.name)));
      setMode({ at: 'list' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (t: TaskTemplate) => {
    if (!window.confirm(`Delete the “${t.name}” template? Tasks already added from it stay.`)) return;
    try {
      await taskExtras.removeTemplate(t.id);
      setTemplates((ts) => ts?.filter((x) => x.id !== t.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const forName = forId ? (people.find((p) => p.id === forId)?.name ?? 'them') : 'you';
  const title = mode.at === 'list' ? 'Task templates' : mode.at === 'use' ? mode.t.name : mode.t.id ? 'Edit template' : 'New template';
  const subtitle =
    mode.at === 'list'
      ? 'Add a whole set of tasks at once'
      : mode.at === 'use'
        ? `${plural(mode.t.items.length)} · ${LIST_META[mode.t.list].label}`
        : 'Tasks you do again and again, with how many days after the start each is due';

  const back = (
    <button type="button" className="btn-ghost px-3" onClick={() => (setError(null), setMode({ at: 'list' }))} disabled={busy}>
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back
    </button>
  );
  const footer =
    mode.at === 'use' ? (
      <div className="flex items-center justify-between gap-2">
        {back}
        <button type="button" className="btn-primary" onClick={() => void apply(mode.t)} disabled={busy || !start}>
          <BusyLabel busy={busy} busyText="Adding…">
            Add {plural(mode.t.items.length)}
          </BusyLabel>
        </button>
      </div>
    ) : mode.at === 'edit' ? (
      <div className="flex items-center justify-between gap-2">
        {back}
        <button type="button" className="btn-primary" onClick={() => void save(mode.t)} disabled={busy}>
          <BusyLabel busy={busy} busyText="Saving…">
            Save template
          </BusyLabel>
        </button>
      </div>
    ) : undefined;

  return (
    <Sheet open={open} title={title} subtitle={subtitle} onClose={onClose} footer={footer} dirty={mode.at !== 'list'}>
      <div className="flex flex-col gap-4">
        {mode.at === 'list' && (
          <>
            <p className="rounded-xl border border-line bg-surface-sunken px-4 py-3 text-xs text-ink-soft">
              For work you do again and again, like a relief distribution. Pick a template, choose the start date and who does it, and every task is added with its own due date.
            </p>
            {templates === null ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading templates…
              </p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted">No templates yet. Make the first one.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-3">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left" onClick={() => use(t)}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
                        <Layers className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{t.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {plural(t.items.length)} · {LIST_META[t.list].label} · by {t.createdById === me ? 'you' : t.createdByName}
                        </span>
                      </span>
                    </button>
                    {mine(t) && (
                      <>
                        <button type="button" className="icon-btn h-9 w-9" aria-label={`Edit ${t.name}`} title="Edit" onClick={() => edit(t)}>
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" className="icon-btn h-9 w-9" aria-label={`Delete ${t.name}`} title="Delete" onClick={() => void remove(t)}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </>
                    )}
                    <button type="button" className="btn-primary h-9 shrink-0 px-3 text-sm" onClick={() => use(t)}>
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="btn-ghost self-start" onClick={() => edit(blank())}>
              <Plus className="h-4 w-4" aria-hidden /> New template
            </button>
          </>
        )}

        {mode.at === 'use' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labelled id={`${uid}-start`} label="Start date">
                <input id={`${uid}-start`} type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} required data-autofocus />
              </Labelled>
              {canGive && (
                <Labelled id={`${uid}-for`} label="For">
                  <select id={`${uid}-for`} className="field" value={forId} onChange={(e) => setForId(e.target.value)}>
                    <option value="">Me</option>
                    {people
                      .filter((p) => p.id !== me)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </Labelled>
              )}
              {projects.length > 0 && (
                <Labelled id={`${uid}-project`} label="Project" hint="Optional">
                  <select id={`${uid}-project`} className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Labelled>
              )}
            </div>
            <section aria-labelledby={`${uid}-preview`} className="flex flex-col gap-2">
              <h3 id={`${uid}-preview`} className="text-sm font-semibold text-ink-soft">
                {forId ? `${forName} will get these` : 'You’ll get these'}
              </h3>
              <ol className="flex flex-col divide-y divide-line/70 rounded-2xl border border-line bg-surface">
                {mode.t.items.map((i, n) => (
                  <li key={n} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-24 shrink-0 text-xs font-semibold tabular-nums text-muted">{start ? dateLabel(addDays(start, i.day)) : `Day ${i.day + 1}`}</span>
                    <span className="min-w-0 flex-1 text-sm text-ink">{i.title}</span>
                    {i.requiresPhoto && <Camera className="h-4 w-4 shrink-0 text-muted" aria-label="Needs a photo" />}
                    {i.priority === 'high' && <span className="shrink-0 rounded-full bg-rose/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-rose">High</span>}
                  </li>
                ))}
              </ol>
              {forId && <p className="text-xs text-muted">{forName.split(' ')[0]} gets each task to accept, as with any task you give.</p>}
            </section>
          </>
        )}

        {mode.at === 'edit' && (
          <TemplateEditor uid={uid} value={mode.t} onChange={(t) => setMode({ at: 'edit', t })} />
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function TemplateEditor({ uid, value: t, onChange }: { uid: string; value: TemplateDraft; onChange: (t: TemplateDraft) => void }) {
  const setItem = (n: number, patch: Partial<TemplateItem>) => onChange({ ...t, items: t.items.map((i, k) => (k === n ? { ...i, ...patch } : i)) });
  const filled = t.items.filter((i) => i.title.trim()).length;
  return (
    <>
      <Labelled id={`${uid}-name`} label="Name">
        <input id={`${uid}-name`} className="field" value={t.name} maxLength={80} placeholder="Relief distribution" onChange={(e) => onChange({ ...t, name: e.target.value })} data-autofocus />
      </Labelled>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labelled id={`${uid}-list`} label="Type of work">
          <select id={`${uid}-list`} className="field" value={t.list} onChange={(e) => onChange({ ...t, list: e.target.value as TemplateDraft['list'], setting: LIST_META[e.target.value as TemplateDraft['list']].setting })}>
            {TASK_LISTS.map((l) => (
              <option key={l} value={l}>
                {LIST_META[l].label}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled id={`${uid}-setting`} label="Where">
          <select id={`${uid}-setting`} className="field" value={t.setting} onChange={(e) => onChange({ ...t, setting: e.target.value as TemplateDraft['setting'] })}>
            <option value="field">In the field</option>
            <option value="office">In the office</option>
          </select>
        </Labelled>
      </div>

      <section aria-labelledby={`${uid}-items`} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id={`${uid}-items`} className="text-sm font-semibold text-ink-soft">
            Tasks
          </h3>
          <span className="text-xs text-muted">Day 1 is the start date</span>
        </div>
        <ol className="flex flex-col gap-2">
          {t.items.map((i, n) => (
            <li key={n} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2.5">
              <div className="flex items-center gap-2">
                <label htmlFor={`${uid}-t${n}`} className="sr-only">
                  Task {n + 1}
                </label>
                <input id={`${uid}-t${n}`} className="field" value={i.title} maxLength={200} placeholder={`Task ${n + 1}`} onChange={(e) => setItem(n, { title: e.target.value })} />
                <button type="button" className="icon-btn h-9 w-9 shrink-0" aria-label={`Remove task ${n + 1}`} onClick={() => onChange({ ...t, items: t.items.filter((_, k) => k !== n) })} disabled={t.items.length === 1}>
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-1 text-xs text-ink-soft">
                <label className="flex items-center gap-1.5">
                  Day
                  <input type="number" min={1} max={366} className="field h-8 w-16 px-2 py-0 text-xs" value={i.day + 1} onChange={(e) => setItem(n, { day: Math.max(0, (parseInt(e.target.value, 10) || 1) - 1) })} />
                </label>
                <label className="flex items-center gap-1.5">
                  Priority
                  <select className="field h-8 w-auto px-2 py-0 text-xs" value={i.priority} onChange={(e) => setItem(n, { priority: e.target.value as TaskPriority })}>
                    {PRIORITY.map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" className="h-4 w-4 accent-uplift" checked={i.requiresPhoto} onChange={(e) => setItem(n, { requiresPhoto: e.target.checked })} />
                  Needs a photo
                </label>
              </div>
            </li>
          ))}
        </ol>
        {t.items.length < TEMPLATE_MAX_ITEMS && (
          <button type="button" className="btn-ghost self-start" onClick={() => onChange({ ...t, items: [...t.items, { ...blankItem(), day: t.items[t.items.length - 1]?.day ?? 0 }] })}>
            <Plus className="h-4 w-4" aria-hidden /> Add a task
          </button>
        )}
        <p className="text-xs text-muted">{filled ? `${plural(filled)} in this template. Empty rows are left out.` : 'Write at least one task.'}</p>
      </section>
    </>
  );
}

function Labelled({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
          {label}
        </label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
