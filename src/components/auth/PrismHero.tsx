import { useRef, type PointerEvent, type ReactNode } from 'react';
import { PrismMark } from '../ui/PrismMark';

/**
 * The PRISM header on the sign-in and guest pages: frosted maroon glass over the relief-work
 * video, with slow drifting light, a sheen that sweeps across now and then, a shimmer on the
 * wordmark and a glow that follows your finger or pointer. Styles: .prism-glass in index.css.
 * Everything holds still for people who ask for less motion.
 */
export function PrismHero({
  className = '',
  markOnly = false,
  children,
}: {
  className?: string;
  /** Just the triangle with its P (and all its light), without the PRISM / by PHILRADS words: the sign-in page. */
  markOnly?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const follow = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--pg-x', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    el.style.setProperty('--pg-y', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  };

  return (
    <div ref={ref} onPointerMove={follow} onPointerDown={follow} className={`prism-glass flex flex-col items-center gap-3 px-6 py-8 text-center text-cloud ${className}`}>
      <span className="pg-fx pg-orb pg-orb-a" aria-hidden />
      <span className="pg-fx pg-orb pg-orb-b" aria-hidden />
      <span className="pg-fx pg-follow" aria-hidden />
      <span className="pg-fx pg-sheen" aria-hidden />
      <span className="pg-mark animate-fade-up">
        {/* The mark's own story, told across the header: white light shoots in from the left, hits
            the prism and leaves as a red-amber-gold spectrum, inside a slowly turning ring of light. */}
        <span className="pg-rays" aria-hidden />
        <span className="pg-halo" aria-hidden />
        <span className="pg-ring" aria-hidden />
        <span className="pg-beam-in" aria-hidden />
        <span className="pg-beam-out" aria-hidden />
        <PrismMark className={`relative ${markOnly ? 'h-28 w-28' : 'h-24 w-24'}`} tone="brand" />
      </span>
      {markOnly ? (
        // The words still reach screen readers.
        <p className="sr-only">PRISM by PHILRADS</p>
      ) : (
        <div className="animate-fade-up [animation-delay:120ms]">
          <p className="font-display text-3xl tracking-[0.08em]">
            <span className="sr-only">PRISM</span>
            <span aria-hidden className="pg-word">
              <span className="pg-p">P</span>
              {['R', 'I', 'S', 'M'].map((c, i) => (
                <span key={c} className="pg-letter" style={{ animationDelay: `${0.75 + i * 0.08}s` }}>
                  {c}
                </span>
              ))}
            </span>
          </p>
          <p className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-cloud/80">by PHILRADS</p>
        </div>
      )}
      {children}
    </div>
  );
}
