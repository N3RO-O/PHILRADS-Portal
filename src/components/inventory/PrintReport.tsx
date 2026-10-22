import { createPortal } from 'react-dom';
import { daysUntil, expiryStatus, type StockRow } from '../../lib/inventory';
import { formatDateTime, formatLongDate, formatNumber, formatShortDate } from '../../lib/format';
import type { InventorySnapshot, Movement } from '../../services/inventory/types';
import { STOCK_META } from './Badges';

interface Props {
  rows: StockRow[];
  snapshot: InventorySnapshot;
  pendingTransfers: Movement[];
  filtersLabel: string;
  preparedBy: string;
}

/**
 * Print-ready inventory summary for donors and disaster agencies. Rendered outside the app
 * and shown only when printing, so "Save as PDF" in the print dialog produces a clean report
 * (works offline and needs no PDF library).
 */
export function PrintReport({ rows, snapshot, pendingTransfers, filtersLabel, preparedBy }: Props) {
  const count = (s: StockRow['stock']) => rows.filter((r) => r.stock === s).length;
  const lots = rows
    .flatMap((r) => r.batches.map((b) => ({ row: r, b, status: expiryStatus(b.expiryDate) })))
    .filter((x) => x.status === 'expired' || x.status === 'expiring')
    .sort((a, z) => (a.b.expiryDate ?? '').localeCompare(z.b.expiryDate ?? ''));
  const name = (id: string | null) => snapshot.locations.find((l) => l.id === id)?.name ?? '—';
  const item = (id: string) => snapshot.items.find((i) => i.id === id);

  return createPortal(
    <div className="print-report">
      <header>
        <h1>PHILRADS Inventory Report</h1>
        <p>Philippine Relief and Development Services, Inc.</p>
        <table className="meta">
          <tbody>
            <tr>
              <th>Generated</th>
              <td>{formatLongDate()}, {formatDateTime(new Date().toISOString()).split(', ').pop()}</td>
              <th>Prepared by</th>
              <td>{preparedBy}</td>
            </tr>
            <tr>
              <th>Data as of</th>
              <td>{formatDateTime(snapshot.fetchedAt)}</td>
              <th>Scope</th>
              <td>
                {filtersLabel}
                {snapshot.source === 'ims' && ' · Source: PHILRADS IMS'}
              </td>
            </tr>
          </tbody>
        </table>
        {(snapshot.source === 'mock' || snapshot.sample) && <p className="warn">SAMPLE DATA: demonstration figures, not real PHILRADS stock.</p>}
      </header>

      <h2>Summary</h2>
      <table className="summary">
        <tbody>
          <tr>
            <th>Stock lines</th>
            <td>{formatNumber(rows.length)}</td>
            <th>{STOCK_META.in.label}</th>
            <td>{formatNumber(count('in'))}</td>
            <th>{STOCK_META.low.label}</th>
            <td>{formatNumber(count('low'))}</td>
            <th>{STOCK_META.out.label}</th>
            <td>{formatNumber(count('out'))}</td>
          </tr>
          <tr>
            <th>Lots expired</th>
            <td>{formatNumber(lots.filter((l) => l.status === 'expired').length)}</td>
            <th>Expiring ≤ 30 d</th>
            <td>{formatNumber(lots.filter((l) => l.status === 'expiring' && daysUntil(l.b.expiryDate!) <= 30).length)}</td>
            <th>Expiring ≤ 90 d</th>
            <td>{formatNumber(lots.filter((l) => l.status === 'expiring').length)}</td>
            <th>Transfers pending</th>
            <td>{formatNumber(pendingTransfers.length)}</td>
          </tr>
        </tbody>
      </table>

      <h2>Stock on hand</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>SKU</th>
            <th>Category</th>
            <th>Location</th>
            <th className="num">Usable on hand</th>
            <th>Unit</th>
            <th className="num">Reorder at</th>
            <th>Status</th>
            <th>Nearest expiry</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.item.name}</td>
              <td>{r.item.sku}</td>
              <td>{r.item.category}</td>
              <td>{r.location?.name ?? 'Not stocked'}</td>
              <td className="num">
                {formatNumber(r.usable)}
                {r.expiredQty > 0 && ` (+${formatNumber(r.expiredQty)} expired)`}
              </td>
              <td>{r.item.unit}</td>
              <td className="num">{formatNumber(r.item.reorderLevel)}</td>
              <td>{STOCK_META[r.stock].label}</td>
              <td>{r.nearestExpiry ? `${formatShortDate(r.nearestExpiry)}${r.expiry === 'expired' ? ' (EXPIRED)' : ''}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {lots.length > 0 && (
        <>
          <h2>Expired and expiring lots (next 90 days)</h2>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Location</th>
                <th>Lot</th>
                <th className="num">Quantity</th>
                <th>Expiry</th>
                <th>Days left</th>
              </tr>
            </thead>
            <tbody>
              {lots.map(({ row, b, status }) => (
                <tr key={b.id}>
                  <td>{row.item.name}</td>
                  <td>{row.location?.name}</td>
                  <td>{b.lotNumber ?? '—'}</td>
                  <td className="num">{formatNumber(b.quantity)}</td>
                  <td>{formatShortDate(b.expiryDate!)}</td>
                  <td>{status === 'expired' ? 'EXPIRED' : daysUntil(b.expiryDate!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {pendingTransfers.length > 0 && (
        <>
          <h2>Transfers awaiting approval</h2>
          <table>
            <thead>
              <tr>
                <th>Requested</th>
                <th>Item</th>
                <th className="num">Quantity</th>
                <th>From</th>
                <th>To</th>
                <th>Requested by</th>
              </tr>
            </thead>
            <tbody>
              {pendingTransfers.map((m) => (
                <tr key={m.id}>
                  <td>{formatDateTime(m.occurredAt)}</td>
                  <td>{item(m.itemId)?.name}</td>
                  <td className="num">{formatNumber(m.quantity)}</td>
                  <td>{name(m.locationId)}</td>
                  <td>{name(m.toLocationId)}</td>
                  <td>{m.recordedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <footer>Generated by the PHILRADS Staff Portal. Every figure is backed by the stock ledger’s timestamped movement records.</footer>
    </div>,
    document.body,
  );
}
