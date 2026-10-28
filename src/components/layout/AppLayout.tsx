import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { moduleForPath } from '../../config/modules';
import { formatLongDate } from '../../lib/format';
import { LiveSharingProvider } from '../map/LiveSharing';
import { LiveSharingBubble } from '../map/LiveSharingBubble';
import { IdleSignOut } from '../auth/IdleSignOut';
import { OnboardingProvider } from '../onboarding/OnboardingProvider';
import { UpdatePrompt } from '../pwa/UpdatePrompt';
import { MobileDrawer } from './MobileDrawer';
import { OfflineNotice, OnlinePill } from './OnlineStatus';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export interface LayoutContext {
  search: string;
}
export const useLayoutContext = () => useOutletContext<LayoutContext>();

const SIDEBAR_KEY = 'philrads.sidebar.expanded';
/** Expanded by default; remembers the staff member's choice on this device. */
const readExpanded = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== '0';
  } catch {
    return true;
  }
};

export function AppLayout() {
  const [expanded, setExpanded] = useState(readExpanded);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
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
    <OnboardingProvider>
    <LiveSharingProvider>
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-xl bg-uplift px-4 py-2 font-semibold text-page focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <Sidebar expanded={expanded} onToggle={toggleSidebar} />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className={`flex min-h-dvh flex-col transition-[padding] duration-300 ${expanded ? 'lg:pl-64' : 'lg:pl-[4.5rem]'}`}>
        <TopBar
          search={search}
          onSearch={onSearch}
          menuOpen={menuOpen}
          onOpenMenu={() => setMenuOpen(true)}
          hideMobileSearch={current?.id === 'inventory'}
        />
        <main id="main" className="mx-auto w-full max-w-[100rem] flex-1 px-4 pb-10 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-6 pt-3">
            <div className="min-w-0">
              {current && (
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted">
                  PHILRADS <span aria-hidden className="mx-1 text-ink-mute/50">/</span> <span className="text-uplift">{current.group}</span>
                </p>
              )}
              <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OnlinePill className="sm:hidden" />
              <span className="pill border border-line/70 bg-surface text-ink-soft">
                <CalendarDays className="h-3.5 w-3.5 text-uplift" aria-hidden />
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
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line/50 px-4 py-4 text-xs text-muted sm:px-6">
          <span>
            Philippine Relief and Development Services, Inc. · Staff Portal v{__APP_VERSION__}{' '}
            <span className="text-muted/70">({__APP_BUILD__})</span>
          </span>
          <a href="https://philrads.org/" target="_blank" rel="noopener noreferrer" className="font-semibold text-uplift hover:underline">
            philrads.org
          </a>
        </footer>
      </div>
      <UpdatePrompt />
      {/* While sharing a live location: a floating bubble on every page, with Stop. */}
      <LiveSharingBubble />
      {/* Signed-in staff: signed out after 10 minutes without activity. */}
      <IdleSignOut />
    </div>
    </LiveSharingProvider>
    </OnboardingProvider>
  );
}
