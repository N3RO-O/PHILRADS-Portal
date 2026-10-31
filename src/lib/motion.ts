/** Motion helpers for animations started from code (CSS handles the rest). */

export const prefersReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A short sideways shake, like a head saying "no": for a wrong password, before the message is read. */
export function shake(el: HTMLElement | null) {
  if (!el || prefersReducedMotion()) return;
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-11px)' },
      { transform: 'translateX(9px)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(-2px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 480, easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)' },
  );
}
