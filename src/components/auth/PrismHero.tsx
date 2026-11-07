import { useRef, type PointerEvent, type ReactNode } from 'react';
import { PrismMark } from '../ui/PrismMark';

/**
 * The PRISM header on the sign-in and guest pages: frosted maroon glass over the relief-work
 * video, with slow drifting light, a sheen that sweeps across now and then, a shimmer on the
 * wordmark and a glow that follows your finger or pointer. Styles: .prism-glass in index.css.
 * Everything holds still for people who ask for less motion.
 */
export function PrismHero({ className = '', children }: { className?: string; children?: ReactNode }) {
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
        <span className="pg-halo" aria-hidden />
        <PrismMark className="relative h-16 w-16" tone="brand" />
      </span>
      <div className="animate-fade-up [animation-delay:120ms]">
        <p className="pg-word font-display text-3xl tracking-[0.08em]">PRISM</p>
        <p className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-cloud/80">by PHILRADS</p>
      </div>
      {children}
    </div>
  );
}
