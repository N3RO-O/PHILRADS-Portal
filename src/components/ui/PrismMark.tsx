/**
 * PRISM, the PHILRADS staff system (Response, Inventory and Staff Management).
 * The mark: one beam goes into a prism and leaves as three colours.
 *
 * tone "theme": the outline follows the text colour and the three rays follow the light/dark theme
 *   (--prism-1..3 in index.css). tone "brand": for burgundy backgrounds (sign-in card, app icon).
 */
type Tone = 'theme' | 'brand';

const RAYS: Record<Tone, [string, string, string]> = {
  theme: ['rgb(var(--prism-1))', 'rgb(var(--prism-2))', 'rgb(var(--prism-3))'],
  brand: ['#ec952a', '#f6cf7e', '#fbf2f2'],
};

export function PrismMark({ className = 'h-9 w-9', tone = 'theme', title }: { className?: string; tone?: Tone; title?: string }) {
  const [r1, r2, r3] = RAYS[tone];
  const outline = tone === 'brand' ? '#fbf2f2' : 'currentColor';
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 ${className}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g transform="translate(0 4)" fill="none" strokeLinecap="round" style={{ stroke: outline }}>
        <path d="M28 9 L48 47 H8 Z" strokeWidth={4} strokeLinejoin="round" />
        <path d="M2 34 L17 30" strokeWidth={3.5} />
        <path d="M17 30 L38 28" strokeWidth={2.5} strokeOpacity={0.45} />
        <path d="M39 28 L61 17" strokeWidth={4} style={{ stroke: r1 }} />
        <path d="M39 28 L62 27" strokeWidth={4} style={{ stroke: r2 }} />
        <path d="M39 28 L61 37" strokeWidth={4} style={{ stroke: r3 }} />
      </g>
    </svg>
  );
}

/** The mark with the PRISM wordmark and "by PHILRADS" (side menu, phone menu). */
export function PrismLogo({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <PrismMark className={compact ? 'h-8 w-8' : 'h-9 w-9'} />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-display text-base tracking-[0.06em] text-ink">PRISM</span>
        {!compact && <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.2em] text-muted">by PHILRADS</span>}
      </span>
    </span>
  );
}
