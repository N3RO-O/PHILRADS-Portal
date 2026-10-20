import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Emblem } from '../ui/Emblem';
import { NavItems } from './NavItems';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Mobile and tablet navigation drawer, built on <dialog> for focus trapping and Escape-to-close. */
export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Navigation"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(17rem,86vw)] max-w-none animate-slide-in-left border-r border-line bg-page p-0 text-ink backdrop:animate-fade-in backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-5">
          <span className="flex items-center gap-3">
            <Emblem className="h-9 w-9" decorative />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-base tracking-wide">PHILRADS</span>
              <span className="text-[0.625rem] uppercase tracking-[0.18em] text-muted">Staff Portal</span>
            </span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close navigation" className="icon-btn">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav aria-label="Modules" className="flex flex-col px-3 py-3">
          <NavItems expanded onNavigate={onClose} />
        </nav>
      </div>
    </dialog>
  );
}
