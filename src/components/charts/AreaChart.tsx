import { useId, useState } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import { formatNumber } from '../../lib/format';

export interface AreaSeries {
  name: string;
  /** Hex colour (SVG attributes cannot use Tailwind classes). */
  color: string;
  values: number[];
}

interface AreaChartProps {
  labels: string[];
  series: AreaSeries[];
  ariaLabel: string;
  /** Smallest drawing height; the chart grows to fill a taller parent (it is a flex-1 item). */
  minHeight?: number;
}

/** Rounds a maximum up to 2/4/5/10 × 10ⁿ so the three gridlines land on readable numbers. */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 2 ? 2 : m <= 4 ? 4 : m <= 5 ? 5 : 10) * p;
}

const PAD = { l: 30, r: 10, t: 10, b: 24 };

/** Area chart with straight segments, point markers and a hover readout. Later series draw on top. */
export function AreaChart({ labels, series, ariaLabel, minHeight = 170 }: AreaChartProps) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const width = size.width;
  const height = Math.max(minHeight, size.height);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  const n = labels.length;
  const w = Math.max(width, 200);
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i * (w - PAD.l - PAD.r)) / (n - 1));
  const y = (v: number) => PAD.t + (1 - v / max) * (height - PAD.t - PAD.b);
  const baseline = height - PAD.b;
  const step = n > 1 ? (w - PAD.l - PAD.r) / (n - 1) : w;

  return (
    <div ref={ref} className="relative flex-1" style={{ minHeight }}>
      {width > 0 && (
        <svg width={w} height={height} role="img" aria-label={ariaLabel} className="absolute inset-0 block animate-fade-in">
          <defs>
            {series.map((s, si) => (
              <linearGradient key={s.name} id={`${gid}-${si}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.38" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
              </linearGradient>
            ))}
          </defs>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="#36373d" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={PAD.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="#9a9ca6">
                {formatNumber(t)}
              </text>
            </g>
          ))}
          {labels.map((label, i) => (
            <text key={label} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="10" fill="#9a9ca6">
              {label}
            </text>
          ))}
          {series.map((s, si) => {
            const line = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
            return (
              <g key={s.name}>
                <path d={`${line} L${x(s.values.length - 1)},${baseline} L${x(0)},${baseline} Z`} fill={`url(#${gid}-${si})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4.5 : 3} fill="#26272c" stroke={s.color} strokeWidth="2" />
                ))}
              </g>
            );
          })}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={baseline} stroke="#9a9ca6" strokeDasharray="2 3" />}
          {labels.map((label, i) => (
            <rect
              key={label}
              x={x(i) - step / 2}
              y={0}
              width={step}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      )}
      {hover !== null && (
        <div
          className="popover pointer-events-none absolute top-0 z-10 px-3 py-2 text-xs"
          style={{ left: Math.min(Math.max(x(hover) - 70, 0), w - 140), width: 140 }}
        >
          <p className="mb-1 text-muted">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.name}
              </span>
              <span className="font-semibold tabular-nums">{formatNumber(s.values[hover] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
