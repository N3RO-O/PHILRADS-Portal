import { useId } from 'react';
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

/**
 * A smooth path through the points: monotone cubic interpolation (as d3's curveMonotoneX and
 * Recharts' "monotone"), so the curve never bulges past a point and a running total never seems to dip.
 */
function smoothPath(pts: [number, number][]): string {
  const f = (n: number) => n.toFixed(2);
  if (pts.length < 3) return pts.map(([px, py], i) => `${i ? 'L' : 'M'}${f(px)},${f(py)}`).join('');
  const sign = (n: number) => (n < 0 ? -1 : 1);
  const slope = (i: number) => (pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]);
  const t = pts.map((_, i) => {
    if (i === 0 || i === pts.length - 1) return NaN;
    const [s0, s1] = [slope(i - 1), slope(i)];
    const [h0, h1] = [pts[i][0] - pts[i - 1][0], pts[i + 1][0] - pts[i][0]];
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  });
  // The ends lean the way the next tangent does.
  t[0] = (3 * slope(0) - t[1]) / 2;
  const last = pts.length - 1;
  t[last] = (3 * slope(last - 1) - t[last - 1]) / 2;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < last; i++) {
    const [[x0, y0], [x1, y1]] = [pts[i], pts[i + 1]];
    const dx = (x1 - x0) / 3;
    d += `C${f(x0 + dx)},${f(y0 + dx * t[i])} ${f(x1 - dx)},${f(y1 - dx * t[i + 1])} ${f(x1)},${f(y1)}`;
  }
  return d;
}

/** A small, smooth line of the running total over a soft fade, with the latest point marked. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const fade = `spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const w = 120;
  const h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const x = (i: number) => (i / (values.length - 1)) * (w - 6) + 3;
  const y = (v: number) => (max === min ? h / 2 : h - 4 - ((v - min) / (max - min)) * (h - 8));
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smoothPath(pts);
  const [endX, endY] = pts[pts.length - 1];
  return (
    <span className="relative mt-auto block h-7 w-full">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={`${label}, month by month: from ${formatNumber(values[0])} to ${formatNumber(values[values.length - 1])}`}>
        <defs>
          <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'rgb(var(--ink-mute))', stopOpacity: 0.22 }} />
            <stop offset="100%" style={{ stopColor: 'rgb(var(--ink-mute))', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={`${line}L${endX.toFixed(2)},${h}L${pts[0][0].toFixed(2)},${h}Z`} fill={`url(#${fade})`} stroke="none" />
        <path d={line} fill="none" style={{ stroke: 'rgb(var(--ink-mute))' }} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Drawn outside the stretched picture, so it stays round. */}
      <span
        aria-hidden
        className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-soft ring-2 ring-surface"
        style={{ left: `${(endX / w) * 100}%`, top: `${(endY / h) * 100}%` }}
      />
    </span>
  );
}
