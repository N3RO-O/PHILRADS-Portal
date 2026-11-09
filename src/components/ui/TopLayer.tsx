import { Children, useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * A live region for toasts that sits in the browser's top layer, above open sheets.
 *
 * Sheets open with showModal(), which puts them in the top layer; anything else, however high its
 * z-index, is drawn underneath them. A "Kudos sent" toast fired while a sheet was open ended up
 * hidden behind it, with only its edge poking out. This container opens itself as a manual popover
 * whenever it has something to show, so it is stacked above whatever was opened before it, and it
 * re-raises itself each time the message changes. Browsers without popovers keep the old
 * fixed-position behaviour.
 */
export function TopLayer({ className = '', children, raiseKey }: { className?: string; children?: ReactNode; raiseKey?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const showing = Children.toArray(children).length > 0;

  useLayoutEffect(() => {
    const el = ref.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el || typeof el.showPopover !== 'function') return;
    if (!el.hasAttribute('popover')) el.setAttribute('popover', 'manual');
    try {
      if (el.matches(':popover-open')) el.hidePopover?.();
      if (showing) el.showPopover();
    } catch {
      /* Not connected yet, or popovers unsupported: the fixed position still applies. */
    }
  }, [showing, raiseKey]);

  return (
    <div ref={ref} aria-live="polite" className={`top-layer ${className}`}>
      {children}
    </div>
  );
}
