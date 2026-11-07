import { useId } from 'react';

/**
 * PRISM, the PHILRADS staff system (Response, Inventory and Staff Management).
 *
 * The mark (PHILRADS, 7 Nov 2026): the triangle is the prism. A beam of white light enters its left
 * face and leaves the right face as a spectrum (red, amber, gold) that fans out and fades: one
 * system taking in everything and making it clear. Inside sits the P of PRISM in PHILRADS maroon,
 * cut from Archivo Black, the wordmark's own typeface. The glass has a faint tint and the light
 * crosses it, so the prism reads as an object, not just an outline.
 *
 * tone "theme": the prism follows the text colour; the P and the spectrum follow the light/dark
 *   theme (.prism-p and --prism-1..3 in index.css). tone "brand": for maroon backgrounds (sign-in
 *   glass, app icon), with a brighter red P and white light.
 */
type Tone = 'theme' | 'brand';

/** The P of Archivo Black (font units, 688 cap height). */
const P_GLYPH =
  'M680 462V449Q680 385 652 333Q624 281 574 251.5Q524 222 460 222H295V0H74V688H460Q524 688 574 658.5Q624 629 652 577.5Q680 526 680 462ZM295 383H386Q421 383 438.5 401Q456 419 456 450V458Q456 490 438.5 507.5Q421 525 386 525H295Z';

const TONES: Record<Tone, { p: string; beam: string; spectrum: [string, string, string] }> = {
  theme: {
    p: 'var(--prism-p)',
    beam: 'currentColor',
    spectrum: ['rgb(var(--prism-1))', 'rgb(var(--prism-2))', 'rgb(var(--prism-3))'],
  },
  brand: { p: '#ff6a5c', beam: '#ffffff', spectrum: ['#e5262b', '#f08a24', '#f7c948'] },
};

export function PrismMark({ className = 'h-9 w-9', tone = 'theme', title }: { className?: string; tone?: Tone; title?: string }) {
  const id = useId().replace(/:/g, '');
  const t = TONES[tone];
  const ink = tone === 'brand' ? '#fbf2f2' : 'currentColor';
  return (
    <svg viewBox="0 0 100 100" className={`shrink-0 ${className}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="16" x2="0" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={t.spectrum[0]} />
          <stop offset=".5" stopColor={t.spectrum[1]} />
          <stop offset="1" stopColor={t.spectrum[2]} />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="60" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".55" stopColor="#fff" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill={`url(#${id}f)`} />
        </mask>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="29" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={t.beam} stopOpacity="0" />
          <stop offset="1" stopColor={t.beam} />
        </linearGradient>
        <radialGradient id={`${id}g`}>
          <stop offset="0" stopColor={t.beam} stopOpacity=".9" />
          <stop offset="1" stopColor={t.beam} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* White light in */}
      <path className="pm-beam" d="M0 46.2 L29 38.6 L29.4 42.2 L0 47.4Z" fill={`url(#${id}b)`} />
      <circle className="pm-glint" cx="29" cy="40.4" r="4.2" fill={`url(#${id}g)`} />
      {/* The spectrum out */}
      <path className="pm-fan" d="M60.4 34.6 L104 14 L104 60 L61.4 38Z" fill={`url(#${id}s)`} mask={`url(#${id}m)`} />
      <path d="M28.9 40.4 L60.6 36.3" stroke={t.beam} strokeWidth="1.6" strokeOpacity=".38" />
      {/* The prism */}
      <path d="M46 10 L86 80 H6 Z" fill={ink} fillOpacity=".07" stroke={ink} strokeWidth="6.5" strokeLinejoin="miter" />
      <path d={P_GLYPH} transform="translate(30.66 73) scale(0.0407 -0.0407)" fill={t.p} />
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
