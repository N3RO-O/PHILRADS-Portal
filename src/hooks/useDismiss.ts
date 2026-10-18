import { useEffect, type RefObject } from 'react';

/** Close a popover on outside click or Escape. Returns focus to `returnFocus` on Escape. */
export function useDismiss(
  open: boolean,
  containerRef: RefObject<HTMLElement>,
  onClose: () => void,
  returnFocus?: RefObject<HTMLElement>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        returnFocus?.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, containerRef, onClose, returnFocus]);
}
