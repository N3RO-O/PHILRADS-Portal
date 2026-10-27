import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  FileText,
  FolderKanban,
  HandHeart,
  Landmark,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { ProjectSheet } from '../components/projects/ProjectSheet';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { formatDateTime, formatNumber, formatShortDate, initialsOf } from '../lib/format';
import { todayKey } from '../lib/inventory';
import { daysBetween } from '../lib/tasks';
import { documentationService, projectsService, tasksService } from '../services';
import type { DocFile, DocLinks } from '../services/documentation/documentationService';
import {
  nextDeadline,
  orderMilestones,
  PROJECT_STATUSES,
  statusLabel,
  type Milestone,
  type Project,
  type ProjectActivity,
  type ProjectDraft,
  type ProjectStatus,
} from '../services/projects/projectsService';
import type { Task } from '../services/tasks/types';

type Filter = ProjectStatus | 'all';
const FILTERS: [Filter, string][] = [
  ['active', 'Active'],
  ['planned', 'Planned'],
  ['on_hold', 'On hold'],
  ['completed', 'Completed'],
  ['all', 'All'],
];

const STATUS_TONE: Record<ProjectStatus, string> = {
  active: 'bg-status-in/15 text-status-in',
  planned: 'bg-sky-400/15 text-sky-300',
  on_hold: 'bg-status-low/15 text-status-low',
  completed: 'bg-white/[0.08] text-ink-soft',
  cancelled: 'bg-status-out/15 text-status-out',
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

/** "Due today", "in 3 days", "2 days late". */
function dueText(m: Pick<Milestone, 'dueDate' | 'done'>, today: string) {
  if (!m.dueDate) return { text: 'No date', late: false, soon: false };
  const d = daysBetween(today, m.dueDate);
  if (m.done) return { text: formatShortDate(m.dueDate), late: false, soon: false };
  if (d < 0) return { text: `${-d} day${d === -1 ? '' : 's'} late`, late: true, soon: false };
  if (d === 0) return { text: 'Due today', late: false, soon: true };
  return { text: d <= 14 ? `in ${d} day${d === 1 ? '' : 's'}` : formatShortDate(m.dueDate), late: false, soon: d <= 7 };
}

const dateRange = (p: Project) =>
  p.startDate || p.endDate ? `${p.startDate ? formatShortDate(p.startDate) : '…'} – ${p.endDate ? formatShortDate(p.endDate) : '…'}` : null;

/** Programs and projects: what's going on, how far along, what's due, and who's on it. */
export function ProjectsPage() {
  const { id } = useParams();
  const { can, profile } = useAuth();
  const me = profile?.id ?? null;
  const canCreate = can('projects.manage');
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [sheet, setSheet] = useState<{ project: Project | null } | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setProjects(await projectsService.list());
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, []);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    projectsService.people().then(setPeople, () => setPeople([]));
  }, []);

  const save = async (d: ProjectDraft) => {
    try {
      const newId = await projectsService.save(d);
      await load();
      if (!d.id) navigate(`/projects/${newId}`);
      return null;
    } catch (e) {
      return errorText(e);
    }
  };

  const project = id ? projects?.find((p) => p.id === id) ?? null : null;
  const canManage = (p: Project) => canCreate || (Boolean(me) && p.leadId === me);

  return (
    <>
      {loadError ? (
        <LoadError message={loadError} onRetry={() => void load()} />
      ) : id ? (
        projects === null ? (
          <Skeleton className="h-96" />
        ) : project ? (
          <ProjectDetail project={project} me={me} canManage={canManage(project)} canSetLead={canCreate} people={people} onChanged={load} onEdit={() => setSheet({ project })} />
        ) : (
          <EmptyState icon={FolderKanban} title="This project isn’t here" action={<Link to="/projects" className="btn-ghost min-h-10 px-4 text-sm">All projects</Link>}>
            It may have been removed, or the link is wrong.
          </EmptyState>
        )
      ) : (
        <ProjectList projects={projects} me={me} canCreate={canCreate} onNew={() => setSheet({ project: null })} />
      )}
      <ProjectSheet open={Boolean(sheet)} project={sheet?.project ?? null} people={people} canSetLead={canCreate} onClose={() => setSheet(null)} onSave={save} />
    </>
  );
}

// ───────────────────────── List ─────────────────────────

function ProjectList({ projects, me, canCreate, onNew }: { projects: Project[] | null; me: string | null; canCreate: boolean; onNew: () => void }) {
  const [filter, setFilter] = useState<Filter>('active');
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');
  const today = todayKey();
  const all = projects ?? [];
  const needle = search.trim().toLowerCase();
  const isMine = (p: Project) => Boolean(me) && (p.leadId === me || p.members.some((m) => m.profileId === me));
  const shown = all.filter(
    (p) =>
      (filter === 'all' ? p.status !== 'cancelled' : p.status === filter) &&
      (!mine || isMine(p)) &&
      (!needle || [p.name, p.programArea, p.donor, p.partner, p.location, p.leadName].some((s) => s?.toLowerCase().includes(needle))),
  );
  const count = (f: Filter) => all.filter((p) => (f === 'all' ? p.status !== 'cancelled' : p.status === f)).length;

  return (
    <section className="card flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="card-title flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-uplift" aria-hidden /> Projects {projectsService.source === 'mock' && <SampleBadge />}
        </h2>
        {canCreate && (
          <button type="button" className="btn-primary min-h-11 px-4" onClick={onNew}>
            <Plus className="h-4 w-4" aria-hidden /> New project
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Show">
        {FILTERS.map(([f, label]) => (
          <button key={f} type="button" role="radio" aria-checked={filter === f} aria-pressed={filter === f} className="chip" onClick={() => setFilter(f)}>
            {label} <span className="ml-1.5 opacity-60">{count(f)}</span>
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={mine} onClick={() => setMine((m) => !m)}>
          <Users className="mr-1.5 h-3.5 w-3.5" aria-hidden /> My projects
        </button>
      </div>
      <label className="relative block">
        <span className="sr-only">Search projects</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" className="field pl-10" placeholder="Search: name, type, donor, partner, place, lead…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>

      {projects === null ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading projects">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={all.length ? 'No projects here' : 'No projects yet'}
          action={
            !all.length && canCreate ? (
              <button type="button" className="btn-primary min-h-10 px-4 text-sm" onClick={onNew}>
                <Plus className="h-4 w-4" aria-hidden /> Start the first project
              </button>
            ) : undefined
          }
        >
          {all.length ? 'Try another filter or word.' : canCreate ? 'Add a program or project to follow its milestones, reports and team.' : 'Projects appear here once a coordinator adds them.'}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id}>
              <ProjectCard project={p} today={today} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectCard({ project: p, today }: { project: Project; today: string }) {
  const next = nextDeadline(p);
  const due = next ? dueText(next, today) : null;
  const done = p.milestones.filter((m) => m.done).length;
  return (
    <Link to={`/projects/${p.id}`} className="tile tap flex h-full flex-col gap-3 p-4 transition hover:border-uplift/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 font-semibold leading-snug">{p.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{p.programArea || 'Project'}</p>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold ${STATUS_TONE[p.status]}`}>{statusLabel(p.status)}</span>
      </div>
      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted">{p.milestones.length ? `${done} of ${p.milestones.length} milestones` : 'Progress'}</span>
          <span className="font-semibold tabular-nums">{p.progress}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} progress`}>
          <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-uplift to-status-in" style={{ transform: `scaleX(${p.progress / 100})` }} />
        </div>
      </div>
      {next && due && (
        <p className={`flex items-start gap-2 text-xs ${due.late ? 'text-status-out' : due.soon ? 'text-status-low' : 'text-ink-soft'}`}>
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="font-semibold">{next.kind === 'report' ? 'Report: ' : 'Next: '}</span>
            {next.title} · {due.text}
          </span>
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex min-w-0 items-center gap-2">
          {p.leadName ? (
            <>
              <Avatar initials={initialsOf(p.leadName)} size="sm" />
              <span className="truncate">{p.leadName}</span>
            </>
          ) : (
            'No lead yet'
          )}
        </span>
        {dateRange(p) && <span className="shrink-0 tabular-nums">{dateRange(p)}</span>}
      </div>
    </Link>
  );
}

// ───────────────────────── One project ─────────────────────────

interface DetailProps {
  project: Project;
  me: string | null;
  canManage: boolean;
  canSetLead: boolean;
  people: { id: string; name: string }[];
  onChanged: () => Promise<void> | void;
  onEdit: () => void;
}

function ProjectDetail({ project: p, me, canManage, people, onChanged, onEdit }: DetailProps) {
  const today = todayKey();
  const onTeam = canManage || (Boolean(me) && (p.leadId === me || p.members.some((m) => m.profileId === me)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  // Linked work: tasks and documentation for this project; the project's history.
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [docs, setDocs] = useState<DocFile[] | null>(null);
  const [links, setLinks] = useState<Record<string, DocLinks>>({});
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const loadLinked = useCallback(() => {
    tasksService.list().then((ts) => setTasks(ts.filter((t) => t.projectId === p.id)), () => setTasks([]));
    documentationService.list().then(
      (ds) => {
        const mine = ds.filter((d) => d.projectId === p.id);
        setDocs(mine);
        documentationService.links(mine.slice(0, 12).map((d) => d.id)).then(setLinks, () => undefined);
      },
      () => setDocs([]),
    );
    projectsService.activity(p.id).then(setActivity, () => setActivity([]));
  }, [p.id]);
  useEffect(() => loadLinked(), [loadLinked, p.updatedAt]);

  const done = p.milestones.filter((m) => m.done).length;
  const facts: [ReactNode, string][] = [];
  if (p.donor) facts.push([<Landmark key="i" className="h-4 w-4 text-uplift" aria-hidden />, `Donor: ${p.donor}`]);
  if (p.partner) facts.push([<HandHeart key="i" className="h-4 w-4 text-uplift" aria-hidden />, `Partner: ${p.partner}`]);
  if (p.location) facts.push([<MapPin key="i" className="h-4 w-4 text-uplift" aria-hidden />, p.location]);
  if (dateRange(p)) facts.push([<CalendarClock key="i" className="h-4 w-4 text-uplift" aria-hidden />, dateRange(p)!]);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/projects" className="link self-start">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All projects
      </Link>

      <section className="card flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{p.programArea || 'Project'}</p>
            <h2 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">{p.name}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <select
                className="field min-h-10 w-auto py-1.5 text-xs font-semibold"
                aria-label="Status"
                value={p.status}
                disabled={busy === 'status'}
                onChange={(e) => void act('status', () => projectsService.setStatus(p.id, e.target.value as ProjectStatus))}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${STATUS_TONE[p.status]}`}>{statusLabel(p.status)}</span>
            )}
            {canManage && (
              <button type="button" className="btn-ghost min-h-10 px-3 text-xs" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </button>
            )}
          </div>
        </div>
        {facts.length > 0 && (
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            {facts.map(([icon, text]) => (
              <li key={text} className="flex items-center gap-2">
                {icon}
                {text}
              </li>
            ))}
          </ul>
        )}
        {p.description && <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-soft">{p.description}</p>}
        <PeopleToReach project={p} canManage={canManage} busy={busy} act={act} />
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted">{p.milestones.length ? `${done} of ${p.milestones.length} milestones done` : 'Progress'}</span>
            <strong className="text-lg tabular-nums">{p.progress}%</strong>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-uplift to-status-in transition-transform duration-500" style={{ transform: `scaleX(${p.progress / 100})` }} />
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-2 text-sm">
            {error}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Milestones project={p} today={today} canManage={canManage} onTeam={onTeam} busy={busy} act={act} />
          <ProjectTasks project={p} tasks={tasks} canManage={canManage} today={today} onAdded={loadLinked} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Team project={p} people={people} canManage={canManage} busy={busy} act={act} />
          <ProjectDocs project={p} docs={docs} links={links} />
          {activity.length > 0 && (
            <section className="card flex flex-col gap-3 p-4" aria-labelledby="pd-activity">
              <h3 id="pd-activity" className="card-title">
                History
              </h3>
              <ul className="flex flex-col gap-2.5">
                {activity.slice(0, 12).map((a) => (
                  <li key={a.id} className="text-sm leading-snug">
                    {a.summary}
                    <span className="block text-[0.6875rem] text-muted">{formatDateTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

type Act = (key: string, fn: () => Promise<unknown>) => Promise<void>;

/** People to reach (it changes as a project goes on) plus people reached beyond the plan. */
function PeopleToReach({ project: p, canManage, busy, act }: { project: Project; canManage: boolean; busy: string | null; act: Act }) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState('');
  const [extra, setExtra] = useState('');
  const total = (p.beneficiariesTarget ?? 0) + p.beneficiariesAdditional;
  const begin = () => {
    setTarget(p.beneficiariesTarget == null ? '' : String(p.beneficiariesTarget));
    setExtra(p.beneficiariesAdditional ? String(p.beneficiariesAdditional) : '');
    setEditing(true);
  };
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  if (p.beneficiariesTarget == null && !p.beneficiariesAdditional && !canManage) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line/70 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-uplift" aria-hidden /> People to reach
        </p>
        {canManage && !editing && (
          <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={begin}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Change
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            void act('people', async () => {
              await projectsService.setPeople(p.id, target === '' ? null : num(target), num(extra));
              setEditing(false);
            });
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            Planned
            <input type="number" inputMode="numeric" min={0} className="field" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Additional beneficiaries
            <input type="number" inputMode="numeric" min={0} className="field" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </label>
          <div className="flex items-end gap-2">
            <button type="button" className="btn-ghost min-h-11 px-3" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary min-h-11 px-4" disabled={busy === 'people'}>
              {busy === 'people' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/[0.03] px-2 py-2">
            <p className="text-lg font-bold tabular-nums">{p.beneficiariesTarget == null ? '—' : formatNumber(p.beneficiariesTarget)}</p>
            <p className="text-[0.6875rem] text-muted">Planned</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-2 py-2">
            <p className="text-lg font-bold tabular-nums text-status-in">+{formatNumber(p.beneficiariesAdditional)}</p>
            <p className="text-[0.6875rem] text-muted">Additional</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-2 py-2">
            <p className="text-lg font-bold tabular-nums">{formatNumber(total)}</p>
            <p className="text-[0.6875rem] text-muted">In all</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Milestones({ project: p, today, canManage, onTeam, busy, act }: { project: Project; today: string; canManage: boolean; onTeam: boolean; busy: string | null; act: Act }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Milestone['kind']>('milestone');
  const [due, setDue] = useState('');
  const list = orderMilestones(p.milestones);
  const add = () => {
    if (!title.trim()) return;
    void act('add-ms', async () => {
      await projectsService.addMilestone(p.id, { title, kind, dueDate: due || null });
      setTitle('');
      setDue('');
    });
  };
  return (
    <section className="card flex flex-col gap-3 p-4" aria-labelledby="pd-ms">
      <h3 id="pd-ms" className="card-title flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-uplift" aria-hidden /> Milestones and reports
      </h3>
      {list.length === 0 ? (
        <p className="text-sm text-muted">{canManage ? 'Add the steps and reporting deadlines; progress follows them.' : 'No milestones yet.'}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line/50">
          {list.map((m) => {
            const due = dueText(m, today);
            return (
              <li key={m.id} className="flex items-start gap-3 py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={m.done}
                  aria-label={m.title}
                  disabled={!onTeam || busy === m.id}
                  title={onTeam ? undefined : 'Only the project’s team can tick this off'}
                  onClick={() => void act(m.id, () => projectsService.setMilestoneDone(m.id, !m.done))}
                  className="grid h-9 w-9 shrink-0 place-items-center disabled:cursor-not-allowed"
                >
                  {busy === m.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden />
                  ) : (
                    <span className={`grid h-5 w-5 place-items-center rounded-md border-2 ${m.done ? 'border-status-in bg-status-in text-page' : onTeam ? 'border-ink-mute' : 'border-line'}`}>
                      {m.done && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                    </span>
                  )}
                </button>
                <span className="min-w-0 flex-1 pt-1.5">
                  <span className={`block text-sm leading-snug ${m.done ? 'text-muted line-through' : ''}`}>
                    {m.kind === 'report' && <span className="mr-1.5 rounded bg-sky-400/15 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-sky-300 no-underline">Report</span>}
                    {m.title}
                  </span>
                  <span className={`block text-[0.6875rem] ${due.late ? 'font-semibold text-status-out' : due.soon ? 'text-status-low' : 'text-muted'}`}>
                    {m.done ? `Done${m.doneByName ? ` by ${m.doneByName}` : ''}${m.doneAt ? ` · ${formatDateTime(m.doneAt)}` : ''}` : due.text}
                  </span>
                </span>
                {canManage && (
                  <button type="button" className="icon-btn h-9 w-9 shrink-0" aria-label={`Remove ${m.title}`} onClick={() => window.confirm(`Remove “${m.title}”?`) && void act(`rm-${m.id}`, () => projectsService.removeMilestone(m.id))}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canManage && (
        <form
          className="flex flex-col gap-2 rounded-xl border border-line/70 bg-white/[0.02] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind">
            <button type="button" className="chip" aria-pressed={kind === 'milestone'} onClick={() => setKind('milestone')}>
              Milestone
            </button>
            <button type="button" className="chip" aria-pressed={kind === 'report'} onClick={() => setKind('report')}>
              Report deadline
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <input className="field" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'report' ? 'e.g. Quarterly report to the donor' : 'e.g. First distribution done'} aria-label="Title" />
            <input type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
            <button type="submit" className="btn-primary min-h-11 px-4" disabled={!title.trim() || busy === 'add-ms'}>
              {busy === 'add-ms' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />} Add
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function ProjectTasks({ project: p, tasks, canManage, today, onAdded }: { project: Project; tasks: Task[] | null; canManage: boolean; today: string; onAdded: () => void }) {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const team = useMemo(() => {
    const t = p.members.map((m) => ({ id: m.profileId, name: m.name }));
    if (p.leadId && !t.some((x) => x.id === p.leadId)) t.unshift({ id: p.leadId, name: p.leadName ?? 'Lead' });
    return t;
  }, [p]);
  const open = (tasks ?? []).filter((t) => t.status !== 'done');
  const finished = (tasks ?? []).filter((t) => t.status === 'done');
  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await tasksService.save({
        title: title.trim(),
        notes: '',
        list: 'coordination',
        setting: 'field',
        priority: 'medium',
        dueDate: due || null,
        dueTime: null,
        myDay: null,
        subtasks: [],
        recurrence: 'none',
        location: p.location ?? '',
        assigneeId: assignee || null,
        projectId: p.id,
      });
      setTitle('');
      setDue('');
      onAdded();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card flex flex-col gap-3 p-4" aria-labelledby="pd-tasks">
      <div className="flex items-center justify-between gap-2">
        <h3 id="pd-tasks" className="card-title">
          Tasks
        </h3>
        {finished.length > 0 && <span className="text-xs text-muted">{finished.length} done</span>}
      </div>
      {tasks === null ? (
        <Skeleton className="h-16" />
      ) : open.length === 0 ? (
        <p className="text-sm text-muted">No open tasks for this project.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line/50">
          {open.map((t) => {
            const late = t.dueDate && t.dueDate < today;
            return (
              <li key={t.id}>
                <Link to={`/tasks?task=${t.id}`} className="tap flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 hover:bg-white/[0.03]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{t.title}</span>
                    <span className="block text-[0.6875rem] text-muted">{t.assigneeName ?? 'Unassigned'}</span>
                  </span>
                  {t.dueDate && <span className={`shrink-0 text-xs tabular-nums ${late ? 'font-semibold text-status-out' : 'text-muted'}`}>{formatShortDate(t.dueDate)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input className="field" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task for this project" aria-label="New task" />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
          {canManage && (
            <select className="field min-w-0 sm:w-40" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assign to">
              <option value="">Me</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <input type="date" className={`field sm:w-40 ${canManage ? 'col-span-2 sm:col-span-1' : ''}`} value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
          <button type="submit" className="btn-primary min-h-11 px-4" disabled={!title.trim() || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            <span className="sr-only sm:not-sr-only">Add</span>
          </button>
        </div>
      </form>
      {error && <p className="text-xs text-status-out">{error}</p>}
    </section>
  );
}

function Team({ project: p, people, canManage, busy, act }: { project: Project; people: { id: string; name: string }[]; canManage: boolean; busy: string | null; act: Act }) {
  const [adding, setAdding] = useState('');
  const onTeam = new Set([p.leadId, ...p.members.map((m) => m.profileId)]);
  const members = p.members.filter((m) => m.profileId !== p.leadId);
  return (
    <section className="card flex flex-col gap-3 p-4" aria-labelledby="pd-team">
      <h3 id="pd-team" className="card-title flex items-center gap-2">
        <Users className="h-4 w-4 text-uplift" aria-hidden /> Team
      </h3>
      <ul className="flex flex-col gap-2">
        <li className="flex items-center gap-3">
          <Avatar initials={initialsOf(p.leadName ?? '?')} size="sm" />
          <span className="min-w-0 flex-1">
            {p.leadId ? (
              <Link to={`/profile/${p.leadId}`} className="block truncate text-sm font-semibold hover:underline">
                {p.leadName ?? 'Project lead'}
              </Link>
            ) : (
              <span className="block truncate text-sm font-semibold">No lead yet</span>
            )}
            <span className="block text-[0.6875rem] text-muted">Project lead</span>
          </span>
        </li>
        {members.map((m) => (
          <li key={m.profileId} className="flex items-center gap-3">
            <Avatar initials={initialsOf(m.name)} size="sm" />
            <Link to={`/profile/${m.profileId}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
              {m.name}
            </Link>
            {canManage && (
              <button type="button" className="icon-btn h-8 w-8" aria-label={`Remove ${m.name} from the team`} disabled={busy === `rm-${m.profileId}`} onClick={() => void act(`rm-${m.profileId}`, () => projectsService.removeMember(p.id, m.profileId))}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <div className="flex gap-2">
          <select className="field min-w-0 flex-1" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Add to the team">
            <option value="">Add someone to the team…</option>
            {people
              .filter((x) => !onTeam.has(x.id))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="btn-ghost min-h-11 shrink-0 px-3"
            disabled={!adding || busy === 'add-member'}
            onClick={() => void act('add-member', async () => (await projectsService.addMember(p.id, adding), setAdding('')))}
            aria-label="Add to the team"
          >
            {busy === 'add-member' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      )}
    </section>
  );
}

function ProjectDocs({ project: p, docs, links }: { project: Project; docs: DocFile[] | null; links: Record<string, DocLinks> }) {
  return (
    <section className="card flex flex-col gap-3 p-4" aria-labelledby="pd-docs">
      <div className="flex items-center justify-between gap-2">
        <h3 id="pd-docs" className="card-title flex items-center gap-2">
          <FileText className="h-4 w-4 text-uplift" aria-hidden /> Documentation
        </h3>
        {docs && docs.length > 0 && (
          <Link to={`/documentation?project=${p.id}`} className="link">
            See all {docs.length}
          </Link>
        )}
      </div>
      {docs === null ? (
        <Skeleton className="h-20" />
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted">No photos or reports for this project yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {docs.slice(0, 6).map((d) => (
            <li key={d.id}>
              <Link to={`/documentation?project=${p.id}`} className="block aspect-square overflow-hidden rounded-lg border border-line/60 bg-surface-sunken" title={d.title}>
                {links[d.id]?.thumb && d.mimeType.startsWith('image/') ? (
                  <img src={links[d.id].thumb} alt={d.title} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center p-1 text-center text-[0.625rem] text-muted">{d.title}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to={`/documentation?project=${p.id}&upload=1`} className="btn-ghost min-h-11 px-4 text-sm">
        <Upload className="h-4 w-4" aria-hidden /> Upload for this project
      </Link>
    </section>
  );
}
