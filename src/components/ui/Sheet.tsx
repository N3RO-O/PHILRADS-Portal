import { useEffect, useId, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Pinned to the bottom (primary actions stay within thumb reach). */
  footer?: ReactNode;
  /** The form has unsaved input: a click on the backdrop then doesn't close the sheet (Escape and × still do). */
  dirty?: boolean;
}

/**
 * Bottom sheet on phones, side drawer from md up. Built on <dialog> so focus is trapped,
 * Escape closes it and the page behind is inert.
 */
export function Sheet({ open, title, subtitle, onClose, children, footer, dirty = false }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const backdrop = useBackdropClose(ref, onClose, dirty);

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
      {...backdrop.handlers}
      className={`fixed inset-x-0 bottom-0 top-auto m-0 flex max-h-[92dvh] w-full max-w-none animate-sheet-up flex-col rounded-t-3xl glass p-0 text-ink ring-uplift/60 transition-shadow backdrop:animate-fade-in backdrop:bg-black/60 open:flex md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[32rem] md:animate-sheet-left md:rounded-none md:rounded-l-3xl [&:not([open])]:hidden ${
        backdrop.nudge ? 'ring-2' : ''
      }`}
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

/**
 * Close a modal <dialog> on a backdrop click, but only when the press both started and ended on the
 * backdrop: selecting text in a field and letting go outside the panel must not close it. While the
 * form is dirty, a backdrop click only flashes the panel's outline instead of closing.
 */
export function useBackdropClose(ref: RefObject<HTMLDialogElement>, onClose: () => void, dirty = false) {
  const pressedOnBackdrop = useRef(false);
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => setNudge(false), 450);
    return () => clearTimeout(t);
  }, [nudge]);
  return {
    nudge,
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLDialogElement>) => {
        pressedOnBackdrop.current = e.target === ref.current;
      },
      onClick: (e: MouseEvent<HTMLDialogElement>) => {
        const onBackdrop = pressedOnBackdrop.current && e.target === ref.current;
        pressedOnBackdrop.current = false;
        if (!onBackdrop) return;
        if (dirty) setNudge(true);
        else onClose();
      },
    },
  };
}
