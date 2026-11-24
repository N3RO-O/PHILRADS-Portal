/**
 * Opening and closing a modal <dialog> with motion. Opening plays the element's own entrance
 * animation (its animate-* class); closing marks it `data-closing`, which plays the matching exit in
 * index.css (.motion-sheet, .motion-drawer, .motion-pop), then really closes it. Reduced motion, or
 * a browser that never reports the animation's end, closes at once / after a short wait.
 */
const pending = new WeakMap<HTMLDialogElement, () => void>();

/** The longest exit (index.css); closing never waits longer than this. */
const EXIT_MS = 240;

export function openDialog(el: HTMLDialogElement) {
  // Opened again mid-exit: stay open.
  pending.get(el)?.();
  if (!el.open) el.showModal();
}

export function closeDialog(el: HTMLDialogElement) {
  if (!el.open || pending.has(el)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return el.close();
  el.dataset.closing = '';
  const stop = () => {
    el.removeEventListener('animationend', onEnd);
    clearTimeout(timer);
    delete el.dataset.closing;
    pending.delete(el);
  };
  const finish = () => {
    stop();
    if (el.open) el.close();
  };
  const onEnd = (e: AnimationEvent) => {
    if (e.target === el) finish();
  };
  const timer = setTimeout(finish, EXIT_MS + 60);
  el.addEventListener('animationend', onEnd);
  pending.set(el, stop);
}
