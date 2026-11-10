import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCheck, Hourglass, Plus, Sun } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { todayKey } from '../../lib/inventory';
import { bucketOf, compareTasks, dueLabel, LIST_META } from '../../lib/tasks';
import { dashboardService, tasksService } from '../../services';
import { TASK_ANSWERED } from '../../services/tasks/staffBoard';
import type { Task } from '../../services/tasks/types';
import { weekCircles, type Progress } from '../../lib/taskProgress';
import { LIST_STYLE } from '../tasks/taskMeta';
import { WeekDots } from '../tasks/Progress';
import { Card, LoadError, Skeleton } from '../ui/Card';
import { matchesSearch } from './labels';

/** How many rows each column shows before "n more in Tasks". */
const SHOWN = 4;

/**
 * Your tasks at a glance, in three columns (stacked on phones): tasks someone asks you to take on,
 * what's on today (planned for today, due today or overdue), and what's coming up next. Every row
 * opens that task in Tasks. Refreshes when a new note arrives in the bell.
 */
export function TaskBox({ search }: { search: string }) {
  const data = useAsyncData(async () => {
    const [me, tasks, progress] = await Promise.all([
      tasksService.currentUserId(),
      tasksService.list(),
      // Only for the week circles: if it can't load, the card still shows the tasks.
      tasksService.progress().catch(() => null),
    ]);
    return { me, tasks, progress };
  });
  const { reload, refresh } = data;
  useEffect(() => {
    const on = () => reload();
    window.addEventListener('philrads:notification', on);
    // A task answered anywhere leaves "Needs your answer" (quietly, without a loading flash).
    window.addEventListener(TASK_ANSWERED, refresh);
    return () => {
      window.removeEventListener('philrads:notification', on);
      window.removeEventListener(TASK_ANSWERED, refresh);
    };
  }, [reload, refresh]);

  const today = todayKey();
  let offers: Task[] = [];
  let onToday: Task[] = [];
  let next: Task[] = [];
  let week: Progress['week'] | null = null;
  if (data.status === 'success') {
    const { me, tasks, progress } = data.data;
    if (progress) week = weekCircles(progress.awards, today, progress.weekBonuses);
    const open = tasks
      .filter((t) => (t.assigneeId ?? t.createdById) === me && t.status !== 'done' && t.acceptance !== 'declined')
      .filter((t) => matchesSearch(search, t.title, t.location ?? '', LIST_META[t.list].label, t.createdByName ?? ''))
      .sort(compareTasks);
    const isOffer = (t: Task) => t.createdById !== me && t.acceptance === 'pending';
    offers = open.filter(isOffer);
    const rest = open.filter((t) => !isOffer(t));
    const isToday = (t: Task) => t.myDay === today || ['overdue', 'today'].includes(bucketOf(t.dueDate, today));
    onToday = rest.filter(isToday);
    next = rest.filter((t) => !isToday(t) && t.dueDate !== null);
  }

  return (
    <Card
      id="task-box"
      title="My tasks"
      note={search ? `Matching “${search}”` : 'What needs you today and what’s next'}
      source={dashboardService.source}
      action={
        <div className="flex shrink-0 items-center gap-3">
          <Link to="/tasks?action=create-task" className="link hidden sm:inline-flex">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add task
          </Link>
          <Link to="/tasks" className="link">
            Open Tasks <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      }
    >
      {data.status === 'loading' && <Skeleton className="h-48" />}
      {data.status === 'error' && <LoadError message={data.error.message} onRetry={reload} />}
      {week && (
        <div className="mb-5">
          <WeekDots week={week} compact />
        </div>
      )}
      {data.status === 'success' && (
        <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
          <Column
            icon={<Hourglass className="h-4 w-4" aria-hidden />}
            title="Needs your answer"
            tasks={offers}
            today={today}
            more="/tasks?view=assigned"
            empty="No one is waiting on you."
            tone="text-uplift"
          />
          <Column icon={<Sun className="h-4 w-4" aria-hidden />} title="Today" tasks={onToday} today={today} more="/tasks?view=upcoming" empty="Nothing planned for today." />
          <Column icon={<CalendarClock className="h-4 w-4" aria-hidden />} title="Coming up" tasks={next} today={today} more="/tasks?view=upcoming" empty="Nothing due after today." />
        </div>
      )}
    </Card>
  );
}

function Column({ icon, title, tasks, today, more, empty, tone = 'text-ink-soft' }: { icon: ReactNode; title: string; tasks: Task[]; today: string; more: string; empty: string; tone?: string }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h3 className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] ${tone}`}>
        {icon} {title}
        <span className="ml-auto rounded-full bg-surface-sunken px-2 py-px text-[0.6875rem] tabular-nums text-ink-soft">{tasks.length}</span>
      </h3>
      {tasks.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
          <CheckCheck className="h-4 w-4 shrink-0" aria-hidden /> {empty}
        </p>
      ) : (
        <ul className="flex flex-col">
          {tasks.slice(0, SHOWN).map((t) => (
            <li key={t.id}>
              <TaskLine task={t} today={today} />
            </li>
          ))}
          {tasks.length > SHOWN && (
            <li>
              <Link to={more} className="link mt-1 text-sm">
                {tasks.length - SHOWN} more in Tasks <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function TaskLine({ task: t, today }: { task: Task; today: string }) {
  const Icon = LIST_STYLE[t.list].icon;
  const due = dueLabel(t, today);
  const late = bucketOf(t.dueDate, today) === 'overdue';
  const offer = t.acceptance === 'pending';
  return (
    <Link to={`/tasks?task=${t.id}`} className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-ink/[0.04]">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-soft">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-ink">{t.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {offer && <span className="font-semibold text-uplift">From {t.createdByName ?? 'a coordinator'}</span>}
          {due && <span className={late ? 'font-semibold text-rose' : ''}>{late ? `Overdue · ${due}` : due}</span>}
          {!offer && !due && <span>{LIST_META[t.list].label}</span>}
          {t.priority === 'high' && <span className="font-semibold text-ink-soft">High priority</span>}
        </span>
      </span>
    </Link>
  );
}
