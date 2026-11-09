import { useEffect, useRef, type CSSProperties } from 'react';
import './signInBackground.css';

/**
 * The collage's grid: six columns, five rows. public/brand/sign-in-final-*.webp is "1.png" from the
 * PHILRADS calling-card folder, gently brightened with its grain kept.
 */
const COLS = 6;
const ROWS = 5;

// A fixed shuffle, so the photos light up in a scattered order (the same on every visit).
const ORDER = [17, 3, 25, 9, 28, 14, 0, 21, 6, 12, 27, 2, 19, 8, 23, 15, 5, 29, 11, 1, 24, 18, 7, 26, 13, 4, 20, 10, 22, 16];
const CELL_CYCLE = 30; // seconds for every photo to have had its moment

/**
 * Behind the sign-in card: the grainy PHILRADS relief-work collage, brought to life with CSS
 * (signInBackground.css), light enough for phones:
 * - the picture drifts and breathes slowly, and on a computer it leans a little toward the mouse;
 * - one photo at a time softly lights up, in a scattered order;
 * - very fine grain drifts smoothly over it, and thin blades of light slice through the grain;
 * - a burgundy-to-amber glow, a passing band of light and a vignette keep the card easy to read.
 * People who ask for less motion get the same picture, standing still.
 */
export function SignInBackground() {
  const root = useRef<HTMLDivElement>(null);

  // Lean toward the pointer (mouse only, and not for reduced motion).
  useEffect(() => {
    const el = root.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  return (
    <div ref={root} aria-hidden className="sib pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="sib-lean">
        <div className="sib-stage">
          <img
            src="/brand/sign-in-final-1440.webp"
            srcSet="/brand/sign-in-final-1440.webp 1440w, /brand/sign-in-final-2400.webp 2400w"
            // Phones get the lighter file: it's grainy on purpose, so the extra detail wouldn't show.
            sizes="(max-width: 767px) 480px, max(114vw, 203vh)"
            alt=""
            className="sib-photo"
            decoding="async"
          />
          <div className="sib-cells">
            {Array.from({ length: COLS * ROWS }, (_, i) => (
              <span key={i} style={{ '--d': `${-((ORDER.indexOf(i) / (COLS * ROWS)) * CELL_CYCLE).toFixed(2)}s` } as CSSProperties} />
            ))}
          </div>
        </div>
      </div>
      <div className="sib-glow" />
      <div className="sib-sweep" />
      <div className="sib-grain" />
      <div className="sib-slice sib-slice-a" />
      <div className="sib-slice sib-slice-b" />
      <div className="sib-blade sib-slice-a" />
      <div className="sib-vignette" />
    </div>
  );
}
