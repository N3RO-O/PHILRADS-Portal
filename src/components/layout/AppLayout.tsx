import { useEffect, useState, useCallback } from 'react';
import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { moduleForPath, moduleOpenTo } from '../../config/modules';
import { useAuth } from '../auth/AuthProvider';
import { formatLongDate } from '../../lib/format';
import { LiveSharingProvider } from '../map/LiveSharing';
import { PresenceProvider } from '../../lib/presence';
import { NotificationToasts } from './NotificationToasts';
import { QuickUnlockProvider } from '../auth/QuickUnlock';
import { LiveSharingBubble } from '../map/LiveSharingBubble';
import { IdleSignOut } from '../auth/IdleSignOut';
import { AUTO_SIGN_OUT } from '../../lib/idle';
import { OnboardingProvider } from '../onboarding/OnboardingProvider';
import { UpdatePrompt } from '../pwa/UpdatePrompt';
import { MobileDrawer } from './MobileDrawer';
import { OfflineNotice, OnlinePill } from './OnlineStatus';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ActivePanel } from './ActivePanel';
import { BreakNudge } from './BreakNudge';
import { Welcomer } from '../onboarding/Welcomer';
import { PullToRefresh } from '../ui/PullToRefresh';

export interface LayoutContext {
  search: string;
}
export const useLayoutContext = () => useOutletContext<LayoutContext>();

const SIDEBAR_KEY = 'philrads.sidebar.expanded';
const ACTIVE_KEY = 'philrads.active.open';

/** Wide enough (1280px+) to keep the Active list beside the page. */
function useWide() {
  const query = '(min-width: 1280px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}
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
  const current = moduleForPath(location.pathname);
  const { can, profile } = useAuth();
  // A page this person's role doesn't include (a volunteer opening /inventory from an old link): go to Tasks.
  const closed = Boolean(current && profile && !moduleOpenTo(current, profile.roleKey, can));
  const title = current?.label ?? 'Page not found';

  useEffect(() => {
    document.title = `${title} · PRISM`;
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

  // Search anything: results show under the box; Home also filters its tasks and activity by it.
  const onSearch = (value: string) => setSearch(value);
  // Pull to refresh (phones): the page loads its data again.
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshPage = useCallback(() => setRefreshKey((k) => k + 1), []);
  // The Active list: docked on the right on wide screens (shown unless hidden), a drawer below that.
  const wide = useWide();
  const [activeDocked, setActiveDocked] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const [activeDrawer, setActiveDrawer] = useState(false);
  const setDocked = (v: boolean) => {
    setActiveDocked(v);
    try {
      localStorage.setItem(ACTIVE_KEY, v ? '1' : '0');
    } catch {
      /* this visit only */
    }
  };
  const toggleActive = () => (wide ? setDocked(!activeDocked) : setActiveDrawer((o) => !o));
  useEffect(() => setActiveDrawer(false), [location.pathname]);

  return (
    <OnboardingProvider>
    <PresenceProvider>
    <QuickUnlockProvider>
    <LiveSharingProvider>
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-xl bg-uplift px-4 py-2 font-semibold text-onaccent focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <Sidebar expanded={expanded} onToggle={toggleSidebar} />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className={`flex min-h-dvh flex-col transition-[padding] duration-300 ${expanded ? 'lg:pl-64' : 'lg:pl-[4.5rem]'} ${activeDocked ? 'xl:pr-64' : ''}`}>
        <TopBar
          activeShown={wide ? activeDocked : activeDrawer}
          onToggleActive={toggleActive}
          search={search}
          onSearch={onSearch}
          menuOpen={menuOpen}
          onOpenMenu={() => setMenuOpen(true)}
          hideMobileSearch={current?.id === 'inventory'}
        />
        <main id="main" className="mx-auto w-full max-w-[100rem] flex-1 px-4 pb-10 sm:px-6" style={{ viewTransitionName: 'page' }}>
          <div className="flex flex-wrap items-end justify-between gap-3 pb-6 pt-3">
            <div className="min-w-0">
              {current && (
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted">
                  PHILRADS <span aria-hidden className="mx-1 text-ink-mute/50">/</span> <span className="text-ink-soft">{current.group}</span>
                </p>
              )}
              <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OnlinePill className="sm:hidden" />
              <span className="pill border border-line/70 bg-surface text-ink-soft">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                <time dateTime={new Date().toISOString().slice(0, 10)}>{formatLongDate()}</time>
              </span>
            </div>
          </div>
          <OfflineNotice />
          {/* Keyed by page so each page change fades in smoothly. */}
          <PullToRefresh onRefresh={refreshPage}>
            <div key={`${location.pathname}#${refreshKey}`} className="animate-fade-in">
              {closed ? <Navigate to="/tasks" replace /> : <Outlet context={{ search } satisfies LayoutContext} />}
            </div>
          </PullToRefresh>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line/50 px-4 py-4 text-xs text-muted sm:px-6">
          <span>
            Philippine Relief and Development Services, Inc. · PRISM v{__APP_VERSION__}{' '}
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
      {/* Active: who's on, by role (docked on wide screens, a drawer on smaller ones). */}
      {wide && activeDocked && (
        <div className="fixed inset-y-0 right-0 z-30 animate-sheet-left">
          <ActivePanel variant="docked" onClose={() => setDocked(false)} />
        </div>
      )}
      {!wide && activeDrawer && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button type="button" className="absolute inset-0 animate-fade-in bg-black/50" aria-label="Close the Active list" onClick={() => setActiveDrawer(false)} />
          <div className="relative h-full animate-sheet-left">
            <ActivePanel variant="drawer" onClose={() => setActiveDrawer(false)} />
          </div>
        </div>
      )}
      {/* After long stretches of work: a suggestion to take a short break. */}
      <BreakNudge />
      <Welcomer />
      {/* New bell notes pop in as they arrive. */}
      <NotificationToasts />
      {/* Signed-in staff: signed out after 5 minutes without activity (off for now, see AUTO_SIGN_OUT). */}
      {AUTO_SIGN_OUT && <IdleSignOut />}
    </div>
    </LiveSharingProvider>
    </QuickUnlockProvider>
    </PresenceProvider>
    </OnboardingProvider>
  );
}
