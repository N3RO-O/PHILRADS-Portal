import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Accessible modal built on the native <dialog> element (focus trap and Escape handled by the browser). */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="glass-popover w-[min(28rem,calc(100vw-2rem))] animate-pop-in rounded-[1.75rem] bg-white/90 p-0 text-charcoal backdrop:animate-fade-in backdrop:bg-charcoal/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-lg leading-tight">
            {title}
          </h2>
          <button type="button" className="icon-btn h-9 w-9" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
