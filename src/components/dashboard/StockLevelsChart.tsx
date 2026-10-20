import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { AsyncState } from '../../hooks/useAsyncData';
import { formatNumber } from '../../lib/format';
import { dashboardService } from '../../services';
import type { StockLevel } from '../../types';
import { PairedBars } from '../charts/PairedBars';
import { Card, LoadError, Skeleton } from '../ui/Card';

interface Props {
  stock: AsyncState<StockLevel[]> & { reload: () => void };
}

/** Stock on hand vs reorder level per item, in the style of the reference's Level card. */
export function StockLevelsChart({ stock }: Props) {
  const items = stock.status === 'success' ? stock.data.slice(0, 7) : [];
  return (
    <Card
      id="stock-levels"
      title="Stock levels"
      note="On hand vs reorder level"
      source={dashboardService.source}
      className="h-full"
      action={
        <Link to="/inventory" className="link shrink-0">
          Inventory <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      {stock.status === 'loading' && <Skeleton className="h-48" />}
      {stock.status === 'error' && <LoadError message={stock.error.message} onRetry={stock.reload} />}
      {stock.status === 'success' &&
        (items.length === 0 ? (
          <p className="tile py-8 text-center text-sm text-muted">No inventory items yet.</p>
        ) : (
          <>
            <PairedBars
              pairs={items.map((s) => ({
                key: s.id,
                label: s.item.split(' ')[0],
                fullLabel: `${s.item} · ${s.location}`,
                a: s.onHand,
                b: s.reorderLevel,
                aClass: s.onHand < s.reorderLevel ? 'bg-rose' : 'bg-uplift',
              }))}
              aName="On hand"
              bName="Reorder level"
              bClass="bg-[#4a4b52]"
              unitOf={(p) => items.find((s) => s.id === p.key)?.unit ?? ''}
            />
            <ul className="sr-only">
              {items.map((s) => (
                <li key={s.id}>
                  {s.item}, {s.location}: {s.onHand} {s.unit} on hand, reorder level {s.reorderLevel}
                  {s.onHand < s.reorderLevel ? ', below reorder level' : ''}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-line/70 pt-3 text-[0.6875rem] text-muted" aria-hidden>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-uplift" /> On hand</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose" /> Below reorder level</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#4a4b52]" /> Reorder level</span>
            </div>
            <p className="sr-only">
              {formatNumber(items.filter((s) => s.onHand < s.reorderLevel).length)} of {formatNumber(items.length)} items are below their reorder level.
            </p>
          </>
        ))}
    </Card>
  );
}
