import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Archive } from 'lucide-react';

interface Props {
  enabled: boolean;
  onArchive: () => void;
  className?: string;
  children: ReactNode;
}

/** How far (share of the row's width, or pixels) a swipe must travel to archive. */
const THRESHOLD_SHARE = 0.35;
const THRESHOLD_PX = 140;

/**
 * Swipe right to archive (touch or mouse drag). The row slides to reveal "Archive"; let go past
 * the threshold and it slides away, otherwise it springs back. Vertical scrolling still works,
 * and drags that start on a control (select, button, link) are left to that control.
 * Not the only way to archive: pages also offer a button for keyboard and screen-reader users.
 */
export function SwipeToArchive({ enabled, onArchive, className = '', children }: Props) {
  const row = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; id: number; locked: boolean } | null>(null);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const threshold = () => Math.min(THRESHOLD_PX, (row.current?.offsetWidth ?? 400) * THRESHOLD_SHARE);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || leaving || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('select, button, a, input, textarea, label')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, locked: false };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const x = e.clientX - s.x;
    const y = e.clientY - s.y;
    if (!s.locked) {
      // Decide once whether this is a sideways swipe or a scroll.
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
      if (Math.abs(y) > Math.abs(x) || x < 0) {
        start.current = null;
        return;
      }
      s.locked = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone: the drag still works while it stays over the row */
      }
    }
    setDx(Math.max(0, x));
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s?.locked) return;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (dx >= threshold()) {
      setLeaving(true);
      setDx(row.current?.offsetWidth ?? 600);
      setTimeout(onArchive, 180);
    } else {
      setDx(0);
    }
  };

  const progress = Math.min(1, dx / threshold());
  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      {enabled && (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center gap-2 rounded-xl bg-burgundy-600 px-5 text-sm font-semibold text-white"
          style={{ opacity: dx ? 0.35 + progress * 0.65 : 0 }}
        >
          <Archive className="h-5 w-5" style={{ transform: `scale(${0.8 + progress * 0.3})` }} />
          {progress >= 1 ? 'Release to archive' : 'Archive'}
        </div>
      )}
      <div
        ref={row}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => ((start.current = null), setDragging(false), setDx(0))}
        className={`relative ${enabled ? 'touch-pan-y select-none' : ''} ${dragging ? '' : 'transition-transform duration-200 ease-out'}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
