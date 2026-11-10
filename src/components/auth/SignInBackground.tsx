import { useEffect, useRef } from 'react';
import './signInBackground.css';

/**
 * Behind the sign-in card: the PHILRADS relief-work collage in deep red
 * (public/brand/sign-in-red-*.webp), brought to life with a few effects that stay smooth on phones
 * (signInBackground.css). Every moving layer only changes transform or opacity, so the graphics
 * chip moves ready-made pictures and nothing is redrawn while it plays:
 * - the picture drifts and breathes slowly, and on a computer it leans a little toward the mouse;
 * - a warm glow breathes and, now and then, a soft band of light passes;
 * - super-fine grain, like sand, glides over it all;
 * - a vignette keeps the card easy to read.
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
            src="/brand/sign-in-red-1280.webp"
            srcSet="/brand/sign-in-red-1280.webp 1280w, /brand/sign-in-red-1920.webp 1920w"
            // Phones get the lighter file: under the grain the extra detail wouldn't show.
            sizes="(max-width: 767px) 640px, max(114vw, 203vh)"
            alt=""
            className="sib-photo"
            decoding="async"
          />
        </div>
      </div>
      <div className="sib-glow" />
      <div className="sib-sweep" />
      <div className="sib-grain" />
      <div className="sib-vignette" />
    </div>
  );
}
