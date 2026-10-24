import { useEffect, useRef, type RefObject } from 'react';
import { Menu, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Emblem } from '../ui/Emblem';
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

interface SearchBoxProps {
  value: string;
  onChange: (v: string) => void;
  inputRef: RefObject<HTMLInputElement>;
  showShortcut?: boolean;
  className?: string;
}

function SearchBox({ value, onChange, inputRef, showShortcut = false, className = '' }: SearchBoxProps) {
  return (
    <label
      className={`flex h-11 min-w-0 items-center gap-2 rounded-xl border border-line/70 bg-surface px-4 text-muted transition-colors focus-within:border-uplift ${className}`}
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">Search tasks and activity</span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.currentTarget.blur();
        }}
        placeholder="Search tasks and activity"
        autoComplete="off"
        aria-keyshortcuts="Control+K Meta+K"
        className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
      />
      {showShortcut && (
        <kbd aria-hidden className="shrink-0 rounded-md border border-line bg-surface-raised px-1.5 py-0.5 font-sans text-[0.6875rem] font-semibold text-muted">
          {SHORTCUT_LABEL}
        </kbd>
      )}
    </label>
  );
}

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
        <SearchBox value={search} onChange={onSearch} inputRef={desktopInput} showShortcut className="hidden w-full max-w-md md:flex" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <OnlinePill className="hidden sm:inline-flex" />
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>
      <div className={`px-4 pb-3 sm:px-6 md:hidden ${hideMobileSearch ? 'hidden' : ''}`}>
        <SearchBox value={search} onChange={onSearch} inputRef={mobileInput} />
      </div>
    </header>
  );
}
