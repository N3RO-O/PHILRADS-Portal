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
      className="gloss-burgundy fixed inset-y-0 left-0 m-0 h-dvh animate-slide-in-left backdrop:animate-fade-in max-h-none w-[min(18rem,86vw)] max-w-none rounded-r-[2rem] p-0 text-white backdrop:bg-charcoal/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex h-full flex-col gap-3 overflow-y-auto px-3 py-4">
        <div className="flex items-center justify-between gap-3 px-1 pb-1">
          <span className="flex items-center gap-3">
            <Emblem className="h-10 w-10" decorative />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-lg tracking-wide">PHILRADS</span>
              <span className="text-[0.6875rem] uppercase tracking-[0.16em] text-white/70">Staff Portal</span>
            </span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close navigation" className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-white/20 hover:bg-white/10">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav aria-label="Modules" className="flex flex-col gap-2">
          <NavItems expanded onNavigate={onClose} />
        </nav>
      </div>
    </dialog>
  );
}
