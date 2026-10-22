import { useId, useState } from 'react';
import { ArrowRight, Check, CheckCheck, Loader2, X } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { expiryStatus } from '../../lib/inventory';
import { formatDateTime, formatNumber } from '../../lib/format';
import { InventoryRuleError, type InventorySnapshot, type Movement } from '../../services/inventory/types';
import { ExpiryBadge } from './Badges';

interface Props {
  transfers: Movement[];
  snapshot: InventorySnapshot;
  onDecide: (id: string, approve: boolean, note?: string) => Promise<void>;
  onDone: (message: string) => void;
}

/** Approvers confirm or reject stock transfers requested by field staff. */
export function ApprovalsPanel({ transfers, snapshot, onDecide, onDone }: Props) {
  if (transfers.length === 0)
    return (
      <div className="tile flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted">
        <CheckCheck className="h-8 w-8 text-status-in" aria-hidden />
        No transfers waiting for approval.
      </div>
    );
  return (
    <ul className="flex flex-col gap-3">
      {transfers.map((t) => (
        <TransferCard key={t.id} t={t} snapshot={snapshot} onDecide={onDecide} onDone={onDone} />
      ))}
    </ul>
  );
}

function TransferCard({ t, snapshot, onDecide, onDone }: { t: Movement } & Omit<Props, 'transfers'>) {
  const uid = useId();
  const online = useOnlineStatus();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const item = snapshot.items.find((i) => i.id === t.itemId);
  const batch = snapshot.batches.find((b) => b.id === t.batchId);
  const loc = (id: string | null) => snapshot.locations.find((l) => l.id === id)?.name ?? '—';
  const short = batch ? batch.quantity < t.quantity : false;

  const decide = async (approve: boolean) => {
    if (!approve && !note.trim()) {
      setError('Give a reason so the requester knows what to do next.');
      return;
    }
    setBusy(approve ? 'approve' : 'reject');
    setError(null);
    try {
      await onDecide(t.id, approve, note);
      onDone(`${approve ? 'Approved' : 'Rejected'} transfer of ${formatNumber(t.quantity)} ${item?.unit ?? ''} ${item?.name ?? ''}.`);
    } catch (e) {
      setError(e instanceof InventoryRuleError ? e.message : 'Could not reach the server. Try again when connected.');
      setBusy(null);
    }
  };

  return (
    <li className="tile flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {formatNumber(t.quantity)} {item?.unit} · {item?.name}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
            {loc(t.locationId)} <ArrowRight className="h-3.5 w-3.5 text-uplift" aria-label="to" /> {loc(t.toLocationId)}
          </p>
        </div>
        <ExpiryBadge status={expiryStatus(t.expiryDate)} date={t.expiryDate} />
      </div>
      <p className="text-xs text-muted">
        Requested by {t.recordedByName} · {formatDateTime(t.occurredAt)}
        {t.lotNumber && ` · Lot ${t.lotNumber}`}
        {batch && ` · ${formatNumber(batch.quantity)} in lot now`}
      </p>
      {t.reference && <p className="text-sm text-ink-soft">“{t.reference}”</p>}
      {short && <p className="text-xs font-semibold text-status-out">The source lot no longer has enough stock for this transfer.</p>}
      {rejecting && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-note`} className="text-sm font-semibold text-ink-soft">
            Reason for rejecting
          </label>
          <input id={`${uid}-note`} className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} autoFocus />
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-status-out">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {rejecting ? (
          <>
            <button type="button" className="btn-ghost" onClick={() => setRejecting(false)} disabled={Boolean(busy)}>
              Cancel
            </button>
            <button type="button" className="btn border border-status-out/50 bg-status-out/15 text-status-out hover:bg-status-out/25" onClick={() => void decide(false)} disabled={Boolean(busy) || !online}>
              {busy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />} Reject
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={() => setRejecting(true)} disabled={Boolean(busy) || !online}>
              <X className="h-4 w-4" aria-hidden /> Reject…
            </button>
            <button type="button" className="btn-primary" onClick={() => void decide(true)} disabled={Boolean(busy) || short || !online}>
              {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Approve
            </button>
          </>
        )}
      </div>
      {!online && <p className="text-xs text-muted">Approvals need a connection, so stock is checked at the moment you decide.</p>}
    </li>
  );
}
