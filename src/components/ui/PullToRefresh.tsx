import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

const TRIGGER = 64; // px the content must move to refresh
const LIMIT = 150; // the content can never move further than this

/**
 * Rubber band: the first centimetre follows the finger closely, then every extra pixel moves it
 * less, so the pull resists harder the further you go and never passes LIMIT.
 */
function resist(dy: number) {
  return LIMIT * (1 - 1 / ((dy * 0.6) / LIMIT + 1));
}

/**
 * Pull to refresh on touch screens: at the top of the page, pulling down stretches the page like
 * a rubber band (it resists more the further you pull), with a spinner that turns as you pull.
 * Past the mark the spinner turns yellow and you feel one tick: let go and the page reloads its data.
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => void; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const armed = pull >= TRIGGER;
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
      const next = resist(dy);
      if (next >= TRIGGER && pullRef.current < TRIGGER) navigator.vibrate?.(8);
      pullRef.current = next;
      setPull(next);
    };
    const up = () => {
      if (start.current === null) return;
      start.current = null;
      if (pullRef.current >= TRIGGER) {
        setRefreshing(true);
        setPull(TRIGGER);
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
        <span
          className={`mb-2 mt-auto grid h-9 w-9 place-items-center rounded-full border bg-surface-raised shadow-lg transition-colors duration-150 ${armed || refreshing ? 'border-uplift/60 text-uplift' : 'border-line text-ink-soft'}`}
          style={{ transform: `scale(${refreshing ? 1 : 0.7 + 0.3 * Math.min(1, pull / TRIGGER)})` }}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }} aria-hidden />
        </span>
      </div>
      <div style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: dragging ? 'none' : 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}>{children}</div>
      <span className="sr-only" role="status">
        {refreshing ? 'Refreshing' : armed ? 'Release to refresh' : ''}
      </span>
    </div>
  );
}
