import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import { formatNumber } from '../../lib/format';
import { RollingNumber } from './RollingNumber';

export interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  value: number;
  /** What the change is measured against, in words ("vs last year"). */
  changeLabel?: string;
  /** The value for the period before; leave out for no change line. */
  previous?: number | null;
  /** A target for the period; leave out for no progress bar. */
  target?: number | null;
  /** Running total, oldest first, for the small trend line. */
  trend?: number[];
  /** For counts where fewer is better (low stock). */
  lowerIsBetter?: boolean;
  to?: string;
}

/**
 * A scorecard figure (docs/design-system.md, KPI tiles): the number, a bar towards its target when it
 * has one, the change from the period before in words and colour (green when it is good, red when
 * not), and a trend line of the running total.
 */
export function KpiTile({ icon: Icon, label, value, changeLabel = 'vs last year', previous, target, trend, lowerIsBetter, to }: KpiTileProps) {
  const change = previous === null || previous === undefined ? null : value - previous;
  const good = change === null || change === 0 ? null : lowerIsBetter ? change < 0 : change > 0;
  const share = target ? Math.round((value / target) * 100) : null;
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </span>
      <RollingNumber value={formatNumber(value)} className="font-display text-2xl tabular-nums tracking-wide text-ink sm:text-[1.75rem]" />
      {share !== null && target ? (
        <span className="flex flex-col gap-1">
          <span
            className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"
            role="progressbar"
            aria-label={`${label}: ${share}% of the ${formatNumber(target)} target`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, share)}
          >
            <span className="block h-full rounded-full bg-uplift transition-[width] duration-700" style={{ width: `${Math.max(3, Math.min(100, share))}%` }} />
          </span>
          <span className="text-[0.6875rem] tabular-nums text-muted">
            {share}% of {formatNumber(target)} target
          </span>
        </span>
      ) : null}
      {change !== null && (
        <span className={`flex flex-wrap items-center gap-x-1 text-xs font-semibold tabular-nums ${good === null ? 'text-muted' : good ? 'text-status-in' : 'text-status-out'}`}>
          {change > 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : change < 0 ? <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
          <span>
            {change > 0 ? '+' : change < 0 ? '−' : ''}
            {formatNumber(Math.abs(change))}
          </span>
          <span className="font-medium text-muted">{changeLabel}</span>
        </span>
      )}
      {trend && trend.length > 1 && <Sparkline values={trend} label={label} />}
    </>
  );
  const box = 'kpi-tile flex h-full flex-col gap-1.5 p-4';
  return to ? (
    <Link to={to} className={`${box} transition-colors hover:border-ink-mute/50 hover:bg-surface-raised`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

/** A small line of the running total, with the latest point marked. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 120;
  const h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const x = (i: number) => (i / (values.length - 1)) * (w - 4) + 2;
  const y = (v: number) => (max === min ? h / 2 : h - 3 - ((v - min) / (max - min)) * (h - 6));
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-auto h-7 w-full" role="img" aria-label={`${label}, month by month: from ${formatNumber(values[0])} to ${formatNumber(values[values.length - 1])}`}>
      <polyline points={points} fill="none" style={{ stroke: 'rgb(var(--ink-mute))' }} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
