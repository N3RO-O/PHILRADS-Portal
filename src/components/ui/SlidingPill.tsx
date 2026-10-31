import { useLayoutEffect, useRef } from 'react';

const ACTIVE = '[aria-pressed="true"], [aria-selected="true"], [aria-current="page"]';

/**
 * A highlight that glides, slowly, from the old choice to the new one in a tab bar, segmented
 * control or navigation, so the eye follows it instead of hunting for what changed. Put it inside
 * the group (which must be `relative`); the options sit above it (`relative z-10`) and carry
 * aria-pressed, aria-selected or aria-current. The pill brings the active background itself.
 */
export function SlidingPill({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const pill = ref.current;
    const group = pill?.parentElement;
    if (!pill || !group) return;
    let placed = false;
    const place = () => {
      const active = group.querySelector<HTMLElement>(ACTIVE);
      if (!active || !active.offsetWidth) {
        pill.style.opacity = '0';
        return;
      }
      const g = group.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      // The first placement lands without moving; later ones glide.
      if (!placed) pill.style.transition = 'none';
      pill.style.width = `${a.width}px`;
      pill.style.height = `${a.height}px`;
      pill.style.translate = `${a.left - g.left + group.scrollLeft - group.clientLeft}px ${a.top - g.top + group.scrollTop - group.clientTop}px`;
      pill.style.opacity = '1';
      if (!placed) {
        void pill.offsetWidth;
        pill.style.transition = '';
        placed = true;
      }
    };
    place();
    const mo = new MutationObserver(place);
    mo.observe(group, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected', 'aria-current'] });
    const ro = new ResizeObserver(place);
    ro.observe(group);
    for (const child of group.children) if (child !== pill) ro.observe(child);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);
  return <span ref={ref} aria-hidden className={`sliding-pill ${className}`} />;
}
