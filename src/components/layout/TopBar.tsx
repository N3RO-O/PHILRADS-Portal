import { useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Emblem } from '../ui/Emblem';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsMenu } from './NotificationsMenu';
import { OnlinePill } from './OnlineStatus';
import { ProfileMenu } from './ProfileMenu';

interface TopBarProps {
  search: string;
  onSearch: (value: string) => void;
  menuOpen: boolean;
  onOpenMenu: () => void;
  /** Pages with their own sticky search (Inventory) hide the phone search row to save vertical space. */
  hideMobileSearch?: boolean;
}

const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const SHORTCUT_LABEL = isApple ? '⌘K' : 'Ctrl K';

export function TopBar({ search, onSearch, menuOpen, onOpenMenu, hideMobileSearch = false }: TopBarProps) {
  const desktopInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);

  // Ctrl+K / ⌘K focuses whichever search box is visible at this screen size.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return;
      const target = [desktopInput.current, mobileInput.current].find((el) => el && el.offsetParent !== null);
      if (!target) return;
      e.preventDefault();
      target.focus();
      target.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-page/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button type="button" className="icon-btn lg:hidden" onClick={onOpenMenu} aria-label="Open navigation" aria-expanded={menuOpen}>
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="PHILRADS Staff Portal home">
          <Emblem className="h-8 w-8" decorative />
          <span className="hidden font-display text-sm tracking-wide min-[380px]:inline">PHILRADS</span>
        </Link>
        <GlobalSearch value={search} onChange={onSearch} inputRef={desktopInput} shortcut={SHORTCUT_LABEL} className="hidden w-full max-w-md md:block" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <OnlinePill className="hidden sm:inline-flex" />
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>
      <div className={`px-4 pb-3 sm:px-6 md:hidden ${hideMobileSearch ? 'hidden' : ''}`}>
        <GlobalSearch value={search} onChange={onSearch} inputRef={mobileInput} />
      </div>
    </header>
  );
}
