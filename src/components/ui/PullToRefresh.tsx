import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

const RESIST = 0.35; // the content moves 35% of the finger
const TRIGGER = 64; // px the content must move to refresh

/**
 * Pull to refresh on touch screens: at the top of the page, pulling down moves the page a third
 * of the way your finger goes (it resists), with a spinner that turns as you pull. Let go past the
 * mark and the page reloads its data.
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => void; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!('ontouchstart' in window)) return;
    const down = (e: TouchEvent) => {
      // Only from the very top, and not inside a sheet, map or scrolling list.
      const t = e.target as HTMLElement;
      if (window.scrollY > 0 || refreshing || t.closest('dialog, .leaflet-container, [data-no-pull], input, textarea, select')) return;
      start.current = e.touches[0].clientY;
    };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      pullRef.current = Math.min(dy * RESIST, 120);
      setPull(pullRef.current);
    };
    const up = () => {
      if (start.current === null) return;
      start.current = null;
      if (pullRef.current >= TRIGGER) {
        setRefreshing(true);
        setPull(TRIGGER);
        navigator.vibrate?.(15);
        onRefresh();
        setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 900);
      } else setPull(0);
      pullRef.current = 0;
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
    };
  }, [onRefresh, refreshing]);

  const dragging = start.current !== null && !refreshing;
  return (
    <div className="relative">
      <div
        aria-hidden={!refreshing}
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
        style={{ height: pull, opacity: Math.min(1, pull / TRIGGER) }}
      >
        <span className="mt-auto mb-2 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-raised text-ink-soft shadow-lg">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }} aria-hidden />
        </span>
      </div>
      <div style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: dragging ? 'none' : 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}>{children}</div>
      {refreshing && <span className="sr-only" role="status">Refreshing</span>}
    </div>
  );
}
