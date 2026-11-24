import { useId } from 'react';

/**
 * PRISM, the PHILRADS staff system (Response, Inventory and Staff Management).
 *
 * The mark (PHILRADS, 24 Nov 2026): an arched church window, its glass divided by the cross. A prism
 * turns light into colour; so does stained glass. The four panes run from gold at the top, where the
 * light comes in, through amber and red to the deepest pane at the foot. The cross is the window's
 * leading: it is left open, so it always shows the surface behind the mark.
 *
 * tone "theme": the deep pane follows the light/dark theme (--prism-deep in index.css).
 * tone "brand": for maroon backgrounds (sign-in glass, app icon), with a cream deep pane.
 */
type Tone = 'theme' | 'brand';

/** The arch: straight sides from the sill (y 94) to the spring line (y 42), then a round head. */
export const WINDOW_ARCH = 'M18 94V42A32 32 0 0 1 82 42V94Z';

/** The four panes, with the cross between them (7 wide; the crossbar at the spring line, so the cross has a long foot). */
export const WINDOW_PANES = [
  { x: 18, y: 8, w: 28.5, h: 30 },
  { x: 53.5, y: 8, w: 28.5, h: 30 },
  { x: 18, y: 45, w: 28.5, h: 49 },
  { x: 53.5, y: 45, w: 28.5, h: 49 },
] as const;

const TONES: Record<Tone, [string, string, string, string]> = {
  theme: ['#f5b82e', '#ef7d1a', '#d9262c', 'var(--prism-deep)'],
  brand: ['#f7c948', '#f08a24', '#e5262b', '#fbf2f2'],
};

export function PrismMark({ className = 'h-9 w-9', tone = 'theme', title }: { className?: string; tone?: Tone; title?: string }) {
  const id = `pw${useId().replace(/:/g, '')}`;
  const fill = TONES[tone];
  return (
    <svg viewBox="0 0 100 100" className={`shrink-0 ${className}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <clipPath id={id}>
          <path d={WINDOW_ARCH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {WINDOW_PANES.map((p, i) => (
          <rect key={i} className="pm-pane" x={p.x} y={p.y} width={p.w} height={p.h} fill={fill[i]} />
        ))}
      </g>
    </svg>
  );
}

/** "PRISM" with its P in PHILRADS red (PHILRADS, 7 Nov 2026). Styles: .prism-p in index.css. */
export function PrismWord({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      <span className="prism-p">P</span>RISM
    </span>
  );
}

/** The mark with the PRISM wordmark and "by PHILRADS" (side menu, phone menu). */
export function PrismLogo({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <PrismMark className={compact ? 'h-8 w-8' : 'h-9 w-9'} />
      <span className="flex min-w-0 flex-col leading-tight">
        <PrismWord className="font-display text-base tracking-[0.06em] text-ink" />
        {!compact && <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.2em] text-muted">by PHILRADS</span>}
      </span>
    </span>
  );
}
