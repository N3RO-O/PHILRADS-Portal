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
}

function SearchBox({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`flex h-11 items-center gap-2 rounded-full bg-white px-4 text-muted ring-1 ring-black/[0.06] focus-within:ring-2 focus-within:ring-burgundy ${className}`}>
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">Search tasks and activity</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tasks and activity"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-sm text-charcoal placeholder:text-muted/80 focus:outline-none"
      />
    </label>
  );
}

export function TopBar({ search, onSearch, menuOpen, onOpenMenu }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-cloud/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button type="button" className="icon-btn lg:hidden" onClick={onOpenMenu} aria-label="Open navigation" aria-expanded={menuOpen}>
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="PHILRADS Staff Portal home">
          <Emblem className="h-9 w-9" decorative />
          <span className="hidden font-display text-base tracking-wide min-[380px]:inline">PHILRADS</span>
        </Link>
        <SearchBox value={search} onChange={onSearch} className="mx-auto hidden w-full max-w-md md:flex" />
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <OnlinePill className="hidden sm:inline-flex" />
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>
      <div className="px-4 pb-3 sm:px-6 md:hidden">
        <SearchBox value={search} onChange={onSearch} />
      </div>
    </header>
  );
}
