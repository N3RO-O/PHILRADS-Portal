import { useAsyncData } from '../../hooks/useAsyncData';
import { formatNumber, formatShortDate } from '../../lib/format';
import { dashboardService } from '../../services';
import { Card, LoadError, Skeleton } from '../ui/Card';

export function ResponseTrend() {
  const weekly = useAsyncData(() => dashboardService.getWeeklyResponse(8));
  const rows = weekly.status === 'success' ? weekly.data : [];
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card id="response-trend" title="Response activities" note="Logged per week, last 8 weeks" source={dashboardService.source}>
      {weekly.status === 'loading' && <Skeleton className="h-44" />}
      {weekly.status === 'error' && <LoadError message={weekly.error.message} onRetry={weekly.reload} />}
      {weekly.status === 'success' && (
        <>
          <div className="flex h-44 items-end gap-2" aria-hidden>
            {rows.map((r, i) => {
              const latest = i === rows.length - 1;
              return (
                <div key={r.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-xs font-bold tabular-nums">{formatNumber(r.count)}</span>
                  <div
                    className={`w-full max-w-[2rem] origin-bottom animate-grow-y rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${
                      latest ? 'bg-gradient-to-t from-[#d27c18] to-uplift' : 'bg-gradient-to-t from-burgundy to-[#981b1a]'
                    }`}
                    style={{ height: `${Math.max(4, (r.count / max) * 100)}%`, minHeight: '0.5rem', animationDelay: `${i * 45}ms` }}
                  />
                  <span className={`text-[0.625rem] text-muted ${i % 2 === rows.length % 2 ? 'max-[480px]:invisible' : ''}`}>
                    {formatShortDate(r.weekStart)}
                  </span>
                </div>
              );
            })}
          </div>
          <ul className="sr-only">
            {rows.map((r) => (
              <li key={r.weekStart}>
                Week of {formatShortDate(r.weekStart)}: {r.count} activities
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
