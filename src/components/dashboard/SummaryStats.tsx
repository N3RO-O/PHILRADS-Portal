import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, FileText, FolderKanban, LifeBuoy, SquareCheckBig, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatNumber } from '../../lib/format';
import { dashboardService } from '../../services';
import type { SummaryKey } from '../../types';
import { LoadError, Skeleton } from '../ui/Card';
import { SampleBadge } from '../ui/SampleBadge';

interface Meta {
  label: string;
  window: string;
  /** Shown instead of `window` when the count is 0. */
  empty: string;
  /** Call to action shown when the count is 0. */
  cta: string;
  icon: LucideIcon;
  to: string;
  warn?: boolean;
}

const META: Record<SummaryKey, Meta> = {
  active_projects: { label: 'Active projects', window: 'Right now', empty: 'No active projects right now', cta: 'View projects', icon: FolderKanban, to: '/projects' },
  pending_tasks: { label: 'Pending tasks', window: 'Assigned to your teams', empty: 'Nothing pending for your teams', cta: 'Create a task', icon: SquareCheckBig, to: '/tasks?action=create-task' },
  inventory_alerts: { label: 'Inventory alerts', window: 'Items below reorder level', empty: 'All items above reorder level', cta: 'View inventory', icon: TriangleAlert, to: '/inventory', warn: true },
  response_activities: { label: 'Response activities', window: 'Last 30 days', empty: 'None in the last 30 days', cta: 'Open Response', icon: LifeBuoy, to: '/response' },
  documentation_updates: { label: 'Documentation updates', window: 'Last 7 days', empty: 'No uploads in the last 7 days', cta: 'Upload a file', icon: FileText, to: '/documentation?action=upload' },
  upcoming_deadlines: { label: 'Upcoming deadlines', window: 'Next 14 days', empty: 'Nothing due in the next 14 days', cta: 'Open Tasks', icon: CalendarClock, to: '/tasks', warn: true },
};

export function SummaryStats() {
  const summary = useAsyncData(() => dashboardService.getSummary());
  return (
    <section aria-labelledby="overview-title" className="flex flex-col gap-3">
      <h2 id="overview-title" className="flex items-center gap-2 px-1 text-[0.95rem] font-bold">
        Overview {dashboardService.source === 'mock' && <SampleBadge />}
      </h2>
      {summary.status === 'error' ? (
        <div className="card">
          <LoadError message={summary.error.message} onRetry={summary.reload} />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(summary.status === 'success' ? summary.data : Object.keys(META).map((key) => ({ key: key as SummaryKey, value: null }))).map(
            ({ key, value }) => {
              const m = META[key];
              const isEmpty = value === 0;
              return (
                <li key={key}>
                  <Link
                    to={isEmpty ? m.to : m.to.split('?')[0]}
                    className="glass group flex h-full min-h-[8.5rem] flex-col gap-2 rounded-3xl p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_0_0_1px_rgba(100,6,6,0.2),0_18px_36px_-16px_rgba(100,6,6,0.35)] focus-visible:-translate-y-0.5"
                  >
                    <span className="flex items-start justify-between">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-full ${
                          m.warn
                            ? 'bg-gradient-to-b from-uplift-50 to-uplift-100 text-uplift-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(236,149,42,0.22)]'
                            : 'bg-gradient-to-b from-burgundy-50 to-burgundy-100 text-burgundy shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(100,6,6,0.1)]'
                        }`}
                      >
                        <m.icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                      </span>
                      <span className="grid h-7 w-7 place-items-center rounded-full text-muted transition group-hover:bg-burgundy group-hover:text-white">
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </span>
                    </span>
                    {value === null ? (
                      <Skeleton className="mt-auto h-8 w-14" />
                    ) : (
                      <span className="mt-auto font-display text-[1.75rem] leading-none tabular-nums">{formatNumber(value)}</span>
                    )}
                    <span className="flex flex-col">
                      <span className="text-sm font-bold leading-tight">{m.label}</span>
                      <span className="text-xs text-muted">{isEmpty ? m.empty : m.window}</span>
                      {isEmpty && <span className="mt-1 text-xs font-bold text-burgundy">{m.cta} →</span>}
                    </span>
                  </Link>
                </li>
              );
            },
          )}
        </ul>
      )}
    </section>
  );
}
