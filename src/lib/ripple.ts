/**
 * A soft ripple from where a premium button (.btn-primary, .premium) is pressed. One listener on
 * the document covers every button; nothing is added for people who prefer reduced motion.
 */
export function installPressRipple() {
  if (typeof document === 'undefined') return;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (still?.matches || e.button !== 0) return;
      const el = (e.target as Element | null)?.closest?.('.btn-primary, .premium') as HTMLElement | null;
      if (!el || (el as HTMLButtonElement).disabled) return;
      const box = el.getBoundingClientRect();
      const size = Math.hypot(box.width, box.height) * 2;
      const dot = document.createElement('span');
      dot.className = 'press-ripple';
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - box.left}px`;
      dot.style.top = `${e.clientY - box.top}px`;
      el.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove(), { once: true });
    },
    { passive: true },
  );
}
