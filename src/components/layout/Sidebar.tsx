import { ChevronsLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PrismMark, PrismWord } from '../ui/PrismMark';
import { NavItems, railLabel } from './NavItems';

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

/**
 * Desktop navigation: full-height sidebar that folds to an icon rail. Icons never move while it
 * folds (each sits where the rail centres it); only the width and the words change.
 */
export function Sidebar({ expanded, onToggle }: SidebarProps) {
  return (
    <aside
      aria-label="Main navigation"
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden border-r border-line/70 bg-page bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0)_40%)] transition-[width] duration-[260ms] ease-glide lg:flex ${
        expanded ? 'w-64' : 'w-[4.5rem]'
      }`}
    >
      <Link to="/" className="flex h-16 shrink-0 items-center gap-3 pl-[1.125rem]" aria-label="PRISM home">
        <PrismMark className="h-9 w-9 shrink-0 text-ink" />
        <span className={`flex min-w-0 flex-col leading-tight ${railLabel(expanded)}`} aria-hidden>
          <PrismWord className="font-display text-base tracking-[0.06em] text-ink" />
          <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.2em] text-muted">by PHILRADS</span>
        </span>
      </Link>
      {/* Scrolls when the window is too short for every module (hover labels float outside it, so nothing is clipped). */}
      <nav aria-label="Modules" className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3">
        <NavItems expanded={expanded} rail />
      </nav>
      <div className="flex shrink-0 flex-col gap-1 border-t border-line/70 px-3 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className="flex h-10 w-full items-center gap-3 overflow-hidden rounded-xl pl-[0.9375rem] text-sm font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink"
        >
          <ChevronsLeft className={`h-[1.125rem] w-[1.125rem] shrink-0 transition-transform duration-[260ms] ease-glide ${expanded ? '' : 'rotate-180'}`} aria-hidden />
          <span className={railLabel(expanded)} aria-hidden>
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
}
