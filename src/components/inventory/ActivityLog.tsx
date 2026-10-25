import { useId, useMemo, useState } from 'react';
import { ArrowRight, Download, History, Search } from 'lucide-react';
import { useIncrementalList } from '../../hooks/useIncrementalList';
import { downloadCsv, toCsv } from '../../lib/csv';
import { formatDateTime, formatNumber, manilaDayKey } from '../../lib/format';
import type { InventorySnapshot, Movement, MovementType } from '../../services/inventory/types';
import { MOVEMENT_META, MovementStatusBadge } from './Badges';

interface Props {
  movements: Movement[];
  snapshot: InventorySnapshot;
  /** Type filter to start with (the Inventory overview's Releases / Receipts tiles). */
  initialType?: MovementType | '';
}

const TYPES: MovementType[] = ['receipt', 'release', 'transfer', 'adjustment'];

/**
 * Audit trail from PHILRADS IMS: every receipt, release (with its approval state) and adjustment,
 * with who recorded it, when, how much and why.
 */
export function ActivityLog({ movements, snapshot, initialType = '' }: Props) {
  const uid = useId();
  const [q, setQ] = useState('');
  const [type, setType] = useState<MovementType | ''>(initialType);
  const [loc, setLoc] = useState('');
  const items = useMemo(() => new Map(snapshot.items.map((i) => [i.id, i])), [snapshot.items]);
  const locs = useMemo(() => new Map(snapshot.locations.map((l) => [l.id, l.name])), [snapshot.locations]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return movements.filter((m) => {
      if (type && m.type !== type) return false;
      if (loc && m.locationId !== loc && m.toLocationId !== loc) return false;
      if (!needle) return true;
      const i = items.get(m.itemId);
      return [i?.name, i?.sku, m.lotNumber, m.reference, m.notes, m.recordedByName, locs.get(m.locationId), m.toLocationId && locs.get(m.toLocationId)]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle));
    });
  }, [movements, q, type, loc, items, locs]);

  const { visible, hasMore, sentinel, showMore } = useIncrementalList(filtered, `${q}|${type}|${loc}`, 50);

  const exportCsv = () => {
    const csv = toCsv(filtered, [
      { header: 'Occurred (Manila)', value: (m) => formatDateTime(m.occurredAt) },
      { header: 'Recorded at (UTC)', value: (m) => m.recordedAt },
      { header: 'Type', value: (m) => MOVEMENT_META[m.type].label },
      { header: 'Status', value: (m) => m.status },
      { header: 'Item', value: (m) => items.get(m.itemId)?.name },
      { header: 'SKU', value: (m) => items.get(m.itemId)?.sku },
      { header: 'Quantity', value: (m) => m.quantity },
      { header: 'Count set to', value: (m) => m.setTo ?? null },
      { header: 'Unit', value: (m) => items.get(m.itemId)?.unit },
      { header: 'From / at', value: (m) => locs.get(m.locationId) },
      { header: 'To', value: (m) => (m.toLocationId ? locs.get(m.toLocationId) : '') },
      { header: 'Lot', value: (m) => m.lotNumber },
      { header: 'Expiry', value: (m) => m.expiryDate },
      { header: 'Reference', value: (m) => m.reference },
      { header: 'Notes', value: (m) => m.notes },
      { header: 'Recorded by', value: (m) => m.recordedByName },
      { header: 'Approved / rejected by', value: (m) => m.decidedByName },
      { header: 'Decision note', value: (m) => m.decisionNote },
      { header: 'Record ID', value: (m) => m.clientId },
    ]);
    downloadCsv(`philrads-inventory-log-${manilaDayKey(new Date().toISOString())}.csv`, csv);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={`${uid}-q`} className="sr-only">
          Search the activity log
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input id={`${uid}-q`} type="search" className="field pl-10" placeholder="Item, lot, reference or person" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <select aria-label="Location" className="field min-w-0 flex-1 truncate sm:w-52 sm:flex-none" value={loc} onChange={(e) => setLoc(e.target.value)}>
            <option value="">All locations</option>
            {snapshot.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ghost shrink-0" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">CSV</span>
            <span className="sr-only sm:hidden">Export CSV</span>
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Movement type">
        <button type="button" className="chip" aria-pressed={type === ''} onClick={() => setType('')}>
          All
        </button>
        {TYPES.map((t) => (
          <button key={t} type="button" className="chip gap-1.5" aria-pressed={type === t} onClick={() => setType(type === t ? '' : t)}>
            {MOVEMENT_META[t].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="tile flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted">
          <History className="h-8 w-8" aria-hidden />
          No movements match.
        </div>
      ) : (
        <ol className="flex flex-col divide-y divide-line/60 overflow-hidden rounded-xl border border-line/70">
          {visible.map((m) => {
            const M = MOVEMENT_META[m.type];
            const item = items.get(m.itemId);
            const signed = m.type === 'adjustment' ? m.quantity : m.type === 'receipt' ? m.quantity : -m.quantity;
            return (
              <li key={m.id} className={`flex gap-3 px-4 py-3 ${m.status === 'sync_failed' ? 'bg-status-out/[0.06]' : ''}`}>
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-sunken ${M.cls}`}>
                  <M.icon className="h-4 w-4" aria-hidden />
                  <span className="sr-only">{M.label}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 text-sm">
                      <span className="font-semibold text-ink">{item?.name ?? 'Unknown item'}</span>{' '}
                      <span className={`font-bold tabular-nums ${m.type === 'transfer' ? 'text-ink' : signed > 0 ? 'text-status-in' : 'text-ink'}`}>
                        {m.setTo != null
                          ? `set to ${formatNumber(m.setTo)}`
                          : `${m.type === 'transfer' ? '' : signed > 0 ? '+' : '−'}${formatNumber(Math.abs(m.quantity))}`}
                      </span>{' '}
                      <span className="text-xs text-muted">{item?.unit}</span>
                    </p>
                    <time className="shrink-0 text-xs text-muted" dateTime={m.occurredAt}>
                      {formatDateTime(m.occurredAt)}
                    </time>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
                    <span className={`font-semibold ${M.cls}`}>{M.label}</span>
                    <span className="text-muted">·</span>
                    {locs.get(m.locationId) ?? '—'}
                    {m.toLocationId && (
                      <>
                        <ArrowRight className="h-3 w-3" aria-label="to" />
                        {locs.get(m.toLocationId)}
                      </>
                    )}
                    {m.lotNumber && <span className="text-muted">· Lot {m.lotNumber}</span>}
                  </p>
                  {(m.reference || m.notes) && <p className="mt-0.5 text-xs text-muted">{[m.reference, m.notes].filter(Boolean).join(' — ')}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>By {m.recordedByName}</span>
                    {m.decidedByName && m.status !== 'pending_sync' && (
                      <span>
                        · {m.status === 'rejected' ? 'Rejected' : 'Approved'} by {m.decidedByName}
                      </span>
                    )}
                    <MovementStatusBadge status={m.status} />
                  </div>
                  {m.status === 'rejected' && m.decisionNote && <p className="mt-1 text-xs text-status-out">Reason: {m.decisionNote}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {hasMore && (
        <div ref={sentinel} className="flex justify-center">
          <button type="button" className="btn-ghost" onClick={showMore}>
            Show older ({formatNumber(filtered.length - visible.length)} more)
          </button>
        </div>
      )}
    </div>
  );
}
