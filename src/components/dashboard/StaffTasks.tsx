import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Check, ChevronLeft, ChevronRight, CircleCheck, Clock, Hourglass, LayoutGrid, Loader2, Rows3, TriangleAlert, Users, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatShortDate } from '../../lib/format';
import { STATUS_META, usePresence, type Status } from '../../lib/presence';
import { StatusDot } from '../ui/StatusDot';
import { staffBoardService } from '../../services';
import type { BoardPerson, BoardTask } from '../../services/tasks/staffBoard';
import { LoadError, Skeleton } from '../ui/Card';
import { PersonAvatar } from '../ui/PersonAvatar';
import { Sheet } from '../ui/Sheet';
import { SuccessTick } from '../ui/SuccessTick';

const VIEW_KEY = 'philrads.home.staff-view';
const manilaToday = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

/** The ring round someone's picture says how they're doing at a glance. */
function ringOf(p: BoardPerson) {
  if (p.overdue > 0) return { ring: 'from-rose via-status-out to-rose/60', label: `${p.overdue} overdue`, tone: 'text-rose' };
  if (p.pending > 0) return { ring: 'from-sky-300 via-sky-400/70 to-sky-200', label: `${p.pending} to accept`, tone: 'text-sky-300' };
  if (p.open + p.inProgress === 0) return { ring: 'from-status-in via-status-in/60 to-emerald-200', label: 'All clear', tone: 'text-status-in' };
  return { ring: 'from-uplift via-uplift-soft to-rose/70', label: `${p.open + p.inProgress} open`, tone: 'text-uplift' };
}

/**
 * Staff Tasks on Home: everyone's picture with whether they're online, how many tasks they carry and
 * how many they finished this week. Tap someone to see the tasks they've been given, nudge them about
 * one, or (for yourself) accept the ones waiting for you.
 */
export function StaffTasks({ search }: { search: string }) {
  const { profile } = useAuth();
  const presence = usePresence();
  const rank: Record<Status, number> = { online: 3, dnd: 2, idle: 1, offline: 0 };
  const board = useAsyncData(() => staffBoardService.board());
  const [view, setView] = useState<'row' | 'grid'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'row';
    } catch {
      return 'row';
    }
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const scroller = useRef<HTMLUListElement>(null);

  const people = useMemo(() => {
    const list = board.status === 'success' ? board.data : [];
    const q = search.trim().toLowerCase();
    return list
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.roleName?.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(b.id === profile?.id) - Number(a.id === profile?.id) ||
          rank[presence.statusOf(b.id)] - rank[presence.statusOf(a.id)] ||
          b.open + b.inProgress - (a.open + a.inProgress) ||
          a.name.localeCompare(b.name),
      );
  }, [board.status, board.data, search, presence, profile?.id]);
  const onlineCount = presence.activeCount(people.map((p) => p.id));
  const person = people.find((p) => p.id === openId) ?? null;

  const setViewSaved = (v: 'row' | 'grid') => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* this visit only */
    }
  };
  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section id="staff-tasks" aria-labelledby="staff-tasks-title" className="card flex scroll-mt-24 flex-col gap-5 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="staff-tasks-title" className="font-display text-2xl tracking-wide text-ink">
            Staff Tasks
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            Who’s carrying what. Tap someone to see their tasks.
            {board.status === 'success' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-status-in">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-in opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-status-in" />
                </span>
                {onlineCount} online
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="icon-btn press rounded-full bg-white/[0.05]" onClick={() => setViewSaved(view === 'row' ? 'grid' : 'row')} aria-label={view === 'row' ? 'Show everyone in a grid' : 'Show in one row'} title={view === 'row' ? 'Grid' : 'Row'}>
            {view === 'row' ? <LayoutGrid className="h-[1.125rem] w-[1.125rem]" aria-hidden /> : <Rows3 className="h-[1.125rem] w-[1.125rem]" aria-hidden />}
          </button>
          {view === 'row' && (
            <>
              <button type="button" className="icon-btn press rounded-full bg-white/[0.05]" onClick={() => page(-1)} aria-label="Previous">
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button type="button" className="icon-btn press rounded-full bg-white/[0.05]" onClick={() => page(1)} aria-label="Next">
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>

      {board.status === 'error' ? (
        <LoadError message={board.error.message} onRetry={board.reload} />
      ) : board.status === 'loading' ? (
        <div className="flex gap-5 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex w-36 shrink-0 flex-col items-center gap-3">
              <Skeleton className="h-32 w-32 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : people.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted">
          <Users className="h-4 w-4" aria-hidden /> No one matches “{search.trim()}”.
        </p>
      ) : (
        <ul
          ref={scroller}
          className={
            view === 'row'
              ? '-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-5 pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden'
              : 'grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6'
          }
        >
          {people.map((p, i) => {
            const r = ringOf(p);
            const status = presence.statusOf(p.id);
            const mine = p.id === profile?.id;
            return (
              <li key={p.id} className={view === 'row' ? 'w-36 shrink-0 snap-start sm:w-44' : ''}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  className="press group flex w-full animate-fade-up flex-col items-center gap-2 rounded-2xl px-1 py-2 text-center transition-colors hover:bg-white/[0.03]"
                  style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
                  aria-label={`${mine ? 'You' : p.name}, ${STATUS_META[status].label}, ${r.label}`}
                >
                  <span className="relative">
                    {/* Gradient ring in the person's state; it turns slowly on hover. */}
                    <span className={`block rounded-full bg-gradient-to-tr p-[3px] transition-transform duration-500 group-hover:rotate-6 ${r.ring}`}>
                      <span className="block rounded-full bg-surface p-[3px]">
                        <PersonAvatar id={p.id} name={p.name} size="hero" ring="ring-0" />
                      </span>
                    </span>
                    {/* Online or offline */}
                    {/* Online, idle, do not disturb or offline (Discord-style). */}
                    <span className="absolute bottom-1.5 left-1.5 flex">
                      {status === 'online' && <span className="absolute inset-1 animate-ping rounded-full bg-[#23a55a]/50" aria-hidden />}
                      <StatusDot status={status} size={26} ring="#26272c" />
                    </span>
                    {/* How many they're carrying */}
                    <span className={`absolute bottom-1 right-0 min-w-[2.25rem] rounded-xl border border-white/10 bg-surface-raised/95 px-2 py-1 text-center font-display text-sm tabular-nums tracking-wide shadow-lg backdrop-blur ${r.tone}`}>
                      {p.open + p.inProgress}
                    </span>
                  </span>
                  <span className="mt-1 block w-full truncate text-[0.95rem] font-semibold text-ink">{mine ? 'You' : p.name}</span>
                  <span className="-mt-1 block w-full truncate text-xs text-muted">{p.roleName ?? 'Staff'}</span>
                  <span className="text-xs text-ink-soft">
                    <span className={r.tone}>{r.label}</span>
                    {p.inProgress > 0 && <span> · {p.inProgress} in progress</span>}
                  </span>
                  <span className="-mt-1 text-xs text-muted">{p.doneWeek} done this week</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {person && <PersonTasks person={person} status={presence.statusOf(person.id)} me={profile?.id ?? null} onClose={() => setOpenId(null)} onChanged={board.reload} />}
    </section>
  );
}

const STANDING = {
  done: { label: 'Done', cls: 'border-l-status-in bg-status-in/[0.07]', chip: 'bg-status-in/15 text-status-in' },
  in_progress: { label: 'In progress', cls: 'border-l-status-low bg-status-low/[0.07]', chip: 'bg-status-low/15 text-status-low' },
  review: { label: 'For review', cls: 'border-l-sky-300 bg-sky-300/[0.06]', chip: 'bg-sky-300/15 text-sky-300' },
  todo: { label: 'Not started', cls: 'border-l-ink-mute bg-white/[0.02]', chip: 'bg-white/[0.06] text-ink-soft' },
  overdue: { label: 'Overdue', cls: 'border-l-status-out bg-status-out/[0.07]', chip: 'bg-status-out/15 text-status-out' },
} as const;
const standing = (t: BoardTask, today: string) =>
  t.status === 'done' ? 'done' : t.status === 'review' ? 'review' : t.status === 'in_progress' ? 'in_progress' : t.dueDate && t.dueDate < today ? 'overdue' : 'todo';

/** One person's tasks, with nudges (for whoever gave the task) and accept or decline (for yourself). */
function PersonTasks({ person, status, me, onClose, onChanged }: { person: BoardPerson; status: Status; me: string | null; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const tasks = useAsyncData(() => staffBoardService.tasksOf(person.id));
  const today = manilaToday();
  const mine = person.id === me;
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'nudged' | 'accepted' | 'declined'>>({});
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  useEffect(() => setError(null), [person.id]);

  const act = async (id: string, kind: 'nudged' | 'accepted' | 'declined', run: () => Promise<void>) => {
    setBusy(id);
    setError(null);
    try {
      await run();
      setDone((d) => ({ ...d, [id]: kind }));
      if (kind !== 'nudged') onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work.');
    } finally {
      setBusy(null);
    }
  };

  const list = tasks.status === 'success' ? tasks.data : [];
  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <span className="relative">
            <PersonAvatar id={person.id} name={person.name} size="lg" />
            <StatusDot status={status} size={20} ring="#26272c" className="absolute -bottom-1 -right-1" />
          </span>
          <span className="min-w-0">
            <span className="block truncate">{mine ? 'Your tasks' : person.name}</span>
            <span className="block text-xs font-normal text-muted">
              {person.roleName ?? 'Staff'} · <span style={{ color: STATUS_META[status].color }}>{STATUS_META[status].label}</span>
            </span>
          </span>
        </span>
      }
      footer={
        <Link to={mine ? '/tasks' : `/tasks?view=team`} className="btn-ghost h-12 w-full" onClick={onClose}>
          {mine ? 'Open my tasks' : 'Open in Tasks'}
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ['Open', person.open, 'text-ink'],
            ['Doing', person.inProgress, 'text-status-low'],
            ['Overdue', person.overdue, 'text-status-out'],
            ['Done 7d', person.doneWeek, 'text-status-in'],
          ].map(([k, v, c]) => (
            <div key={k as string} className="tile px-1 py-2.5">
              <p className={`font-display text-xl tabular-nums tracking-wide ${c}`}>{v as number}</p>
              <p className="text-[0.6875rem] text-muted">{k as string}</p>
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}
        {tasks.status === 'loading' ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : tasks.status === 'error' ? (
          <LoadError message={tasks.error.message} onRetry={tasks.reload} />
        ) : list.length === 0 ? (
          <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
            <CircleCheck className="h-8 w-8 text-status-in" aria-hidden />
            {mine ? 'Nothing given to you right now.' : `Nothing given to ${person.name.split(' ')[0]} right now.`}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((t, i) => {
              const s = STANDING[standing(t, today)];
              const result = done[t.id];
              const canNudge = !mine && t.status !== 'done' && (t.givenById === me || can('tasks.manage'));
              const waitingForMe = mine && t.acceptance === 'pending' && !result;
              return (
                <li key={t.id} className={`animate-fade-up rounded-xl border-l-[3px] px-3 py-2.5 ${s.cls}`} style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium leading-snug ${t.status === 'done' ? 'text-muted line-through' : 'text-ink'}`}>{t.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span className={`rounded px-1.5 py-0.5 font-semibold ${s.chip}`}>{s.label}</span>
                        {t.acceptance === 'pending' && !result && (
                          <span className="inline-flex items-center gap-1 rounded bg-sky-300/15 px-1.5 py-0.5 font-semibold text-sky-300">
                            <Hourglass className="h-3 w-3" aria-hidden /> {mine ? 'Needs your answer' : 'Not accepted yet'}
                          </span>
                        )}
                        {t.acceptance === 'declined' && <span className="rounded bg-status-out/15 px-1.5 py-0.5 font-semibold text-status-out">Declined</span>}
                        {t.dueDate && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden /> {formatShortDate(t.dueDate)}
                          </span>
                        )}
                        {t.givenBy && <span>from {t.givenById === me ? 'you' : t.givenBy}</span>}
                      </p>
                    </div>
                    {canNudge &&
                      (result === 'nudged' ? (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-status-in">
                          <SuccessTick className="h-5 w-5" /> Nudged
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="press group/n flex shrink-0 items-center gap-1.5 rounded-full border border-uplift/40 bg-uplift/10 px-3 py-1.5 text-xs font-semibold text-uplift transition-colors hover:bg-uplift/20"
                          disabled={busy === t.id}
                          onClick={() => void act(t.id, 'nudged', () => staffBoardService.nudge(t.id))}
                          title={t.nudgedAt ? `Last nudged ${formatShortDate(t.nudgedAt.slice(0, 10))}` : 'Send a gentle reminder'}
                        >
                          {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <BellRing className="h-3.5 w-3.5 group-hover/n:animate-[wiggle_0.5s_ease-in-out]" aria-hidden />}
                          Nudge
                        </button>
                      ))}
                    {mine && result && result !== 'nudged' && (
                      <span className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${result === 'accepted' ? 'text-status-in' : 'text-status-out'}`}>
                        {result === 'accepted' ? <SuccessTick className="h-5 w-5" /> : <X className="h-4 w-4" aria-hidden />}
                        {result === 'accepted' ? 'Accepted' : 'Declined'}
                      </span>
                    )}
                  </div>
                  {waitingForMe &&
                    (declining === t.id ? (
                      <div className="mt-2.5 flex flex-col gap-2">
                        <input className="field py-2 text-sm" placeholder="Why can’t you take it? (short)" value={reason} maxLength={280} onChange={(e) => setReason(e.target.value)} autoFocus />
                        <div className="flex gap-2">
                          <button type="button" className="btn-ghost min-h-9 flex-1 text-xs" onClick={() => setDeclining(null)}>
                            Back
                          </button>
                          <button
                            type="button"
                            className="btn min-h-9 flex-1 bg-status-out/20 text-xs text-status-out"
                            disabled={busy === t.id || reason.trim().length < 3}
                            onClick={() => void act(t.id, 'declined', () => staffBoardService.respond(t.id, false, reason.trim())).then(() => setDeclining(null))}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex gap-2">
                        <button type="button" className="btn-primary press min-h-9 flex-1 text-xs" disabled={busy === t.id} onClick={() => void act(t.id, 'accepted', () => staffBoardService.respond(t.id, true))}>
                          {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />} Accept
                        </button>
                        <button type="button" className="btn-ghost press min-h-9 flex-1 text-xs" onClick={() => (setDeclining(t.id), setReason(''))}>
                          <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Can’t take it
                        </button>
                      </div>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
