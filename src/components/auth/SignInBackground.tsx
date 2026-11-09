import { useEffect, useRef, type CSSProperties } from 'react';
import './signInBackground.css';

/**
 * The collage's grid: six columns, five rows. public/brand/sign-in-grain-*.webp is "PHILRADS Background.png"
 * from the calling-card folder, brightened and evened out (the dark left side lifted), grain kept.
 */
const COLS = 6;
const ROWS = 5;

// A fixed shuffle, so the photos light up in a scattered order (the same on every visit).
const ORDER = [17, 3, 25, 9, 28, 14, 0, 21, 6, 12, 27, 2, 19, 8, 23, 15, 5, 29, 11, 1, 24, 18, 7, 26, 13, 4, 20, 10, 22, 16];
const CELL_CYCLE = 30; // seconds for every photo to have had its moment

// Specks of warm dust that hover and float up through the picture.
const SPECKS = Array.from({ length: 26 }, (_, i) => {
  const r = (n: number) => (Math.sin((i + 1) * n) + 1) / 2; // steady pseudo-random 0..1
  return {
    left: `${Math.round(r(12.9898) * 100)}%`,
    top: `${Math.round(30 + r(78.233) * 75)}%`,
    size: `${(1.5 + r(39.425) * 3).toFixed(1)}px`,
    dur: `${(14 + r(4.17) * 16).toFixed(1)}s`,
    delay: `${(-r(9.31) * 30).toFixed(1)}s`,
    drift: `${Math.round((r(3.7) - 0.5) * 120)}px`,
  };
});

/**
 * Behind the sign-in card: the grainy PHILRADS relief-work collage, brought to life with CSS
 * (signInBackground.css), light enough for phones:
 * - the picture drifts and breathes slowly, and on a computer it leans a little toward the mouse;
 * - one photo at a time softly lights up, in a scattered order;
 * - grain hovers over everything and warm specks of dust float up through it;
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
            src="/brand/sign-in-grain-1440.webp"
            srcSet="/brand/sign-in-grain-1440.webp 1440w, /brand/sign-in-grain-2400.webp 2400w"
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
      <div className="sib-grain sib-grain-fine" />
      <div className="sib-specks">
        {SPECKS.map((s, i) => (
          <span key={i} style={{ left: s.left, top: s.top, width: s.size, height: s.size, '--dur': s.dur, '--delay': s.delay, '--drift': s.drift } as CSSProperties} />
        ))}
      </div>
      <div className="sib-mouse" />
      <div className="sib-vignette" />
    </div>
  );
}
