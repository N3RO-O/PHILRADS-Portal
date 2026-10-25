import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, CalendarClock, CalendarDays, CheckCheck, ChevronDown, CloudOff, Inbox, Layers, Loader2, MapPin, RefreshCw, Send, Sun, SunMedium, UserRoundCheck, X } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { Certificate } from '../components/tasks/Certificate';
import { LevelUpDialog, ProgressPanel } from '../components/tasks/Progress';
import { QuickAdd } from '../components/tasks/QuickAdd';
import { RewardsSheet, type RewardsTab } from '../components/tasks/RewardsSheet';
import { TaskCalendar } from '../components/tasks/TaskCalendar';
import { LIST_STYLE } from '../components/tasks/taskMeta';
import { TaskRow } from '../components/tasks/TaskRow';
import { TaskSheet } from '../components/tasks/TaskSheet';
import { TeamGoalCard } from '../components/tasks/TeamGoalCard';
import { LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatLongDate, formatNumber, manilaDayKey } from '../lib/format';
import { todayKey } from '../lib/inventory';
import { BUCKET_LABEL, BUCKETS, bucketOf, compareTasks, daysBetween, LIST_META, type Bucket } from '../lib/tasks';
import { computeProgress, LEVELS, type Level } from '../lib/taskProgress';
import { tasksService } from '../services';
import { TASK_LISTS, TaskRuleError, type Assignee, type Kudos, type Task, type TaskDraft, type TaskList, type TeamProgress, type XpAward } from '../services/tasks/types';

type View = 'myday' | 'upcoming' | 'calendar' | 'assigned' | 'delegated' | 'done' | 'list';
type Where = 'all' | 'field' | 'office';
const VIEWS: View[] = ['myday', 'upcoming', 'calendar', 'assigned', 'delegated', 'done', 'list'];

const VIEW_META: Record<Exclude<View, 'list'>, { label: string; icon: typeof Sun; note: string }> = {
  myday: { label: 'My Day', icon: Sun, note: 'What you’ve planned for today.' },
  upcoming: { label: 'Upcoming', icon: CalendarClock, note: 'All your open tasks, soonest first.' },
  calendar: { label: 'Calendar', icon: CalendarDays, note: 'Your tasks on their due dates. Tap a day to see them.' },
  assigned: { label: 'Assigned to me', icon: UserRoundCheck, note: 'Tasks a coordinator gave you.' },
  delegated: { label: 'Given to others', icon: Send, note: 'Tasks you gave to someone else.' },
  done: { label: 'Completed', icon: CheckCheck, note: 'What you’ve finished, with the XP each earned.' },
};

const errorText = (e: unknown) => (e instanceof TaskRuleError ? e.message : !navigator.onLine ? 'You’re offline. Connect and try again.' : e instanceof Error ? e.message : 'Something went wrong. Try again.');

/** Tasks, Any.do style, for humanitarian work in the field and at the office, with levels, badges and a team goal. */
export function TasksPage() {
  const { profile, can } = useAuth();
  const online = useOnlineStatus();
  const canManage = can('tasks.manage');
  const [params, setParams] = useSearchParams();
  const rawView = params.get('view') as View | null;
  const view: View = rawView && VIEWS.includes(rawView) ? rawView : 'myday';
  const rawList = params.get('list') as TaskList | null;
  const listKey: TaskList = rawList && TASK_LISTS.includes(rawList) ? rawList : 'relief';
  const where = (['field', 'office'].includes(params.get('where') ?? '') ? params.get('where') : 'all') as Where;
  const rawDay = params.get('day');
  const rewardsTab = (['badges', 'levels', 'kudos'].includes(params.get('rewards') ?? '') ? params.get('rewards') : null) as RewardsTab | null;

  const setParam = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const today = todayKey();
  /** Calendar: the day being looked at (?day=YYYY-MM-DD, default today). */
  const calDay = rawDay && /^\d{4}-\d{2}-\d{2}$/.test(rawDay) && !Number.isNaN(Date.parse(rawDay)) ? rawDay : today;
  const [me, setMe] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [awards, setAwards] = useState<XpAward[]>([]);
  const [kudos, setKudos] = useState<Kudos[]>([]);
  const [team, setTeam] = useState<TeamProgress | null>(null);
  const [people, setPeople] = useState<Assignee[]>([]);

  // Changes made on this device that haven't reached the server yet.
  const [pending, setPending] = useState(() => tasksService.pending());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [id, list, progress] = await Promise.all([tasksService.currentUserId(), tasksService.list(), tasksService.progress()]);
      setMe(id);
      setTasks(list);
      setAwards(progress.awards);
      setKudos(progress.kudos);
      setSavedAt(tasksService.savedAt());
      setPending(tasksService.pending());
    } catch (e) {
      setLoadError(errorText(e));
    }
    tasksService.team().then(setTeam, () => setTeam(null));
    tasksService.assignees().then(setPeople, () => setPeople([]));
  }, []);
  useEffect(() => void load(), [load]);
  useEffect(
    () =>
      tasksService.subscribe((e) => {
        setPending(tasksService.pending());
        if (e.type === 'synced') {
          void load();
          setToast({ text: `Back online: ${e.count} change${e.count === 1 ? '' : 's'} synced.`, tone: 'ok' });
        }
      }),
    [load],
  );
  // Reconnected: refresh (this also sends anything waiting).
  useEffect(() => {
    if (online) void load();
  }, [online, load]);
  const syncNow = async () => {
    setSyncing(true);
    await tasksService.sync();
    setSyncing(false);
  };
  const waiting = [...pending.values()].filter((p) => !p.error).length;
  const failed = [...pending.values()].filter((p) => p.error);

  // ── What's shown ──
  /** Ticked off a moment ago: stays in place briefly with its "+XP" before moving to Completed. */
  const [linger, setLinger] = useState<Record<string, number>>({});
  const all = useMemo(() => tasks ?? [], [tasks]);
  const isMine = useCallback((t: Task) => (t.assigneeId ?? t.createdById) === me, [me]);
  const whereOk = (t: Task) => where === 'all' || t.setting === where;
  const showOpen = (t: Task) => t.status !== 'done' || t.id in linger;
  const doneToday = (t: Task) => t.status === 'done' && !(t.id in linger) && t.completedAt !== null && manilaDayKey(t.completedAt) === today;

  const openMine = all.filter((t) => isMine(t) && whereOk(t) && t.status !== 'done');
  const counts = {
    myday: openMine.filter((t) => t.myDay === today).length,
    upcoming: openMine.length,
    calendar: undefined,
    assigned: openMine.filter((t) => t.createdById !== me).length,
    delegated: all.filter((t) => t.createdById === me && t.assigneeId && t.assigneeId !== me && t.status !== 'done' && whereOk(t)).length,
    done: all.filter((t) => isMine(t) && t.status === 'done').length,
  };
  const listCount = (l: TaskList) => openMine.filter((t) => t.list === l).length;

  const shown = all
    .filter((t) => {
      if (!whereOk(t)) return false;
      switch (view) {
        case 'myday':
          return isMine(t) && showOpen(t) && t.myDay === today;
        case 'upcoming':
          return isMine(t) && showOpen(t);
        case 'calendar':
          return isMine(t) && t.dueDate !== null;
        case 'assigned':
          return isMine(t) && t.createdById !== me && showOpen(t);
        case 'delegated':
          return t.createdById === me && !!t.assigneeId && t.assigneeId !== me && showOpen(t);
        case 'list':
          return isMine(t) && t.list === listKey && showOpen(t);
        case 'done':
          return isMine(t) && t.status === 'done';
      }
    })
    .sort(compareTasks);

  const awardOf = useMemo(() => new Map(awards.map((a) => [a.taskId, a])), [awards]);
  const progress = useMemo(() => computeProgress({ awards, kudos, tasks: all, userId: me, today }), [awards, kudos, all, me, today]);

  // ── Actions ──
  const [toast, setToast] = useState<{ text: ReactNode; tone: 'ok' | 'warn'; undo?: () => void } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const [levelUp, setLevelUp] = useState<Level | null>(null);
  const [sheet, setSheet] = useState<{ task: Task | null; initial: TaskDraft | null } | null>(null);
  const [printLevel, setPrintLevel] = useState<Level | null>(null);
  const lingerTimers = useRef<number[]>([]);
  useEffect(() => () => lingerTimers.current.forEach(clearTimeout), []);

  const upsert = (list: Task[], t: Task) => (list.some((x) => x.id === t.id) ? list.map((x) => (x.id === t.id ? t : x)) : [t, ...list]);

  const toggle = async (t: Task) => {
    const done = t.status !== 'done';
    const before = progress;
    setTasks((ts) => ts && ts.map((x) => (x.id === t.id ? { ...x, status: done ? 'done' : 'todo', completedAt: done ? new Date().toISOString() : null } : x)));
    if (done) setLinger((l) => ({ ...l, [t.id]: 0 }));
    try {
      const r = await tasksService.complete(t.id, done);
      const nextTasks = upsert(r.next ? upsert(all, r.next) : all, r.task);
      const nextAwards = [...awards.filter((a) => a.taskId !== t.id), ...(r.award ? [r.award] : [])];
      setTasks((ts) => {
        const base = ts ?? [];
        return upsert(r.next ? upsert(base, r.next) : base, r.task);
      });
      setAwards((prev) => [...prev.filter((a) => a.taskId !== t.id), ...(r.award ? [r.award] : [])]);
      const queued = tasksService.pending().has(t.id);
      if (!done) {
        setToast({ text: queued ? `Re-opened “${t.title}”. It will sync when you’re back online.` : `Re-opened “${t.title}”. Its XP was taken back.`, tone: 'ok' });
        return;
      }
      const points = r.award?.points ?? 0;
      setLinger((l) => ({ ...l, [t.id]: points }));
      lingerTimers.current.push(
        window.setTimeout(
          () =>
            setLinger((l) => {
              const n = { ...l };
              delete n[t.id];
              return n;
            }),
          1800,
        ),
      );
      const after = computeProgress({ awards: nextAwards, kudos, tasks: nextTasks, userId: me, today });
      if (after.level.level > before.level.level) setLevelUp(LEVELS.find((l) => l.level === after.level.level) ?? null);
      const newBadges = after.badges.filter((b) => b.earned && !before.badges.find((x) => x.badge.id === b.badge.id)?.earned);
      const parts: string[] = [];
      if (r.award) {
        if (r.award.onTime) parts.push(`on time +${r.award.onTime}`);
        if (r.award.subtasks) parts.push(`subtasks +${r.award.subtasks}`);
      }
      setToast({
        tone: 'ok',
        undo: () => void toggle({ ...r.task }),
        text: (
          <>
            {r.award ? (
              <>
                <strong className="text-uplift">+{points} XP</strong> {parts.length > 0 && <span className="text-muted">({parts.join(', ')})</span>}
                {r.award.capped && <span className="block text-xs text-muted">Daily limit for tasks you set yourself reached. Tasks from others still count.</span>}
              </>
            ) : queued ? (
              <>
                Done: “{t.title}”. <span className="text-muted">Saved on this device; XP is added when it syncs.</span>
              </>
            ) : (
              <>Done: “{t.title}”.</>
            )}
            {newBadges.map((b) => (
              <span key={b.badge.id} className="block text-xs font-semibold text-uplift">
                Badge earned: {b.badge.name}
              </span>
            ))}
            {r.next && <span className="block text-xs text-muted">Next one added for {r.next.dueDate ? manilaFriendly(r.next.dueDate, today) : 'later'}.</span>}
          </>
        ),
      });
    } catch (e) {
      setTasks((ts) => ts && ts.map((x) => (x.id === t.id ? t : x)));
      setLinger((l) => {
        const n = { ...l };
        delete n[t.id];
        return n;
      });
      setToast({ text: errorText(e), tone: 'warn' });
    }
  };

  const toggleMyDay = async (t: Task) => {
    const myDay = t.myDay === today ? null : today;
    setTasks((ts) => ts && ts.map((x) => (x.id === t.id ? { ...x, myDay } : x)));
    try {
      const saved = await tasksService.patch(t.id, { myDay });
      setTasks((ts) => ts && upsert(ts, saved));
    } catch (e) {
      setTasks((ts) => ts && ts.map((x) => (x.id === t.id ? t : x)));
      setToast({ text: errorText(e), tone: 'warn' });
    }
  };

  const add = async (draft: TaskDraft) => {
    try {
      const saved = await tasksService.save(draft);
      setTasks((ts) => upsert(ts ?? [], saved));
      setToast({ text: `Added “${saved.title}”.`, tone: 'ok' });
      return true;
    } catch (e) {
      setToast({ text: errorText(e), tone: 'warn' });
      return false;
    }
  };

  const saveFromSheet = async (draft: TaskDraft) => {
    try {
      const saved = await tasksService.save(draft);
      setTasks((ts) => upsert(ts ?? [], saved));
      setToast({ text: `${draft.id ? 'Saved' : 'Added'} “${saved.title}”.`, tone: 'ok' });
      return null;
    } catch (e) {
      return errorText(e);
    }
  };

  const remove = async (t: Task) => {
    if (!window.confirm(`Remove “${t.title}”? It won’t show in your lists any more.`)) return;
    try {
      await tasksService.remove(t.id);
      setTasks((ts) => ts && ts.filter((x) => x.id !== t.id));
      setSheet(null);
      setToast({ text: `Removed “${t.title}”.`, tone: 'ok' });
    } catch (e) {
      setSheet(null);
      setToast({ text: errorText(e), tone: 'warn' });
    }
  };

  // Home's "Create task" quick action.
  const quickAction = params.get('action');
  useEffect(() => {
    if (quickAction !== 'create-task') return;
    setSheet({ task: null, initial: null });
    setParam({ action: null });
  }, [quickAction, setParam]);

  // Certificate: render it, then open the print dialog.
  useEffect(() => {
    if (!printLevel) return;
    const done = () => setPrintLevel(null);
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 80);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printLevel]);

  // ── Layout ──
  const title = view === 'list' ? LIST_META[listKey].label : VIEW_META[view].label;
  const note = view === 'list' ? `${listCount(listKey)} open` : view === 'myday' ? formatLongDate() : VIEW_META[view].note;
  const defaults = {
    list: view === 'list' ? listKey : where === 'field' ? ('relief' as TaskList) : ('office' as TaskList),
    setting: where !== 'all' ? where : view === 'list' ? LIST_META[listKey].setting : 'office',
    myDay: view === 'myday',
    dueDate: view === 'calendar' ? calDay : null,
  } as const;
  const go = (v: View, l?: TaskList) => setParam({ view: v === 'myday' ? null : v, list: v === 'list' ? (l ?? listKey) : null, day: null });
  const syncOf = (t: Task) => (pending.has(t.id) ? (pending.get(t.id)!.error ? ('failed' as const) : ('waiting' as const)) : null);
  const rowProps = { today, me, syncOf, onToggle: (t: Task) => void toggle(t), onOpen: (t: Task) => setSheet({ task: t, initial: null }), onMyDay: (t: Task) => void toggleMyDay(t) };

  const myDayDone = all.filter((t) => isMine(t) && whereOk(t) && doneToday(t));
  const plannedToday = shown.length + myDayDone.length;
  const suggestions =
    view === 'myday'
      ? openMine
          .filter((t) => t.myDay !== today && t.dueDate !== null && (daysBetween(today, t.dueDate) <= 0 || (t.priority === 'high' && daysBetween(today, t.dueDate) <= 2)))
          .sort(compareTasks)
          .slice(0, 6)
      : [];

  return (
    <div className="grid grid-cols-1 gap-4 pb-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:grid-cols-[13.5rem_minmax(0,1fr)_20rem] xl:items-start">
      {/* Views and lists: a side menu on wide screens. */}
      <nav aria-label="Task views" className="card sticky top-20 hidden flex-col gap-4 p-3 lg:flex">
        <ul className="flex flex-col gap-0.5">
          {(Object.keys(VIEW_META) as Exclude<View, 'list'>[])
            .filter((v) => v !== 'delegated' || canManage || counts.delegated > 0)
            .map((v) => {
              const Icon = VIEW_META[v].icon;
              return (
                <NavItem key={v} active={view === v} onClick={() => go(v)} icon={<Icon className={`h-4 w-4 ${v === 'myday' ? 'text-uplift' : ''}`} aria-hidden />} label={VIEW_META[v].label} count={v === 'done' ? undefined : counts[v]} />
              );
            })}
        </ul>
        <div>
          <p className="px-2 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">Lists</p>
          <ul className="flex flex-col gap-0.5">
            {TASK_LISTS.map((l) => {
              const s = LIST_STYLE[l];
              return <NavItem key={l} active={view === 'list' && listKey === l} onClick={() => go('list', l)} icon={<s.icon className={`h-4 w-4 ${s.text}`} aria-hidden />} label={LIST_META[l].label} count={listCount(l)} />;
            })}
          </ul>
        </div>
        <WhereToggle where={where} onChange={(w) => setParam({ where: w === 'all' ? null : w })} />
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        {/* Phones and tablets: progress first, then views as chips. */}
        <div className="xl:hidden">
          <ProgressPanel initials={profile?.initials ?? '?'} progress={progress} onOpen={(tab) => setParam({ rewards: tab })} />
        </div>

        <section className="card flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:hidden">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Task views">
              {(Object.keys(VIEW_META) as Exclude<View, 'list'>[])
                .filter((v) => v !== 'delegated' || canManage || counts.delegated > 0)
                .map((v) => (
                  <button key={v} type="button" className="chip gap-1.5" aria-pressed={view === v} onClick={() => go(v)}>
                    {VIEW_META[v].label}
                    {v !== 'done' && (counts[v] ?? 0) > 0 && <span className="font-normal opacity-80">{counts[v]}</span>}
                  </button>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="sr-only" htmlFor="task-list-select">
                List
              </label>
              <select
                id="task-list-select"
                className={`chip w-full min-w-0 bg-transparent pr-7 ${view === 'list' ? 'border-uplift text-uplift' : ''}`}
                value={view === 'list' ? listKey : ''}
                onChange={(e) => (e.target.value ? go('list', e.target.value as TaskList) : go('upcoming'))}
              >
                <option value="">All lists</option>
                {TASK_LISTS.map((l) => (
                  <option key={l} value={l}>
                    {LIST_META[l].label} ({listCount(l)})
                  </option>
                ))}
              </select>
              <WhereToggle where={where} onChange={(w) => setParam({ where: w === 'all' ? null : w })} compact />
            </div>
          </div>

          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold leading-tight">
                {view === 'myday' && <SunMedium className="h-6 w-6 text-uplift" aria-hidden />}
                {view === 'list' && (() => {
                  const s = LIST_STYLE[listKey];
                  return <s.icon className={`h-5 w-5 ${s.text}`} aria-hidden />;
                })()}
                {title}
                {tasksService.source === 'mock' && <SampleBadge />}
              </h2>
              <p className="mt-0.5 text-sm text-muted">{note}</p>
            </div>
            {view === 'myday' && plannedToday > 0 && (
              <p className="shrink-0 text-right text-xs text-muted">
                <span className="block text-lg font-bold tabular-nums text-ink">
                  {myDayDone.length}/{plannedToday}
                </span>
                done today
              </p>
            )}
          </header>

          {(!online || savedAt || waiting > 0 || failed.length > 0) && (
            <div role="status" className={`flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-sm ${failed.length ? 'border-rose/40 bg-rose/10' : 'border-sky-300/30 bg-sky-300/[0.07]'}`}>
              <CloudOff className={`mt-0.5 h-4 w-4 shrink-0 ${failed.length ? 'text-rose' : 'text-sky-300'}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p>
                  {!online ? (
                    <strong className="font-semibold">You’re offline.</strong>
                  ) : savedAt ? (
                    <strong className="font-semibold">Can’t reach the server.</strong>
                  ) : (
                    <strong className="font-semibold">Syncing changes.</strong>
                  )}{' '}
                  {!online || savedAt ? 'You can keep working: changes are saved on this device and sync when you’re back online.' : ''}
                  {waiting > 0 && ` ${waiting} change${waiting === 1 ? '' : 's'} waiting.`}
                  {savedAt && ` Showing the copy saved ${new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(savedAt))}.`}
                </p>
                {failed.map((p) => (
                  <p key={p.taskId} className="mt-1 text-xs">
                    <span className="font-semibold text-rose">Couldn’t sync</span> “{all.find((t) => t.id === p.taskId)?.title ?? p.create?.title ?? 'a task'}”: {p.error}{' '}
                    <button type="button" className="link text-xs" onClick={() => void tasksService.discard(p.taskId).then(() => load())}>
                      Discard this change
                    </button>
                  </p>
                ))}
              </div>
              {online && waiting > 0 && (
                <button type="button" className="btn-ghost min-h-9 shrink-0 px-3 text-xs" onClick={() => void syncNow()} disabled={syncing}>
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />} Sync now
                </button>
              )}
            </div>
          )}

          {view !== 'done' && view !== 'delegated' && <QuickAdd today={today} defaults={defaults} onAdd={add} onMore={(d) => setSheet({ task: null, initial: d })} disabled={!tasks} />}

          {suggestions.length > 0 && (
            <div className="rounded-2xl border border-uplift/30 bg-uplift/[0.06] p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Sun className="h-4 w-4 text-uplift" aria-hidden /> Plan your day
                </p>
                <button type="button" className="link text-sm" onClick={() => suggestions.forEach((t) => void toggleMyDay(t))}>
                  Add all to My Day
                </button>
              </div>
              <p className="mt-0.5 text-xs text-muted">Overdue, due today, or urgent soon. Choose what you’ll do today.</p>
              <ul className="mt-2 flex flex-col">
                {suggestions.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 border-t border-uplift/15 py-1.5 first:border-t-0">
                    <span className={`h-2 w-2 shrink-0 rounded-full bg-current ${LIST_STYLE[t.list].text}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    <span className={`shrink-0 text-xs ${t.dueDate && t.dueDate < today ? 'text-rose' : 'text-muted'}`}>{t.dueDate && t.dueDate < today ? 'Overdue' : t.dueDate === today ? 'Today' : 'Soon'}</span>
                    <button type="button" className="btn-ghost min-h-9 shrink-0 px-2.5 text-xs" onClick={() => void toggleMyDay(t)}>
                      <Sun className="h-3.5 w-3.5" aria-hidden /> Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!tasks && !loadError && (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading tasks">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          )}
          {loadError && !tasks && <LoadError message={loadError} onRetry={() => void load()} />}

          {tasks &&
            (view === 'done' ? (
              <CompletedList tasks={shown} awardOf={awardOf} rowProps={rowProps} />
            ) : view === 'calendar' ? (
              <TaskCalendar tasks={shown} today={today} selected={calDay} onSelect={(d) => setParam({ day: d === today ? null : d })}>
                {(dayTasks, label) => (
                  <>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                      {label} {dayTasks.length > 0 && <span className="font-normal">{dayTasks.length}</span>}
                    </h3>
                    {dayTasks.length === 0 ? (
                      <Empty icon={<CalendarDays className="h-8 w-8 text-muted" aria-hidden />}>Nothing due this day. Add a task above and it will be due on {label}.</Empty>
                    ) : (
                      <ul className="-mx-2 flex flex-col">
                        {dayTasks.map((t) => (
                          <TaskRow key={t.id} task={t} flash={linger[t.id] || null} {...rowProps} />
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </TaskCalendar>
            ) : view === 'myday' ? (
              <>
                {shown.length === 0 ? (
                  <Empty icon={<Sun className="h-8 w-8 text-uplift" aria-hidden />}>
                    {myDayDone.length > 0 ? 'Everything you planned for today is done. Well done.' : 'Nothing planned yet. Add a task above, or tap the sun on any task to plan it for today.'}
                  </Empty>
                ) : (
                  <ul className="-mx-2 flex flex-col">
                    {shown.map((t) => (
                      <TaskRow key={t.id} task={t} flash={linger[t.id] || null} {...rowProps} />
                    ))}
                  </ul>
                )}
                {myDayDone.length > 0 && <Collapsible label={`Completed today (${myDayDone.length})`} tasks={myDayDone} rowProps={rowProps} />}
              </>
            ) : (
              <Buckets tasks={shown} today={today} linger={linger} rowProps={rowProps} showList={view !== 'list'} empty={view === 'assigned' ? 'No tasks from others right now.' : view === 'delegated' ? 'You haven’t given anyone a task.' : 'No open tasks here. Add one above.'} />
            ))}
        </section>

        <div className="xl:hidden">
          <TeamGoalCard team={team} canManage={canManage} people={people} me={me} onSetGoal={setGoal} onKudos={sendKudos} />
        </div>
      </div>

      <aside className="hidden flex-col gap-4 xl:sticky xl:top-20 xl:flex">
        <ProgressPanel initials={profile?.initials ?? '?'} progress={progress} onOpen={(tab) => setParam({ rewards: tab })} />
        <TeamGoalCard team={team} canManage={canManage} people={people} me={me} onSetGoal={setGoal} onKudos={sendKudos} />
      </aside>

      <TaskSheet
        open={Boolean(sheet)}
        task={sheet?.task ?? null}
        initial={sheet?.initial ?? null}
        today={today}
        me={me}
        canAssign={canManage}
        people={people}
        onClose={() => setSheet(null)}
        onSave={saveFromSheet}
        onToggleDone={(t) => void toggle(t)}
        onRemove={remove}
      />
      <RewardsSheet tab={rewardsTab} progress={progress} kudos={kudos} onTab={(tab) => setParam({ rewards: tab })} onClose={() => setParam({ rewards: null })} onPrintCertificate={(l) => setPrintLevel(LEVELS.find((x) => x.level === l) ?? null)} />
      <LevelUpDialog level={levelUp} onClose={() => setLevelUp(null)} onViewRewards={() => (setLevelUp(null), setParam({ rewards: 'levels' }))} />
      {printLevel && <Certificate name={profile?.displayName ?? 'Staff member'} level={printLevel} tasksDone={progress.stats.total} />}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-6 md:left-auto md:right-6 md:justify-end">
        {toast && (
          <div
            className={`pointer-events-auto flex max-w-md animate-pop-in items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl shadow-black/50 ${toast.tone === 'ok' ? 'border-uplift/40 bg-surface-raised' : 'border-status-out/50 bg-surface-raised'}`}
          >
            <span className="flex-1">{toast.text}</span>
            {toast.undo && (
              <button type="button" className="link shrink-0 text-sm" onClick={() => (toast.undo?.(), setToast(null))}>
                Undo
              </button>
            )}
            <button type="button" className="-m-1 grid h-8 w-8 shrink-0 place-items-center text-muted hover:text-ink" onClick={() => setToast(null)} aria-label="Dismiss">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  async function setGoal(goal: number) {
    try {
      await tasksService.setTeamGoal(goal);
      setTeam(await tasksService.team());
      setToast({ text: `Team goal set to ${formatNumber(goal)} tasks this month.`, tone: 'ok' });
      return true;
    } catch (e) {
      setToast({ text: errorText(e), tone: 'warn' });
      return false;
    }
  }

  async function sendKudos(toId: string, message: string) {
    try {
      await tasksService.sendKudos(toId, message);
      setToast({ text: `Kudos sent to ${people.find((p) => p.id === toId)?.name ?? 'them'}.`, tone: 'ok' });
      return null;
    } catch (e) {
      return errorText(e);
    }
  }
}

const manilaFriendly = (day: string, today: string) => {
  const d = daysBetween(today, day);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  return new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
};

type RowProps = Omit<Parameters<typeof TaskRow>[0], 'task' | 'flash' | 'showList'>;

function NavItem({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; count?: number }) {
  return (
    <li>
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink aria-[current=page]:bg-surface-raised aria-[current=page]:font-semibold aria-[current=page]:text-ink"
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 && <span className="text-xs tabular-nums text-muted">{count}</span>}
      </button>
    </li>
  );
}

function WhereToggle({ where, onChange, compact }: { where: Where; onChange: (w: Where) => void; compact?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Field or office" className={`grid grid-cols-3 gap-1 rounded-xl bg-surface-sunken p-1 ${compact ? '' : 'mx-1'}`}>
      {(
        [
          ['all', 'All', Layers],
          ['field', 'Field', MapPin],
          ['office', 'Office', Building2],
        ] as const
      ).map(([w, label, Icon]) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={where === w}
          onClick={() => onChange(w)}
          className="flex min-h-9 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-soft transition aria-checked:bg-surface-raised aria-checked:text-ink"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}

function Buckets({ tasks, today, linger, rowProps, showList, empty }: { tasks: Task[]; today: string; linger: Record<string, number>; rowProps: RowProps; showList: boolean; empty: string }) {
  if (tasks.length === 0) return <Empty icon={<Inbox className="h-8 w-8 text-muted" aria-hidden />}>{empty}</Empty>;
  const groups = new Map<Bucket, Task[]>();
  for (const t of tasks) {
    const b = bucketOf(t.dueDate, today);
    groups.set(b, [...(groups.get(b) ?? []), t]);
  }
  return (
    <div className="flex flex-col gap-4">
      {BUCKETS.filter((b) => groups.has(b)).map((b) => (
        <section key={b} aria-label={BUCKET_LABEL[b]}>
          <h3 className={`mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${b === 'overdue' ? 'text-rose' : b === 'today' ? 'text-uplift' : 'text-muted'}`}>
            {BUCKET_LABEL[b]} <span className="font-normal">{groups.get(b)!.length}</span>
          </h3>
          <ul className="-mx-2 flex flex-col">
            {groups.get(b)!.map((t) => (
              <TaskRow key={t.id} task={t} flash={linger[t.id] || null} showList={showList} {...rowProps} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CompletedList({ tasks, awardOf, rowProps }: { tasks: Task[]; awardOf: Map<string, XpAward>; rowProps: RowProps }) {
  if (tasks.length === 0) return <Empty icon={<CheckCheck className="h-8 w-8 text-muted" aria-hidden />}>Nothing finished yet. Your first task earns the “First step” badge.</Empty>;
  const sorted = [...tasks].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const days = new Map<string, Task[]>();
  for (const t of sorted) {
    const d = t.completedAt ? manilaDayKey(t.completedAt) : 'Earlier';
    days.set(d, [...(days.get(d) ?? []), t]);
  }
  return (
    <div className="flex flex-col gap-4">
      {[...days].slice(0, 30).map(([day, list]) => {
        const xp = list.reduce((s, t) => s + (awardOf.get(t.id)?.points ?? 0), 0);
        return (
          <section key={day} aria-label={day}>
            <h3 className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <span>{day === 'Earlier' ? day : manilaFriendly(day, rowProps.today).replace(/^./, (c) => c.toUpperCase())}</span>
              {xp > 0 && <span className="normal-case tracking-normal text-uplift">+{xp} XP</span>}
            </h3>
            <ul className="-mx-2 flex flex-col">
              {list.map((t) => (
                <TaskRow key={t.id} task={t} {...rowProps} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Collapsible({ label, tasks, rowProps }: { label: string; tasks: Task[]; rowProps: RowProps }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden /> {label}
      </button>
      {open && (
        <ul className="-mx-2 flex flex-col">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} {...rowProps} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="tile flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
      {icon}
      <p className="max-w-sm">{children}</p>
    </div>
  );
}
