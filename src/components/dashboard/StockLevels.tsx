import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatNumber } from '../../lib/format';
import { dashboardService } from '../../services';
import { Card, LoadError, Skeleton } from '../ui/Card';

export function StockLevels() {
  const stock = useAsyncData(() => dashboardService.getStockLevels());
  const low = stock.status === 'success' ? stock.data.filter((s) => s.onHand < s.reorderLevel).length : 0;

  return (
    <Card
      id="stock-levels"
      title="Stock levels"
      note={stock.status === 'success' ? `${low} of ${stock.data.length} items below reorder level` : 'Relief items by location'}
      source={dashboardService.source}
      action={
        <Link to="/inventory" className="link shrink-0">
          Inventory <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      {stock.status === 'loading' && <Skeleton className="h-48" />}
      {stock.status === 'error' && <LoadError message={stock.error.message} onRetry={stock.reload} />}
      {stock.status === 'success' && (
        <ul className="flex flex-col gap-3">
          {stock.data.map((s) => {
            const isLow = s.onHand < s.reorderLevel;
            const pct = s.reorderLevel > 0 ? Math.min(1, s.onHand / s.reorderLevel) * 100 : 100;
            return (
              <li key={s.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-sm">
                    <span className="font-semibold">{s.item}</span>
                    <span className="block text-xs text-muted">{s.location}</span>
                  </p>
                  <p className="shrink-0 text-right text-xs tabular-nums">
                    {isLow && <span className="pill mr-1.5 bg-burgundy-50 px-2 py-0.5 text-burgundy">Low</span>}
                    <span className="font-bold">{formatNumber(s.onHand)}</span>
                    <span className="text-muted"> / {formatNumber(s.reorderLevel)} {s.unit}</span>
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-cloud" aria-hidden>
                  <div className={`h-full rounded-full ${isLow ? 'bg-burgundy' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
