import type { ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink } from 'lucide-react';
import { expiryStatus, type StockRow } from '../../lib/inventory';
import { formatDateTime, formatNumber, formatShortInstant } from '../../lib/format';
import type { InventorySnapshot, Movement } from '../../services/inventory/types';
import { Sheet } from '../ui/Sheet';
import { ExpiryBadge, MOVEMENT_META, MovementStatusBadge, StockBadge } from './Badges';

interface Props {
  row: StockRow | null;
  rows: StockRow[];
  snapshot: InventorySnapshot;
  movements: Movement[];
  onClose: () => void;
  onOpenRow: (row: StockRow) => void;
  /** Receiving and releasing are done in PHILRADS IMS; the footer opens it. */
  imsUrl?: string;
}

/** Full details for one item at one location: lots, other locations and recent history. */
export function StockDetailSheet({ row, rows, snapshot, movements, onClose, onOpenRow, imsUrl }: Props) {
  const elsewhere = row ? rows.filter((r) => r.item.id === row.item.id && r.key !== row.key && r.location) : [];
  const history = row
    ? movements.filter((m) => m.itemId === row.item.id && (m.locationId === row.location?.id || m.toLocationId === row.location?.id)).slice(0, 8)
    : [];

  return (
    <Sheet
      open={Boolean(row)}
      onClose={onClose}
      title={row?.item.name ?? ''}
      subtitle={row ? `${row.item.sku}${row.item.barcode ? ` · ${row.item.barcode}` : ''} · ${row.item.category}` : undefined}
      footer={
        row && imsUrl ? (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['donations.php', 'Receive', ArrowDownToLine, 'text-status-in'],
                ['transactions.php', 'Release', ArrowUpFromLine, 'text-uplift'],
                ['inventory.php', 'View in IMS', ExternalLink, 'text-ink-soft'],
              ] as const
            ).map(([page, label, Icon, tone]) => (
              <a key={page} href={`${imsUrl}/${page}`} target="_blank" rel="noopener noreferrer" className="btn-ghost h-14 flex-col gap-0.5 px-1 text-xs">
                <Icon className={`h-5 w-5 ${tone}`} aria-hidden />
                {label}
              </a>
            ))}
          </div>
        ) : undefined
      }
    >
      {row && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2">
            <Stat label={row.location?.name ?? 'Not stocked anywhere'} value={`${formatNumber(row.usable)} ${row.item.unit}`}>
              <StockBadge status={row.stock} />
            </Stat>
            <Stat label="Reorder level (per location)" value={`${formatNumber(row.item.reorderLevel)} ${row.item.unit}`}>
              {row.expiredQty > 0 && <span className="text-xs text-status-expired">{formatNumber(row.expiredQty)} expired, not usable</span>}
            </Stat>
          </div>

          <section aria-labelledby="lots-h">
            <h3 id="lots-h" className="mb-2 text-sm font-semibold">
              Lots here <span className="font-normal text-muted">(first-expiry-first-out order)</span>
            </h3>
            {row.batches.length === 0 ? (
              <p className="tile px-4 py-3 text-sm text-muted">No stock at this location.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {row.batches.map((b) => {
                  const exp = expiryStatus(b.expiryDate);
                  return (
                    <li key={b.id} className="tile flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{b.lotNumber ?? 'No lot no.'}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>Received {formatShortInstant(b.receivedAt)}</span>
                          <ExpiryBadge status={exp} date={b.expiryDate} />
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-bold tabular-nums">{formatNumber(b.quantity)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {elsewhere.length > 0 && (
            <section aria-labelledby="else-h">
              <h3 id="else-h" className="mb-2 text-sm font-semibold">
                At other locations
              </h3>
              <ul className="flex flex-col divide-y divide-line/70 rounded-xl border border-line/70">
                {elsewhere.map((r) => (
                  <li key={r.key}>
                    <button type="button" onClick={() => onOpenRow(r)} className="tap flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-white/[0.03]">
                      <span className="min-w-0 truncate">{r.location?.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-semibold tabular-nums">{formatNumber(r.usable)}</span>
                        <StockBadge status={r.stock} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="hist-h">
            <h3 id="hist-h" className="mb-2 text-sm font-semibold">
              Recent movements here
            </h3>
            {history.length === 0 ? (
              <p className="tile px-4 py-3 text-sm text-muted">No movements recorded yet.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {history.map((m) => {
                  const M = MOVEMENT_META[m.type];
                  const incoming = m.type === 'receipt' || (m.type === 'transfer' && m.toLocationId === row.location?.id) || (m.type === 'adjustment' && m.quantity > 0);
                  const to = m.toLocationId ? snapshot.locations.find((l) => l.id === m.toLocationId)?.name : null;
                  return (
                    <li key={m.id} className="flex items-start gap-3 text-sm">
                      <M.icon className={`mt-0.5 h-4 w-4 shrink-0 ${M.cls}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{M.label}</span>
                          <span className={`tabular-nums ${incoming ? 'text-status-in' : 'text-ink'}`}>
                            {m.setTo != null ? `set to ${formatNumber(m.setTo)}` : `${incoming ? '+' : '−'}${formatNumber(Math.abs(m.quantity))}`}
                          </span>
                          <MovementStatusBadge status={m.status} />
                        </p>
                        <p className="truncate text-xs text-muted">
                          {[to && `to ${to}`, m.reference, m.recordedByName].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-muted" dateTime={m.occurredAt} title={formatDateTime(m.occurredAt)}>
                        {formatShortInstant(m.occurredAt)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="tile flex flex-col gap-1.5 px-4 py-3">
      <span className="truncate text-xs text-muted">{label}</span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
      {children}
    </div>
  );
}
