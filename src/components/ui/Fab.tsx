import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// "!fixed": .premium sets position: relative, which would otherwise win.
const LOOK =
  '!fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full premium pl-4 pr-5 text-sm font-bold text-onaccent shadow-xl shadow-black/50 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 disabled:opacity-60 md:hidden';

/** Tucked away while scrolling down the page (out of the way of what you're reading), back on the way up. */
function useTucked() {
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 12) return;
      setTucked(y > last && y > 120);
      last = y;
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return tucked;
}

/**
 * The page's main action on phones, floating in thumb reach at the bottom right (hidden on wider
 * screens, where the button sits in the page header). A link with `href`, else a button. Drawn at
 * the end of the page body: a moved or animated box around it would otherwise carry it along.
 */
export function Fab({ icon, children, onClick, href, disabled, title }: { icon: ReactNode; children: ReactNode; onClick?: () => void; href?: string; disabled?: boolean; title?: string }) {
  const tucked = useTucked();
  const motion = tucked ? 'pointer-events-none translate-y-24 opacity-0' : '';
  if (href)
    return createPortal(
      <a href={href} target="_blank" rel="noopener noreferrer" className={`${LOOK} ${motion}`} title={title} aria-hidden={tucked || undefined} tabIndex={tucked ? -1 : undefined}>
        {icon} {children}
      </a>,
      document.body,
    );
  return createPortal(
    <button type="button" onClick={onClick} disabled={disabled} className={`${LOOK} ${motion}`} title={title} aria-hidden={tucked || undefined} tabIndex={tucked ? -1 : undefined}>
      {icon} {children}
    </button>,
    document.body,
  );
}
