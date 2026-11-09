import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * A button's label that turns into a spinner while it works (docs/design-system.md, Buttons).
 * The label stays in place, hidden, so the button keeps its width; the spinner sits over it, and
 * screen readers hear `busyText` instead. Put `aria-busy` on the button too.
 */
export function BusyLabel({ busy, busyText, children }: { busy: boolean; busyText: string; children: ReactNode }) {
  return (
    <span className="relative inline-grid place-items-center">
      <span className={`col-start-1 row-start-1 inline-flex items-center gap-2 ${busy ? 'invisible' : ''}`} aria-hidden={busy || undefined}>
        {children}
      </span>
      {busy && (
        <>
          <Loader2 className="col-start-1 row-start-1 h-5 w-5 animate-spin" aria-hidden />
          <span className="sr-only">{busyText}</span>
        </>
      )}
    </span>
  );
}
