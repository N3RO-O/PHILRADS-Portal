import { Fragment, useState } from 'react';
import { Activity, FileText, FolderKanban, LifeBuoy, Package, SquareCheckBig, type LucideIcon } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDayHeading, formatTime, manilaDayKey } from '../../lib/format';
import { dashboardService } from '../../services';
import type { ActivityKind } from '../../types';
import { Link } from 'react-router-dom';
import { Card, EmptyState, LoadError, Skeleton } from '../ui/Card';
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

export function RecentActivity({ search }: { search: string }) {
  const activity = useAsyncData(() => dashboardService.getRecentActivity(12));
  const [kind, setKind] = useState<ActivityKind | ''>('');
  const items =
    activity.status === 'success'
      ? activity.data.filter((a) => !kind || a.kind === kind).filter((a) => matchesSearch(search, a.title, a.detail, a.actor, KIND[a.kind].label))
      : [];

  return (
    <Card id="recent-activity" title="Recent activity" note="Updates across the portal" source={dashboardService.source} className="h-full">
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
                <Link to="/tasks?view=myday" className="btn-primary min-h-10 px-4 text-sm">
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
          <ol className="-mr-2 flex max-h-[25rem] flex-col overflow-y-auto pr-2">
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
    </Card>
  );
}
