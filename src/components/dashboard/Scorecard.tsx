import { useMemo } from 'react';
import { CalendarDays, Home, MapPin, UsersRound } from 'lucide-react';
import { targetFor } from '../../config/kpiTargets';
import { useAsyncData } from '../../hooks/useAsyncData';
import { todayKey } from '../../lib/inventory';
import { monthlyTrend, previousPeriod, totals, type Metric } from '../../lib/kpi';
import { activitiesService } from '../../services';
import { Card, LoadError, Skeleton } from '../ui/Card';
import { KpiTile } from '../ui/KpiTile';

const TILES: { metric: Metric; label: string; icon: typeof Home }[] = [
  { metric: 'people', label: 'People served', icon: UsersRound },
  { metric: 'households', label: 'Households served', icon: Home },
  { metric: 'activities', label: 'Activities', icon: CalendarDays },
  { metric: 'places', label: 'Places reached', icon: MapPin },
];

/**
 * Home's scorecard: this year's headline figures from the statistics records, each with its change
 * from the same time last year, its month-by-month trend, and a bar towards its target where
 * management has set one (src/config/kpiTargets.ts). Each tile opens Statistics.
 */
export function Scorecard() {
  const q = useAsyncData(() => activitiesService.list());
  const today = todayKey();
  const year = Number(today.slice(0, 4));
  const data = useMemo(() => {
    if (q.status !== 'success') return null;
    const now = totals(q.data.filter((a) => a.year === year));
    const hasBefore = q.data.some((a) => a.year === year - 1);
    const before = hasBefore ? totals(previousPeriod(q.data, year, today)) : null;
    const trend = Object.fromEntries(TILES.map((t) => [t.metric, monthlyTrend(q.data, year, t.metric, today)])) as Record<Metric, number[]>;
    return { now, before, trend };
  }, [q.status, q.data, year, today]);
  const target = targetFor(year);

  return (
    <Card id="scorecard" title={`Scorecard · ${year}`} note="This year so far, compared with the same time last year" source={activitiesService.source}>
      {q.status === 'error' ? (
        <LoadError message={q.error.message} onRetry={q.reload} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TILES.map((t) => (
            <li key={t.metric}>
              {data ? (
                <KpiTile
                  icon={t.icon}
                  label={t.label}
                  value={data.now[t.metric]}
                  previous={data.before?.[t.metric] ?? null}
                  changeLabel="vs last year"
                  target={target?.[t.metric] ?? null}
                  trend={data.trend[t.metric]}
                  to="/statistics"
                />
              ) : (
                <Skeleton className="h-40" />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
