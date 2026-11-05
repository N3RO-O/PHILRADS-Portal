import type { AsyncState } from '../../hooks/useAsyncData';
import { formatNumber } from '../../lib/format';
import { dashboardService } from '../../services';
import type { StockLevel } from '../../types';
import { Gauge } from '../charts/Gauge';
import { Card, LoadError, Skeleton } from '../ui/Card';

interface Props {
  stock: AsyncState<StockLevel[]> & { reload: () => void };
}

/** Share of items above their low-stock level (the IMS counts "at or under" as running low), in the style of the reference's Earnings gauge. */
export function StockHealth({ stock }: Props) {
  const items = stock.status === 'success' ? stock.data : [];
  const ok = items.filter((s) => s.onHand > s.reorderLevel).length;
  const low = items.length - ok;
  const pct = items.length ? (ok / items.length) * 100 : 0;

  return (
    <Card id="stock-health" title="Stock health" note="Items above their low-stock level" source={dashboardService.source} className="h-full">
      {stock.status === 'loading' && <Skeleton className="h-52" />}
      {stock.status === 'error' && <LoadError message={stock.error.message} onRetry={stock.reload} />}
      {stock.status === 'success' &&
        (items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No inventory items tracked yet.</p>
        ) : (
          <>
            <div>
              <p className="text-2xl font-bold tabular-nums text-ink">
                {formatNumber(ok)} of {formatNumber(items.length)} items
              </p>
              <p className="mt-1 text-xs text-muted">
                {low === 0 ? 'No item is running low.' : `${formatNumber(low)} ${low === 1 ? 'item is' : 'items are'} running low.`}
              </p>
            </div>
            <div className="grid flex-1 place-items-center py-2">
              <Gauge value={pct} label="Items above their low-stock level" />
            </div>
          </>
        ))}
    </Card>
  );
}
