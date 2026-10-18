import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Emblem } from '../ui/Emblem';
import { NavItems } from './NavItems';

interface SidebarRailProps {
  expanded: boolean;
  onToggle: () => void;
}

/** Desktop navigation: a floating burgundy rail that expands to show labels. */
export function SidebarRail({ expanded, onToggle }: SidebarRailProps) {
  return (
    <aside aria-label="Main navigation" className="fixed inset-y-4 left-4 z-40 hidden lg:flex">
      <div
        className={`my-auto flex max-h-full flex-col gap-2 rounded-[2rem] bg-burgundy py-4 text-white shadow-[0_12px_32px_rgba(100,6,6,0.25)] transition-[width] duration-300 ${
          expanded ? 'w-60 px-3' : 'w-[4.5rem] px-2.5'
        }`}
      >
        <Link to="/" className={`flex items-center gap-3 pb-2 ${expanded ? 'px-1' : 'justify-center'}`} aria-label="PHILRADS Staff Portal home">
          <Emblem className="h-11 w-11" decorative />
          {expanded && (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-display text-lg tracking-wide">PHILRADS</span>
              <span className="text-[0.6875rem] uppercase tracking-[0.16em] text-white/70">Staff Portal</span>
            </span>
          )}
        </Link>
        {/* Visible overflow keeps the hover labels from being clipped; very short screens scroll instead. */}
        <nav
          aria-label="Modules"
          className={`-mx-1 flex flex-1 flex-col gap-2 px-1 [@media(max-height:680px)]:overflow-y-auto ${expanded ? 'overflow-y-auto' : ''}`}
        >
          <NavItems expanded={expanded} />
        </nav>
        {expanded && <p className="px-3 pt-2 text-xs font-bold text-uplift">Serving People in Jesus’ Name.</p>}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className={`mt-1 flex h-10 items-center gap-2 rounded-full text-xs font-semibold text-white/80 ring-1 ring-white/20 hover:bg-white/10 ${
            expanded ? 'px-3' : 'justify-center'
          }`}
        >
          {expanded ? <ChevronsLeft className="h-4 w-4" aria-hidden /> : <ChevronsRight className="h-4 w-4" aria-hidden />}
          {expanded && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}
