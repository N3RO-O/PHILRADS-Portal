import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { prefersReducedMotion, wait } from '../../lib/motion';

/** How long a row takes to slide out and close its gap (matches .leave-row in index.css). */
export const LEAVE_MS = 780;

/**
 * Rows on their way out. `leave(keys, work, gone)` slides the rows away while `work` (the delete)
 * runs, then calls `gone` to take them out of the list once their space has closed, so nothing
 * below jumps. If `work` fails the rows slide back and the error is passed on.
 */
export function useLeaving<K = string>() {
  const [leaving, setLeaving] = useState<ReadonlySet<K>>(new Set());
  const busy = useRef(new Set<K>());
  const leave = useCallback(async <T,>(keys: K[], work: () => Promise<T>, gone: (result: T) => void): Promise<T> => {
    const mark = (on: boolean) => {
      for (const k of keys) {
        if (on) busy.current.add(k);
        else busy.current.delete(k);
      }
      setLeaving(new Set(busy.current));
    };
    mark(true);
    try {
      const [result] = await Promise.all([work(), wait(LEAVE_MS)]);
      gone(result);
      return result;
    } finally {
      mark(false);
    }
  }, []);
  return { leaving, leave };
}

/** Where an element sits inside `box`, ignoring transforms (so a running animation doesn't skew it). */
const offsetIn = (el: HTMLElement, box: HTMLElement) => {
  const page = (n: HTMLElement | null) => {
    let x = 0;
    let y = 0;
    for (; n; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    return { x, y };
  };
  const a = page(el);
  const b = page(box);
  return { x: a.x - b.x, y: a.y - b.y };
};

/**
 * After rows leave, everything marked `data-flip` inside `box` glides from where it was to its new
 * place instead of jumping (in grids, the cards behind a deleted one move up to fill the gap).
 * `keys` changes whenever the rows do: e.g. their ids joined.
 */
export function useFlip(box: RefObject<HTMLElement>, keys: string) {
  const last = useRef(new Map<string, { x: number; y: number }>());
  const measure = useCallback((animate: boolean) => {
    const el = box.current;
    if (!el) return;
    const next = new Map<string, { x: number; y: number }>();
    const glide = animate && !prefersReducedMotion();
    for (const item of el.querySelectorAll<HTMLElement>('[data-flip]')) {
      const key = item.dataset.flip!;
      const pos = offsetIn(item, el);
      const was = last.current.get(key);
      if (glide && was && (was.x !== pos.x || was.y !== pos.y)) {
        item.animate([{ translate: `${was.x - pos.x}px ${was.y - pos.y}px` }, { translate: '0 0' }], { duration: 560, easing: 'cubic-bezier(0.45, 0, 0.15, 1)' });
      }
      next.set(key, pos);
    }
    last.current = next;
  }, [box]);

  useLayoutEffect(() => measure(true), [keys, measure]);
  // A resize moves things too, but that isn't a change to glide: just remember the new places.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(el);
    return () => ro.disconnect();
    // keys: the list may only just have appeared.
  }, [box, measure, keys]);
}

interface Props {
  leaving: boolean;
  /** Key for useFlip. */
  flip?: string;
  /** The list's gap, so it closes too: e.g. "0.5rem" for gap-2. */
  gap?: string;
  /** Already moved away (a swipe): only close the space. */
  slide?: boolean;
  as?: 'div' | 'li';
  className?: string;
  children: ReactNode;
}

/** A list row that slides off to the left, then lets the rows below glide up into its place. */
export function LeavingRow({ leaving, flip, gap, slide = true, as: Tag = 'div', className = '', children }: Props) {
  return (
    <Tag
      data-flip={flip}
      className={`leave-row ${leaving ? `is-leaving ${slide ? '' : 'no-slide'}` : ''} ${className}`}
      style={gap ? ({ '--leave-gap': gap } as CSSProperties) : undefined}
      aria-hidden={leaving || undefined}
    >
      <div className="leave-row-inner">{children}</div>
    </Tag>
  );
}
