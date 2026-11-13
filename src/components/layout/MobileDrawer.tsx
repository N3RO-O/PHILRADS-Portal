import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { PrismLogo } from '../ui/PrismMark';
import { NavItems } from './NavItems';
import { AccountPanel, useAccountSheets } from './ProfileMenu';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Mobile and tablet navigation drawer, built on <dialog> for focus trapping and Escape-to-close. */
export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const { onInstall, onUnlock, sheets } = useAccountSheets();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // The page behind stays still while the drawer is open (no scrolling it through the backdrop).
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const before = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
    html.style.scrollbarGutter = 'stable';
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = before.overflow;
      html.style.scrollbarGutter = before.gutter;
    };
  }, [open]);

  return (
    <>
      <dialog
        ref={ref}
        aria-label="Navigation"
        onClose={onClose}
        onClick={(e) => e.target === ref.current && onClose()}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(17rem,86vw)] max-w-none animate-slide-in-left border-r border-line bg-page p-0 text-ink backdrop:animate-fade-in backdrop:bg-black/60"
      >
        <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
          <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-5">
            <PrismLogo />
            <button type="button" onClick={onClose} aria-label="Close navigation" className="icon-btn">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {/* You, at the top: tap to open your account and settings. Folded again each time the drawer opens. */}
          <div className="mx-3 shrink-0 rounded-2xl border border-line/70 bg-ink/[0.03] p-2">
            {open && <AccountPanel collapsible onClose={onClose} onInstall={onInstall} onUnlock={onUnlock} />}
          </div>
          <nav aria-label="Modules" className="relative flex flex-col px-3 py-3">
            <NavItems expanded onNavigate={onClose} />
          </nav>
        </div>
      </dialog>
      {sheets}
    </>
  );
}
