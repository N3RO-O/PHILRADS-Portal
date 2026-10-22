import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Pinned to the bottom (primary actions stay within thumb reach). */
  footer?: ReactNode;
}

/**
 * Bottom sheet on phones, side drawer from md up. Built on <dialog> so focus is trapped,
 * Escape closes it and the page behind is inert.
 */
export function Sheet({ open, title, subtitle, onClose, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // The browser focuses the first control (the close button); prefer the field marked data-autofocus.
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-x-0 bottom-0 top-auto m-0 flex max-h-[92dvh] w-full max-w-none animate-sheet-up flex-col rounded-t-3xl border border-line bg-surface-raised p-0 text-ink shadow-2xl shadow-black/60 backdrop:animate-fade-in backdrop:bg-black/60 open:flex md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[32rem] md:animate-sheet-left md:rounded-none md:rounded-l-3xl [&:not([open])]:hidden"
    >
      <span className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/15 md:hidden" aria-hidden />
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line/70 px-5 pb-4 pt-3 md:pt-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold leading-tight">
            {title}
          </h2>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        <button type="button" className="icon-btn -mr-2 -mt-1" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      {footer && (
        <footer className="shrink-0 border-t border-line/70 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">{footer}</footer>
      )}
    </dialog>
  );
}
