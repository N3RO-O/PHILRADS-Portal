import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, FileText, FolderKanban, LifeBuoy, SquareCheckBig, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatNumber } from '../../lib/format';
import { dashboardService } from '../../services';
import type { SummaryKey } from '../../types';
import { Card, LoadError, Skeleton } from '../ui/Card';
import { TONES } from './labels';

interface Meta {
  label: string;
  window: string;
  /** Shown instead of `window` when the count is 0. */
  empty: string;
  /** Call to action shown when the count is 0. */
  cta: string;
  icon: LucideIcon;
  to: string;
  tone: 0 | 1 | 2;
}

const META: Record<SummaryKey, Meta> = {
  active_projects: { label: 'Active projects', window: 'Right now', empty: 'No active projects right now', cta: 'View projects', icon: FolderKanban, to: '/projects', tone: 0 },
  pending_tasks: { label: 'Pending tasks', window: 'Assigned to your teams', empty: 'Nothing pending for your teams', cta: 'Create a task', icon: SquareCheckBig, to: '/tasks', tone: 2 },
  inventory_alerts: { label: 'Inventory alerts', window: 'Below reorder level', empty: 'All items above reorder level', cta: 'View inventory', icon: TriangleAlert, to: '/inventory?status=low', tone: 1 },
  response_activities: { label: 'Response activities', window: 'Last 30 days', empty: 'None in the last 30 days', cta: 'Open Response', icon: LifeBuoy, to: '/response', tone: 0 },
  documentation_updates: { label: 'Documentation updates', window: 'Last 7 days', empty: 'No uploads in the last 7 days', cta: 'Upload a file', icon: FileText, to: '/documentation', tone: 2 },
  upcoming_deadlines: { label: 'Upcoming deadlines', window: 'Next 14 days', empty: 'Nothing due in the next 14 days', cta: 'Open Tasks', icon: CalendarClock, to: '/tasks', tone: 1 },
};

const ZERO_LINK: Partial<Record<SummaryKey, string>> = {
  pending_tasks: '/tasks?action=create-task',
  documentation_updates: '/documentation?action=upload',
};

/** "Operations overview": six key figures, in the style of the reference's Today's Sales card. */
export function OverviewKpis() {
  const summary = useAsyncData(() => dashboardService.getSummary());
  const rows = summary.status === 'success' ? summary.data : (Object.keys(META) as SummaryKey[]).map((key) => ({ key, value: null }));

  return (
    <Card id="overview" title="Operations overview" note="Key figures across PHILRADS work" source={dashboardService.source} className="h-full">
      {summary.status === 'error' ? (
        <LoadError message={summary.error.message} onRetry={summary.reload} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map(({ key, value }) => {
            const m = META[key];
            const tone = TONES[m.tone];
            const isEmpty = value === 0;
            return (
              <li key={key}>
                <Link
                  to={isEmpty ? ZERO_LINK[key] ?? m.to : m.to}
                  style={{ '--glow': tone.glow } as CSSProperties}
                  className="kpi-tile group flex h-full min-h-[8.5rem] flex-col gap-2 p-4 transition hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-surface-raised"
                >
                  <span className="flex items-start justify-between">
                    <span className={`icon-chip ${tone.text}`}>
                      <m.icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                  </span>
                  {value === null ? (
                    <Skeleton className="mt-auto h-7 w-12" />
                  ) : (
                    <span className="mt-auto text-2xl font-bold tracking-tight tabular-nums text-ink">{formatNumber(value)}</span>
                  )}
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium leading-tight text-ink-soft">{m.label}</span>
                    <span className={`text-[0.6875rem] leading-tight ${isEmpty ? 'text-muted' : tone.text}`}>{isEmpty ? m.empty : m.window}</span>
                    {isEmpty && <span className="mt-0.5 text-[0.6875rem] font-semibold text-uplift">{m.cta} →</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
