import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { moduleForPath } from '../../config/modules';
import { dashboardService } from '../../services';
import { formatLongDate } from '../../lib/format';
import { useAuth } from '../auth/AuthProvider';
import { UpdatePrompt } from '../pwa/UpdatePrompt';
import { MobileDrawer } from './MobileDrawer';
import { OfflineNotice, OnlinePill } from './OnlineStatus';
import { SidebarRail } from './SidebarRail';
import { TopBar } from './TopBar';

export interface LayoutContext {
  search: string;
}
export const useLayoutContext = () => useOutletContext<LayoutContext>();

const SIDEBAR_KEY = 'philrads.sidebar.expanded';
const readExpanded = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
};

export function AppLayout() {
  const [expanded, setExpanded] = useState(readExpanded);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const current = moduleForPath(location.pathname);
  const title = current?.label ?? 'Page not found';

  useEffect(() => {
    document.title = `${title} · PHILRADS Staff Portal`;
  }, [title]);

  useEffect(() => {
    setMenuOpen(false);
    // New page starts at the top (in-page links like /#my-tasks scroll themselves).
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, location.hash]);

  const toggleSidebar = () =>
    setExpanded((v) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, v ? '0' : '1');
      } catch {
        /* storage unavailable: keep in memory only */
      }
      return !v;
    });

  const onSearch = (value: string) => {
    setSearch(value);
    if (value && location.pathname !== '/') navigate('/');
  };

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-full bg-white px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <SidebarRail expanded={expanded} onToggle={toggleSidebar} />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className={`flex min-h-dvh flex-col transition-[padding] duration-300 ${expanded ? 'lg:pl-[19rem]' : 'lg:pl-28'}`}>
        <TopBar search={search} onSearch={onSearch} menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[100rem] flex-1 px-4 pb-12 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-5 pt-2">
            <div className="min-w-0">
              <h1 className="font-display text-2xl leading-tight sm:text-[1.75rem]">{title}</h1>
              {profile && <p className="mt-1 text-sm text-muted">Welcome back, {profile.displayName}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OnlinePill className="sm:hidden" />
              {dashboardService.source === 'mock' && (
                <span className="pill bg-uplift-100 text-uplift-700" title="Figures on this page are demonstration data">
                  <span className="h-2 w-2 rounded-full bg-uplift" aria-hidden /> Sample data
                </span>
              )}
              <span className="pill bg-white/70 text-charcoal ring-1 ring-black/[0.06] backdrop-blur">
                <CalendarDays className="h-3.5 w-3.5 text-burgundy" aria-hidden />
                <time dateTime={new Date().toISOString().slice(0, 10)}>{formatLongDate()}</time>
              </span>
            </div>
          </div>
          <OfflineNotice />
          {/* Keyed by page so each page change fades in smoothly. */}
          <div key={location.pathname} className="animate-fade-in">
            <Outlet context={{ search } satisfies LayoutContext} />
          </div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted sm:px-6">
          <span>
            Philippine Relief and Development Services, Inc. · Staff Portal v{__APP_VERSION__}{' '}
            <span className="text-muted/70">({__APP_BUILD__})</span>
          </span>
          <a href="https://philrads.org/" target="_blank" rel="noopener noreferrer" className="font-semibold text-burgundy hover:underline">
            philrads.org
          </a>
        </footer>
      </div>
      <UpdatePrompt />
    </div>
  );
}
