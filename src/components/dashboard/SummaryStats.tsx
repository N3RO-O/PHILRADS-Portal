import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, FileText, FolderKanban, LifeBuoy, SquareCheckBig, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatNumber } from '../../lib/format';
import { dashboardService } from '../../services';
import type { SummaryKey } from '../../types';
import { LoadError, Skeleton } from '../ui/Card';
import { SampleBadge } from '../ui/SampleBadge';

const META: Record<SummaryKey, { label: string; window: string; icon: LucideIcon; to: string; warn?: boolean }> = {
  active_projects: { label: 'Active projects', window: 'Right now', icon: FolderKanban, to: '/projects' },
  pending_tasks: { label: 'Pending tasks', window: 'Assigned to your teams', icon: SquareCheckBig, to: '/tasks' },
  inventory_alerts: { label: 'Inventory alerts', window: 'Items below reorder level', icon: TriangleAlert, to: '/inventory', warn: true },
  response_activities: { label: 'Response activities', window: 'Last 30 days', icon: LifeBuoy, to: '/response' },
  documentation_updates: { label: 'Documentation updates', window: 'Last 7 days', icon: FileText, to: '/documentation' },
  upcoming_deadlines: { label: 'Upcoming deadlines', window: 'Next 14 days', icon: CalendarClock, to: '/tasks', warn: true },
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
              return (
                <li key={key}>
                  <Link
                    to={m.to}
                    className="group flex h-full min-h-[8.5rem] flex-col gap-2 rounded-3xl bg-white p-4 ring-1 ring-black/[0.05] transition-shadow hover:shadow-md"
                  >
                    <span className="flex items-start justify-between">
                      <span className={`grid h-9 w-9 place-items-center rounded-full ${m.warn ? 'bg-uplift-100 text-uplift-700' : 'bg-burgundy-50 text-burgundy'}`}>
                        <m.icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                    </span>
                    {value === null ? (
                      <Skeleton className="mt-auto h-8 w-14" />
                    ) : (
                      <span className="mt-auto font-display text-[1.75rem] leading-none tabular-nums">{formatNumber(value)}</span>
                    )}
                    <span className="flex flex-col">
                      <span className="text-sm font-bold leading-tight">{m.label}</span>
                      <span className="text-xs text-muted">{m.window}</span>
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
