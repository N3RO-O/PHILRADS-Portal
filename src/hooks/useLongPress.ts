import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

/**
 * Press and hold with a finger (or pen) to do something else than a tap: here, start selecting
 * files. A mouse never long-presses (Shift- and Ctrl-click do that job). Moving the finger (a
 * scroll) cancels it, and the click that follows the hold is swallowed so it doesn't also open or
 * toggle the item. Pass `undefined` to turn it off; the returned handlers are then empty.
 */
export function useLongPress(onLongPress: (() => void) | undefined, ms = 450) {
  const timer = useRef<number>();
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const latest = useRef(onLongPress);
  latest.current = onLongPress;
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!onLongPress) return {};
  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  const fire = () => {
    cancel();
    fired.current = true;
    // A short buzz to confirm (browsers allow it only after the person has tapped the page).
    if (navigator.userActivation?.hasBeenActive ?? true) navigator.vibrate?.(12);
    latest.current?.();
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false;
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      start.current = { x: e.clientX, y: e.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(fire, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // Some phones open their own menu on a hold before the timer ends: take it as the long press.
    onContextMenu: (e: MouseEvent) => {
      if (!start.current && !fired.current) return;
      e.preventDefault();
      if (start.current) fire();
    },
    onClickCapture: (e: MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}

/** Classes for something you can long-press: no text selection or iOS callout while holding. */
export const HOLDABLE = 'select-none [-webkit-touch-callout:none]';
