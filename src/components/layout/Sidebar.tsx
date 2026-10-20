import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Emblem } from '../ui/Emblem';
import { NavItems } from './NavItems';

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

const footerButton = 'flex h-10 w-full items-center gap-3 rounded-xl text-sm font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink';

/** Desktop navigation: full-height sidebar that collapses to an icon rail. */
export function Sidebar({ expanded, onToggle }: SidebarProps) {
  const { state, signOut } = useAuth();
  return (
    <aside
      aria-label="Main navigation"
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line/70 bg-page transition-[width] duration-300 lg:flex ${
        expanded ? 'w-64' : 'w-[4.5rem]'
      }`}
    >
      <Link to="/" className={`flex h-16 shrink-0 items-center gap-3 ${expanded ? 'px-5' : 'justify-center'}`} aria-label="PHILRADS Staff Portal home">
        <Emblem className="h-9 w-9" decorative />
        {expanded && (
          <span className="flex min-w-0 animate-fade-in flex-col leading-tight">
            <span className="font-display text-base tracking-wide text-ink">PHILRADS</span>
            <span className="text-[0.625rem] uppercase tracking-[0.18em] text-muted">Staff Portal</span>
          </span>
        )}
      </Link>
      {/* Fits without scrolling on normal screens, so hover labels are never clipped. Very short windows scroll. */}
      <nav aria-label="Modules" className="flex flex-1 flex-col px-3 py-3 [@media(max-height:700px)]:overflow-y-auto">
        <NavItems expanded={expanded} />
      </nav>
      <div className="flex shrink-0 flex-col gap-1 border-t border-line/70 px-3 py-3">
        {state.status === 'signed-in' && (
          <button
            type="button"
            onClick={() => void signOut()}
            className={`${footerButton} ${expanded ? 'px-3' : 'justify-center'}`}
            aria-label={expanded ? undefined : 'Sign out'}
            title={expanded ? undefined : 'Sign out'}
          >
            <LogOut className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            {expanded && 'Sign out'}
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className={`${footerButton} ${expanded ? 'px-3' : 'justify-center'}`}
        >
          {expanded ? <ChevronsLeft className="h-[1.125rem] w-[1.125rem]" aria-hidden /> : <ChevronsRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />}
          {expanded && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}
