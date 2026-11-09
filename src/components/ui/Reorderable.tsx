import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { GripVertical } from 'lucide-react';

/**
 * A list you can reorder by dragging a row's handle: the row lifts (grows a little and casts a
 * shadow) and follows your finger, and the rows it passes slide aside to make room. Let go and it
 * springs into the gap. Keyboard: the handle's arrow keys.
 */
export function Reorderable<T extends { id: string }>({
  items,
  onReorder,
  render,
  disabled = false,
  className = '',
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  render: (item: T, handle: ReactNode) => ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const list = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ id: string; from: number; to: number; dy: number; h: number } | null>(null);
  // Just dropped: the row starts where the finger left it and springs into its new slot.
  const [settle, setSettle] = useState<{ id: string; offset: number; run: boolean } | null>(null);

  useEffect(() => {
    if (!settle) return;
    if (!settle.run) {
      // Paint once where the finger let go (no transitions), then spring to 0.
      const f = requestAnimationFrame(() => requestAnimationFrame(() => setSettle({ ...settle, offset: 0, run: true })));
      return () => cancelAnimationFrame(f);
    }
    const t = setTimeout(() => setSettle(null), 420);
    return () => clearTimeout(t);
  }, [settle]);

  const start = (e: PointerEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    e.preventDefault();
    const row = (e.currentTarget.closest('li') as HTMLElement) ?? null;
    if (!row) return;
    const h = row.getBoundingClientRect().height + 4; // + the gap
    const y0 = e.clientY;
    const id = items[index].id;
    let to = index;
    let dy = 0;
    setSettle(null);
    setDrag({ id, from: index, to, dy: 0, h });
    navigator.vibrate?.(8);
    const move = (ev: globalThis.PointerEvent) => {
      dy = ev.clientY - y0;
      to = Math.max(0, Math.min(items.length - 1, index + Math.round(dy / h)));
      setDrag({ id, from: index, to, dy, h });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      setSettle({ id, offset: dy - (to - index) * h, run: false });
      if (to !== index) {
        const next = [...items];
        const [it] = next.splice(index, 1);
        next.splice(to, 0, it);
        onReorder(next);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const move = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(index, 1);
    next.splice(to, 0, it);
    onReorder(next);
  };

  // How far each row moves while another is dragged past it.
  const shift = (i: number) => {
    if (!drag || i === drag.from) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.h;
    if (drag.from > drag.to && i < drag.from && i >= drag.to) return drag.h;
    return 0;
  };

  return (
    <ul ref={list} className={`flex flex-col gap-1 ${className}`}>
      {items.map((item, i) => {
        const lifted = drag?.id === item.id;
        const handle = disabled ? null : (
          <button
            type="button"
            className="grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center text-muted hover:text-ink active:cursor-grabbing"
            aria-label="Drag to reorder (or use the arrow keys)"
            onPointerDown={(e) => start(e, i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') (e.preventDefault(), move(i, -1));
              if (e.key === 'ArrowDown') (e.preventDefault(), move(i, 1));
            }}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
        );
        const settling = settle?.id === item.id;
        const raised = lifted || (settling && !settle!.run);
        // Right after a drop nothing animates for one frame, so rows that made room don't jump back.
        const frozen = !!settle && !settle.run;
        return (
          <li
            key={item.id}
            className={lifted || settling ? 'relative z-10' : ''}
            style={{
              translate: `0 ${lifted ? drag!.dy : settling ? settle!.offset : shift(i)}px`,
              scale: raised ? '1.03' : '1',
              transition: frozen
                ? 'none'
                : lifted
                  ? 'scale 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease'
                  : settling
                    ? 'translate 380ms cubic-bezier(0.34, 1.56, 0.64, 1), scale 260ms ease, box-shadow 260ms ease'
                    : 'translate 260ms cubic-bezier(0.22, 1, 0.36, 1)',
              boxShadow: raised ? '0 18px 40px -12px rgba(0,0,0,0.7)' : undefined,
              borderRadius: '0.5rem',
              cursor: lifted ? 'grabbing' : undefined,
            }}
          >
            {render(item, handle)}
          </li>
        );
      })}
    </ul>
  );
}
