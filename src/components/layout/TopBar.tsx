import { useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOnboarding } from '../onboarding/OnboardingProvider';
import { PrismMark, PrismWord } from '../ui/PrismMark';
import { ActiveFaces } from './ActiveFaces';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsMenu } from './NotificationsMenu';
import { ProfileMenu } from './ProfileMenu';

interface TopBarProps {
  search: string;
  onSearch: (value: string) => void;
  menuOpen: boolean;
  onOpenMenu: () => void;
  /** Pages with their own sticky search (Inventory) hide the phone search row to save vertical space. */
  hideMobileSearch?: boolean;
  /** The Active list (who's on) is showing. */
  activeShown?: boolean;
  onToggleActive?: () => void;
}

const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const SHORTCUT_LABEL = isApple ? '⌘K' : 'Ctrl K';

export function TopBar({ search, onSearch, menuOpen, onOpenMenu, hideMobileSearch = false, activeShown = false, onToggleActive }: TopBarProps) {
  const desktopInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);

  // Ctrl+K / ⌘K (or "Try it" in Get started) focuses whichever search box is visible at this screen size.
  useEffect(() => {
    const focus = () => {
      const target = [desktopInput.current, mobileInput.current].find((el) => el && el.offsetParent !== null);
      if (!target) return false;
      target.focus();
      target.select();
      return true;
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return;
      if (focus()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('philrads:search', focus);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('philrads:search', focus);
    };
  }, []);
  // Get started: searching once ticks "Search anything".
  const { complete } = useOnboarding();
  useEffect(() => {
    if (search.trim().length >= 2) complete('search');
  }, [search, complete]);

  return (
    <header className="sticky top-0 z-30 border-b border-ink/[0.05] bg-page">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button type="button" className="icon-btn lg:hidden" onClick={onOpenMenu} aria-label="Open navigation" aria-expanded={menuOpen}>
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="PRISM home">
          <PrismMark className="h-8 w-8 text-ink" />
          <PrismWord className="hidden font-display text-sm tracking-[0.06em] min-[380px]:inline" />
        </Link>
        <GlobalSearch value={search} onChange={onSearch} inputRef={desktopInput} shortcut={SHORTCUT_LABEL} className="hidden w-full max-w-md md:block" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {onToggleActive && <ActiveFaces shown={activeShown} onToggle={onToggleActive} />}
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
