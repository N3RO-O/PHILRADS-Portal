import { useAsyncData } from '../../hooks/useAsyncData';
import { formatNumber, formatShortDate } from '../../lib/format';
import { dashboardService } from '../../services';
import { AreaChart } from '../charts/AreaChart';
import { Card, LoadError, Skeleton } from '../ui/Card';

const ROSE = '#D97B7B';
const YELLOW = '#EC952A';

/**
 * Response activities per week: the last 4 weeks against the 4 before,
 * in the style of the reference's Customer Fulfilment card.
 */
export function ResponseTrend() {
  const weekly = useAsyncData(() => dashboardService.getWeeklyResponse(8));
  const rows = weekly.status === 'success' ? weekly.data : [];
  const half = Math.floor(rows.length / 2);
  const previous = rows.slice(0, half);
  const recent = rows.slice(half);
  const sum = (r: typeof rows) => r.reduce((t, w) => t + w.count, 0);

  return (
    <Card id="response-trend" title="Response activities" note="Per week: last 4 weeks vs the 4 before" source={dashboardService.source} className="h-full">
      {weekly.status === 'loading' && <Skeleton className="h-52" />}
      {weekly.status === 'error' && <LoadError message={weekly.error.message} onRetry={weekly.reload} />}
      {weekly.status === 'success' &&
        (recent.length === 0 ? (
          <p className="tile py-8 text-center text-sm text-muted">No response activity logged yet.</p>
        ) : (
          <>
            <AreaChart
              ariaLabel="Response activities per week, last 4 weeks compared with the 4 weeks before"
              labels={recent.map((_, i) => `Week ${i + 1}`)}
              series={[
                { name: 'Previous 4 weeks', color: ROSE, values: previous.map((w) => w.count) },
                { name: 'Last 4 weeks', color: YELLOW, values: recent.map((w) => w.count) },
              ]}
            />
            <ul className="sr-only">
              {rows.map((w) => (
                <li key={w.weekStart}>
                  Week of {formatShortDate(w.weekStart)}: {w.count} activities
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 divide-x divide-line/70 border-t border-line/70 pt-3 text-center">
              <p className="flex flex-col items-center gap-0.5">
                <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted">
                  <span className="h-2 w-2 rounded-full bg-rose" aria-hidden /> Previous 4 weeks
                </span>
                <span className="text-sm font-bold tabular-nums text-ink">{formatNumber(sum(previous))}</span>
              </p>
              <p className="flex flex-col items-center gap-0.5">
                <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted">
                  <span className="h-2 w-2 rounded-full bg-uplift" aria-hidden /> Last 4 weeks
                </span>
                <span className="text-sm font-bold tabular-nums text-ink">{formatNumber(sum(recent))}</span>
              </p>
            </div>
          </>
        ))}
    </Card>
  );
}
