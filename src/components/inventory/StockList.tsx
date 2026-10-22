import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, MapPin, PackageSearch } from 'lucide-react';
import { useIncrementalList } from '../../hooks/useIncrementalList';
import type { StockRow } from '../../lib/inventory';
import { formatNumber, formatShortInstant } from '../../lib/format';
import { ExpiryBadge, StockBadge } from './Badges';

export type SortKey = 'attention' | 'item' | 'location' | 'onHand' | 'expiry' | 'updated';
export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

interface Props {
  rows: StockRow[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  onOpen: (row: StockRow) => void;
  resetKey: string;
  onClearFilters?: () => void;
}

const qtyTone: Record<StockRow['stock'], string> = {
  in: 'border-status-in/40 text-status-in',
  low: 'border-status-low/50 text-status-low',
  out: 'border-status-out/60 bg-status-out/15 text-status-out',
};

/** Dense sortable table on desktop; one scannable card per line on phones (< 768 px). */
export function StockList({ rows, sort, onSort, onOpen, resetKey, onClearFilters }: Props) {
  const { visible, hasMore, sentinel, showMore } = useIncrementalList(rows, `${resetKey}|${sort.key}|${sort.dir}`);

  if (rows.length === 0)
    return (
      <div className="tile flex flex-col items-center gap-3 px-4 py-12 text-center">
        <PackageSearch className="h-8 w-8 text-muted" aria-hidden />
        <p className="text-sm text-ink-soft">No stock matches these filters.</p>
        {onClearFilters && (
          <button type="button" className="btn-ghost" onClick={onClearFilters}>
            Clear filters
          </button>
        )}
      </div>
    );

  return (
    <div>
      <p className="sr-only" aria-live="polite">
        {formatNumber(rows.length)} stock lines
      </p>
      {/* Desktop and tablet: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-line/70 md:block">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-surface-sunken text-left text-xs text-muted">
            <tr>
              <Th sort={sort} onSort={onSort} k="item">Item</Th>
              <Th sort={sort} onSort={onSort} k="location">Location</Th>
              <Th sort={sort} onSort={onSort} k="onHand" className="text-right">
                On hand
              </Th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Status
              </th>
              <Th sort={sort} onSort={onSort} k="expiry">Nearest expiry</Th>
              <Th sort={sort} onSort={onSort} k="updated" className="hidden lg:table-cell">
                Last movement
              </Th>
              <th scope="col" className="w-10 px-3 py-2">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {visible.map((r) => (
              <tr key={r.key} onClick={() => onOpen(r)} className="cursor-pointer transition-colors hover:bg-white/[0.03]">
                <td className="max-w-[18rem] px-3 py-2.5">
                  <p className="truncate font-semibold text-ink">{r.item.name}</p>
                  <p className="truncate text-xs text-muted">
                    {r.item.sku} · {r.item.category}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-ink-soft">{r.location?.name ?? <span className="text-muted">Not stocked</span>}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-bold tabular-nums text-ink">{formatNumber(r.usable)}</span>{' '}
                  <span className="text-xs text-muted">{r.item.unit}</span>
                  {r.expiredQty > 0 && <span className="block text-[0.6875rem] text-status-expired">+{formatNumber(r.expiredQty)} expired</span>}
                </td>
                <td className="px-3 py-2.5">
                  <StockBadge status={r.stock} />
                </td>
                <td className="px-3 py-2.5">
                  {r.nearestExpiry ? <ExpiryBadge status={r.expiry} date={r.nearestExpiry} /> : <span className="text-xs text-muted">—</span>}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs text-muted lg:table-cell">{r.lastMovementAt ? formatShortInstant(r.lastMovementAt) : '—'}</td>
                <td className="px-3 py-2.5">
                  {/* The row is clickable for mouse users; this button is the keyboard and screen-reader path. */}
                  <button
                    type="button"
                    className="icon-btn h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(r);
                    }}
                    aria-label={`Open ${r.item.name} at ${r.location?.name ?? 'no location'}`}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: cards */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {visible.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => onOpen(r)}
              className="tile flex w-full items-start gap-3 px-4 py-3.5 text-left transition active:scale-[0.99] active:bg-surface-raised"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-semibold leading-snug text-ink">{r.item.name}</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{r.location?.name ?? 'Not stocked'}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StockBadge status={r.stock} />
                  <ExpiryBadge status={r.expiry} date={r.nearestExpiry} compact />
                  {r.expiredQty > 0 && r.expiry !== 'expired' && (
                    <span className="text-[0.6875rem] font-semibold text-status-expired">{formatNumber(r.expiredQty)} expired</span>
                  )}
                </div>
              </div>
              <div className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-1.5 ${qtyTone[r.stock]}`}>
                <span className="text-lg font-bold leading-tight tabular-nums">{formatNumber(r.usable)}</span>
                <span className="text-[0.625rem] font-semibold uppercase tracking-wide opacity-80">{r.item.unit}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div ref={sentinel} className="mt-3 flex justify-center">
          <button type="button" className="btn-ghost" onClick={showMore}>
            Show more ({formatNumber(rows.length - visible.length)} left)
          </button>
        </div>
      )}
    </div>
  );
}

/** Sortable column header. Defined outside StockList so the button keeps focus after sorting. */
function Th({ k, sort, onSort, children, className = '' }: { k: SortKey; sort: SortState; onSort: (k: SortKey) => void; children: string; className?: string }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-3 py-2 font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 rounded-md py-1 hover:text-ink ${active ? 'text-ink' : ''} ${className.includes('text-right') ? 'flex-row-reverse' : ''}`}
      >
        {children}
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-uplift' : 'opacity-50'}`} aria-hidden />
      </button>
    </th>
  );
}
