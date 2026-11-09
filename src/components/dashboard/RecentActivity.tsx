import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Activity, ChevronDown, FileText, FolderKanban, LifeBuoy, Package, SquareCheckBig, type LucideIcon } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDayHeading, formatTime, manilaDayKey } from '../../lib/format';
import { dashboardService } from '../../services';
import type { ActivityKind } from '../../types';
import { Link } from 'react-router-dom';
import { EmptyState, LoadError, Skeleton } from '../ui/Card';
import { SampleBadge } from '../ui/SampleBadge';
import { TONES, matchesSearch } from './labels';

const KIND: Record<ActivityKind, { label: string; icon: LucideIcon; tone: string }> = {
  project: { label: 'Project', icon: FolderKanban, tone: TONES[2].soft },
  inventory: { label: 'Inventory', icon: Package, tone: TONES[0].soft },
  document: { label: 'Document', icon: FileText, tone: TONES[2].soft },
  task: { label: 'Task', icon: SquareCheckBig, tone: TONES[2].soft },
  response: { label: 'Response', icon: LifeBuoy, tone: TONES[1].soft },
  other: { label: 'Update', icon: Activity, tone: TONES[2].soft },
};

const FILTERS: { value: ActivityKind | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'project', label: 'Projects' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'document', label: 'Documents' },
  { value: 'task', label: 'Tasks' },
  { value: 'response', label: 'Response' },
];

/**
 * Recent activity in a box of its own, closed until it's clicked, so it never takes room from the
 * calendar. Closed, it still says what happened last. Opens by itself when a search matches, or when
 * a link points at #recent-activity.
 */
export function RecentActivity({ search }: { search: string }) {
  const activity = useAsyncData(() => dashboardService.getRecentActivity(12));
  const [kind, setKind] = useState<ActivityKind | ''>('');
  const { hash } = useLocation();
  const [open, setOpen] = useState(hash === '#recent-activity');
  const bodyId = useId();
  // Closed: its buttons can't be reached with Tab or read out.
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (body.current) body.current.inert = !open;
  }, [open]);
  useEffect(() => {
    if (hash === '#recent-activity' || search) setOpen(true);
  }, [hash, search]);
  const latest = activity.status === 'success' ? activity.data[0] : null;
  const today = activity.status === 'success' ? activity.data.filter((a) => manilaDayKey(a.occurredAt) === manilaDayKey(new Date().toISOString())).length : 0;
  const items =
    activity.status === 'success'
      ? activity.data.filter((a) => !kind || a.kind === kind).filter((a) => matchesSearch(search, a.title, a.detail, a.actor, KIND[a.kind].label))
      : [];

  return (
    <section id="recent-activity" aria-labelledby="recent-activity-title" className="panel scroll-mt-24 p-0">
      <h2 id="recent-activity-title" className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-ink/[0.03] sm:px-5"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft">
            <Activity className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
              Recent activity
              {dashboardService.source === 'mock' && <SampleBadge />}
              {today > 0 && <span className="rounded-full bg-burgundy-500 px-2 py-px text-[0.6875rem] font-bold tabular-nums text-cloud">{today} today</span>}
            </span>
            <span className="block truncate text-xs text-muted">
              {open ? 'Updates across the portal' : latest ? `Latest: ${latest.title} · ${formatTime(latest.occurredAt)}` : activity.status === 'loading' ? 'Loading…' : 'Updates across the portal'}
            </span>
          </span>
          <span className="hidden shrink-0 text-xs font-semibold text-uplift sm:inline">{open ? 'Hide' : 'Show'}</span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </h2>
      {/* Opens and closes smoothly: the row grows from nothing to its natural height. */}
      <div id={bodyId} className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} ref={body}>
        <div className="relative min-h-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-t border-line px-4 pb-4 pt-4 sm:px-5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter activity by type">
        {FILTERS.map((f) => (
          <button key={f.label} type="button" className="chip" aria-pressed={kind === f.value} onClick={() => setKind(f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      {activity.status === 'loading' && <Skeleton className="h-64" />}
      {activity.status === 'error' && <LoadError message={activity.error.message} onRetry={activity.reload} />}
      {activity.status === 'success' &&
        (items.length === 0 ? (
          activity.data.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Nothing has happened yet"
              action={
                <Link to="/tasks?view=myday" className="btn-ghost min-h-10 px-4 text-sm">
                  Add your first task
                </Link>
              }
            >
              Tasks, stock movements, uploads and response updates will show here as people work.
            </EmptyState>
          ) : (
            <EmptyState
              icon={Activity}
              title="No activity matches"
              action={
                kind ? (
                  <button type="button" className="btn-ghost min-h-10 px-4 text-sm" onClick={() => setKind('')}>
                    Show all activity
                  </button>
                ) : undefined
              }
            >
              {search ? `Nothing recent matches “${search}”.` : 'Nothing of this type lately.'}
            </EmptyState>
          )
        ) : (
          <ol className="relative -mr-2 flex max-h-[25rem] flex-col overflow-y-auto pr-2">
            {items.map((a, i) => {
              const k = KIND[a.kind];
              const day = manilaDayKey(a.occurredAt);
              const showDay = i === 0 || manilaDayKey(items[i - 1].occurredAt) !== day;
              return (
                <Fragment key={a.id}>
                  {showDay && (
                    <li aria-hidden className="pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted first:pt-0">
                      {formatDayHeading(a.occurredAt)}
                    </li>
                  )}
                  <li className="flex animate-fade-in gap-3 rounded-xl py-2.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${k.tone}`}>
                      <k.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug text-ink">{a.title}</p>
                      {a.detail && <p className="text-xs text-muted">{a.detail}</p>}
                      <p className="mt-0.5 text-xs text-muted">
                        <span className="font-semibold text-ink-soft">{k.label}</span>
                        {a.actor && ` · ${a.actor}`} · <time dateTime={a.occurredAt}>{formatTime(a.occurredAt)}</time>
                        <span className="sr-only">, {formatDayHeading(a.occurredAt)}</span>
                      </p>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        ))}
          </div>
        </div>
      </div>
    </section>
  );
}
