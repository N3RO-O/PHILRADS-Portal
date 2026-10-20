import { useState } from 'react';
import { formatNumber } from '../../lib/format';

export interface BarPair {
  key: string;
  label: string;
  /** Shown in the hover readout. */
  fullLabel: string;
  a: number;
  b: number;
  /** Tailwind background class for bar A (may differ per pair, e.g. to flag an alert). */
  aClass: string;
}

interface PairedBarsProps {
  pairs: BarPair[];
  aName: string;
  bName: string;
  bClass: string;
  unitOf?: (pair: BarPair) => string;
  minHeight?: number;
}

/**
 * Two bars per category (e.g. stock on hand vs reorder level), drawn with HTML so they size naturally.
 * Grows to fill its parent's height (never shorter than `minHeight`).
 */
export function PairedBars({ pairs, aName, bName, bClass, unitOf, minHeight = 176 }: PairedBarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...pairs.flatMap((p) => [p.a, p.b]));

  return (
    <div className="relative flex flex-1 flex-col" aria-hidden>
      <div className="flex flex-1 items-end gap-2 border-b border-line" style={{ minHeight }}>
        {pairs.map((p, i) => (
          <div
            key={p.key}
            className={`flex h-full flex-1 items-end justify-center gap-1 rounded-t-lg transition-colors ${hover === i ? 'bg-white/[0.04]' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className={`w-full max-w-[0.85rem] origin-bottom animate-grow-y rounded-t-md ${p.aClass}`} style={{ height: `${(p.a / max) * 100}%`, animationDelay: `${i * 50}ms` }} />
            <div className={`w-full max-w-[0.85rem] origin-bottom animate-grow-y rounded-t-md ${bClass}`} style={{ height: `${(p.b / max) * 100}%`, animationDelay: `${i * 50 + 40}ms` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {pairs.map((p) => (
          <span key={p.key} className="flex-1 truncate text-center text-[0.625rem] text-muted">
            {p.label}
          </span>
        ))}
      </div>
      {hover !== null && (
        <div
          className="popover pointer-events-none absolute -top-2 z-10 w-44 -translate-y-full px-3 py-2 text-xs"
          style={{ left: `clamp(0px, calc(${((hover + 0.5) / pairs.length) * 100}% - 5.5rem), calc(100% - 11rem))` }}
        >
          <p className="mb-1 font-semibold text-ink">{pairs[hover].fullLabel}</p>
          <p className="flex justify-between text-muted">
            {aName} <span className="font-semibold tabular-nums text-ink">{formatNumber(pairs[hover].a)} {unitOf?.(pairs[hover])}</span>
          </p>
          <p className="flex justify-between text-muted">
            {bName} <span className="font-semibold tabular-nums text-ink">{formatNumber(pairs[hover].b)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
