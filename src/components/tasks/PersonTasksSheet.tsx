import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Check, ChevronUp, CircleCheck, Eye, Hourglass, ListTodo, Loader2, Plus, TriangleAlert, X, Zap, type LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatShortDate } from '../../lib/format';
import { STATUS_META, type Status } from '../../lib/presence';
import { staffBoardService } from '../../services';
import type { BoardPerson, BoardTask } from '../../services/tasks/staffBoard';
import { LoadError, Skeleton } from '../ui/Card';
import { PersonAvatar } from '../ui/PersonAvatar';
import { ViewPhoto } from '../ui/PhotoViewer';
import { Sheet } from '../ui/Sheet';
import { StatusDot } from '../ui/StatusDot';
import { SuccessTick } from '../ui/SuccessTick';
import { TaskTimeline, type Standing, type TimelineItem } from './TaskTimeline';

const manilaToday = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

const STANDING: Record<Standing, { label: string; chip: string; icon: LucideIcon }> = {
  done: { label: 'Done', chip: 'text-status-in', icon: CircleCheck },
  in_progress: { label: 'In progress', chip: 'text-uplift', icon: Zap },
  review: { label: 'For review', chip: 'text-ink-soft', icon: Eye },
  todo: { label: 'Not started', chip: 'text-muted', icon: ListTodo },
  overdue: { label: 'Overdue', chip: 'text-status-out', icon: TriangleAlert },
};
const standing = (t: BoardTask, today: string): Standing =>
  t.status === 'done' ? 'done' : t.status === 'review' ? 'review' : t.status === 'in_progress' ? 'in_progress' : t.dueDate && t.dueDate < today ? 'overdue' : 'todo';

/** Done tasks shown before "Show earlier" (older ones fold away so open work stays in view). */
const RECENT_DONE = 3;
/** Timeline order: done (oldest first), then everything still open by due date (no date last). */
const byDate = (a: string | null, b: string | null) => (a ?? '9999').localeCompare(b ?? '9999');
function timelineOrder(list: BoardTask[], today: string) {
  return list
    .map((t) => ({ t, s: standing(t, today) }))
    .sort((a, b) => Number(b.s === 'done') - Number(a.s === 'done') || (a.s === 'done' ? byDate(a.t.completedAt ?? a.t.dueDate, b.t.completedAt ?? b.t.dueDate) : byDate(a.t.dueDate, b.t.dueDate)));
}

/** One person's tasks, with nudges (for whoever gave the task) and accept or decline (for yourself). */
export function PersonTasks({ person, status, me, onClose, onChanged }: { person: BoardPerson; status: Status; me: string | null; onClose: () => void; onChanged: () => void }) {
  const { can, profile } = useAuth();
  // Anyone from volunteer up can give tasks (from the same or a lower role they wait to be accepted).
  const canGive = can('tasks.manage') || (profile?.roleKey !== undefined && profile.roleKey !== 'viewer');
  const tasks = useAsyncData(() => staffBoardService.tasksOf(person.id));
  const today = manilaToday();
  const mine = person.id === me;
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'nudged' | 'accepted' | 'declined'>>({});
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showEarlier, setShowEarlier] = useState(false);
  useEffect(() => (setError(null), setShowEarlier(false)), [person.id]);

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
  const ordered = timelineOrder(list, today);
  const doneCount = ordered.filter((o) => o.s === 'done').length;
  const hidden = showEarlier ? 0 : Math.max(0, doneCount - RECENT_DONE);
  const items: TimelineItem[] = ordered.slice(hidden).map(({ t, s: st }) => {
    const s = STANDING[st];
    const result = done[t.id];
    const canNudge = !mine && t.status !== 'done' && (t.givenById === me || can('tasks.manage'));
    const waitingForMe = mine && t.acceptance === 'pending' && !result;
    const Icon = s.icon;
    return {
      id: t.id,
      standing: st,
      when: t.dueDate ? formatShortDate(t.dueDate) : 'No due date',
      icon: <Icon className="h-3.5 w-3.5" />,
      title: <p className={`text-sm font-semibold leading-snug ${t.status === 'done' ? 'text-muted line-through decoration-ink-mute/60' : 'text-ink'}`}>{t.title}</p>,
      meta: (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className={`font-semibold ${s.chip}`}>{s.label}</span>
          {t.acceptance === 'pending' && !result && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-line px-1.5 py-0.5 font-semibold text-ink-soft">
              <Hourglass className="h-3 w-3" aria-hidden /> {mine ? 'Needs your answer' : 'Not accepted yet'}
            </span>
          )}
          {t.acceptance === 'declined' && <span className="rounded bg-status-out/15 px-1.5 py-0.5 font-semibold text-status-out">Declined</span>}
          {t.givenBy && (
            <span className="inline-flex items-center gap-1">
              <PersonAvatar id={t.givenById} name={t.givenBy} size="xs" ring="ring-0" frame={false} />
              from {t.givenById === me ? 'you' : t.givenBy}
            </span>
          )}
        </p>
      ),
      actions: (canNudge || (mine && result && result !== 'nudged') || waitingForMe) && (
        <div className="mt-2.5 flex flex-col gap-2">
          {canNudge &&
            (result === 'nudged' ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-status-in">
                <SuccessTick className="h-5 w-5" /> Nudged
              </span>
            ) : (
              <button
                type="button"
                className="press group/n flex w-max items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface"
                disabled={busy === t.id}
                onClick={() => void act(t.id, 'nudged', () => staffBoardService.nudge(t.id))}
                title={t.nudgedAt ? `Last nudged ${formatShortDate(t.nudgedAt.slice(0, 10))}` : 'Send a gentle reminder'}
              >
                {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <BellRing className="h-3.5 w-3.5 group-hover/n:animate-[wiggle_0.5s_ease-in-out]" aria-hidden />}
                Nudge
              </button>
            ))}
          {mine && result && result !== 'nudged' && (
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${result === 'accepted' ? 'text-status-in' : 'text-status-out'}`}>
              {result === 'accepted' ? <SuccessTick className="h-5 w-5" /> : <X className="h-4 w-4" aria-hidden />}
              {result === 'accepted' ? 'Accepted' : 'Declined'}
            </span>
          )}
          {waitingForMe &&
            (declining === t.id ? (
              <>
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
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary press min-h-9 grow basis-28 whitespace-nowrap px-3 text-xs" disabled={busy === t.id} onClick={() => void act(t.id, 'accepted', () => staffBoardService.respond(t.id, true))}>
                  {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />} Accept
                </button>
                <button type="button" className="btn-ghost press min-h-9 grow basis-28 whitespace-nowrap px-3 text-xs" onClick={() => (setDeclining(t.id), setReason(''))}>
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Can’t take it
                </button>
              </div>
            ))}
        </div>
      ),
    };
  });
  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <span className="relative">
            <ViewPhoto id={person.id} name={person.name} subtitle={person.roleName ?? 'Staff'} onLeave={onClose}>
              <PersonAvatar id={person.id} name={person.name} size="lg" />
            </ViewPhoto>
            <StatusDot status={status} size={20} ring="rgb(var(--surface))" className="absolute -bottom-1 -right-1" />
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
        <div className={`grid gap-2 ${!mine && canGive ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {!mine && canGive && (
            <Link to={`/tasks?action=create-task&for=${person.id}`} className="btn-primary h-12 px-3" onClick={onClose}>
              <Plus className="h-4 w-4" aria-hidden /> Give a task
            </Link>
          )}
          <Link to={mine ? '/profile' : `/profile/${person.id}`} className={`${!mine && canGive ? 'btn-ghost' : 'btn-primary'} h-12 px-3`} onClick={onClose}>
            {mine ? 'My profile' : 'Profile'}
          </Link>
          <Link to={mine ? '/tasks' : `/tasks?view=team`} className="btn-ghost h-12 px-3" onClick={onClose}>
            {mine ? 'My tasks' : 'Open in Tasks'}
          </Link>
        </div>
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
            <div key={k as string} className="px-1 py-2.5">
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
          <div className="flex flex-col gap-3">
            {hidden > 0 && (
              <button type="button" className="press mx-auto flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-surface-raised" onClick={() => setShowEarlier(true)}>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden /> {hidden} earlier done
              </button>
            )}
            <TaskTimeline items={items} label={mine ? 'Your tasks' : `${person.name}’s tasks`} />
          </div>
        )}
      </div>
    </Sheet>
  );
}
