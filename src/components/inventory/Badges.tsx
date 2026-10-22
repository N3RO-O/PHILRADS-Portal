import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  CloudOff,
  Clock,
  Hourglass,
  SlidersHorizontal,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { daysUntil, type ExpiryStatus, type StockStatus } from '../../lib/inventory';
import { formatShortDate } from '../../lib/format';
import type { MovementStatus, MovementType } from '../../services/inventory/types';

const base = 'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold';

export const STOCK_META: Record<StockStatus, { label: string; icon: LucideIcon; cls: string }> = {
  in: { label: 'In stock', icon: CircleCheck, cls: 'border-status-in/40 bg-status-in/10 text-status-in' },
  low: { label: 'Low stock', icon: TriangleAlert, cls: 'border-status-low/40 bg-status-low/10 text-status-low' },
  out: { label: 'Out of stock', icon: CircleSlash, cls: 'border-status-out/50 bg-status-out/15 text-status-out' },
};

export function StockBadge({ status }: { status: StockStatus }) {
  const m = STOCK_META[status];
  return (
    <span className={`${base} ${m.cls}`}>
      <m.icon className="h-3 w-3" aria-hidden /> {m.label}
    </span>
  );
}

/** Expiry badge with the days left, e.g. "Expires in 12 d". Nothing for goods that don't expire. */
export function ExpiryBadge({ status, date, compact = false }: { status: ExpiryStatus; date: string | null; compact?: boolean }) {
  if (!date || status === 'none') return null;
  const days = daysUntil(date);
  if (status === 'expired')
    return (
      <span className={`${base} border-status-expired/50 bg-status-expired/15 text-status-expired`} title={`Expired ${formatShortDate(date)}`}>
        <XCircle className="h-3 w-3" aria-hidden /> {compact ? 'Expired lot' : `Expired ${formatShortDate(date)}`}
      </span>
    );
  if (status === 'expiring')
    return (
      <span className={`${base} border-status-expiring/40 bg-status-expiring/10 text-status-expiring`} title={`Expires ${formatShortDate(date)}`}>
        <Hourglass className="h-3 w-3" aria-hidden /> {days === 0 ? 'Expires today' : `Expires in ${days} d`}
      </span>
    );
  return compact ? null : <span className="text-xs text-muted">Exp. {formatShortDate(date)}</span>;
}

export const MOVEMENT_META: Record<MovementType, { label: string; verb: string; icon: LucideIcon; cls: string }> = {
  receipt: { label: 'Received', verb: 'Receive', icon: ArrowDownToLine, cls: 'text-status-in' },
  release: { label: 'Released', verb: 'Release', icon: ArrowUpFromLine, cls: 'text-uplift' },
  transfer: { label: 'Transfer', verb: 'Transfer', icon: ArrowLeftRight, cls: 'text-sky-300' },
  adjustment: { label: 'Adjustment', verb: 'Adjust', icon: SlidersHorizontal, cls: 'text-status-expiring' },
};

const STATUS_META: Record<Exclude<MovementStatus, 'applied'>, { label: string; icon: LucideIcon; cls: string }> = {
  pending_approval: { label: 'Awaiting approval', icon: Clock, cls: 'border-status-low/40 bg-status-low/10 text-status-low' },
  rejected: { label: 'Rejected', icon: XCircle, cls: 'border-status-out/40 bg-status-out/10 text-status-out' },
  pending_sync: { label: 'Waiting to sync', icon: CloudOff, cls: 'border-sky-300/40 bg-sky-300/10 text-sky-300' },
  sync_failed: { label: 'Sync failed', icon: CircleAlert, cls: 'border-status-out/50 bg-status-out/15 text-status-out' },
};

export function MovementStatusBadge({ status }: { status: MovementStatus }) {
  if (status === 'applied') return null;
  const m = STATUS_META[status];
  return (
    <span className={`${base} ${m.cls}`}>
      <m.icon className="h-3 w-3" aria-hidden /> {m.label}
    </span>
  );
}
