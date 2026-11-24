import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ExternalLink,
  HandCoins,
  HandHeart,
  LayoutGrid,
  LogIn,
  Map as MapIcon,
  MapPin,
  MessageSquareHeart,
  Navigation,
  Phone,
  Shirt,
  Siren,
  X,
  type LucideIcon,
} from 'lucide-react';
import { SignInBackground } from '../components/auth/SignInBackground';
import { PrismHero } from '../components/auth/PrismHero';
import { DrivesSection } from '../components/guest/DrivesSection';
import { FeedbackSection, isFeedbackKind } from '../components/guest/FeedbackSection';
import type { GuestPick } from '../components/guest/GuestMap';
import { GuestSection, SectionError } from '../components/guest/guestUi';
import { MerchSection } from '../components/guest/MerchSection';
import { NewsSection } from '../components/guest/NewsSection';
import { StoriesSection } from '../components/guest/StoriesSection';
import { PrismMark } from '../components/ui/PrismMark';
import { SampleBadge } from '../components/ui/SampleBadge';
import { SlidingPill } from '../components/ui/SlidingPill';
import { useBackdropClose } from '../components/ui/Sheet';
import { useAsyncData } from '../hooks/useAsyncData';
import { closeDialog, openDialog } from '../lib/dialogMotion';
import { guestService } from '../services';
import { programMeta, PROGRAMS } from '../services/activities/types';
import type { GuestOverview } from '../services/guest/guestService';
import type { Hazard } from '../services/guest/hazards';
import { kindMeta } from '../services/map/types';
import { directionsUrl } from '../lib/geo';
import { formatNumber } from '../lib/format';

// Leaflet only loads once the guest page opens, so the sign-in screen stays light.
const GuestMap = lazy(() => import('../components/guest/GuestMap'));

/**
 * The guest page works like a phone app: five tabs along the bottom, each its own screen, and
 * two more screens (Merch, Feedback) inside More. Each screen has its own address, so the
 * phone's back button, shared links and reloads all land where they should.
 */
type Screen = 'map' | 'news' | 'stories' | 'give' | 'more' | 'merch' | 'feedback';
type Tab = 'map' | 'news' | 'stories' | 'give' | 'more';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'news', label: 'News', icon: Siren },
  { id: 'stories', label: 'Stories', icon: BookOpen },
  { id: 'give', label: 'Give', icon: HandCoins },
  { id: 'more', label: 'More', icon: LayoutGrid },
];

/** Each screen's title, its tab, and the id of the section whose big title the app bar watches. */
const SCREENS: Record<Screen, { title: string; tab: Tab; section: string }> = {
  map: { title: 'Live Map', tab: 'map', section: 'map' },
  news: { title: 'Disaster News', tab: 'news', section: 'news' },
  stories: { title: 'PHILReads', tab: 'stories', section: 'stories' },
  give: { title: 'Donation Drives', tab: 'give', section: 'drives' },
  more: { title: 'More', tab: 'more', section: 'more' },
  merch: { title: 'Merch', tab: 'more', section: 'merch' },
  feedback: { title: 'Feedback', tab: 'more', section: 'feedback' },
};
const isScreen = (s: string): s is Screen => Object.prototype.hasOwnProperty.call(SCREENS, s);
const pathOf = (s: Screen) => (s === 'map' ? '/guest' : `/guest/${s}`);

/** Links from before the tabs (/guest#drives, /guest#drive-…, /guest?story=…) still land in the right place. */
function legacyTarget(hash: string, search: URLSearchParams): string | null {
  const story = search.get('story');
  if (story) return `/guest/stories?story=${encodeURIComponent(story)}`;
  if (hash.startsWith('#drive-')) return `/guest/give${hash}`;
  const old: Record<string, Screen> = { '#news': 'news', '#stories': 'stories', '#drives': 'give', '#merch': 'merch', '#feedback': 'feedback' };
  return old[hash] ? pathOf(old[hash]) : null;
}

const motion = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: motion(), block: 'start' });

const LEVEL_WORD = { red: 'Red alert', orange: 'Orange alert', green: 'Green alert' } as const;

/** One sentence on what PHILRADS has done, from the records behind the map. */
function Reach({ totals }: { totals: GuestOverview['totals'] }) {
  if (!totals.activities) return null;
  const people = totals.individuals || totals.households * 4;
  return (
    <p className="max-w-prose text-[0.975rem] leading-relaxed text-ink-soft">
      {totals.since ? `Since ${totals.since}, ` : ''}PHILRADS has carried out <strong className="font-semibold text-ink">{formatNumber(totals.activities)} relief and development activities</strong> in{' '}
      <strong className="font-semibold text-ink">{formatNumber(totals.places)} places</strong>
      {people > 0 && (
        <>
          , reaching <strong className="font-semibold text-ink">{totals.individuals ? formatNumber(people) : `about ${formatNumber(people)}`} people</strong>
        </>
      )}
      . Each dot is one activity, sized by how many it served.
    </p>
  );
}

/** What was pressed on the map, under it, where it is easy to read. */
function Picked({ pick, overview, hazards, onClose }: { pick: GuestPick; overview: GuestOverview | undefined; hazards: Hazard[]; onClose: () => void }) {
  if (!pick || !overview) return null;
  let body: JSX.Element | null = null;
  if (pick.type === 'site') {
    const s = overview.sites.find((x) => x.id === pick.id);
    if (s)
      body = (
        <>
          <p className="flex items-center gap-2 text-xs font-semibold" style={{ color: programMeta(s.program).color }}>
            <span className="h-2 w-2 rounded-full" style={{ background: programMeta(s.program).color }} aria-hidden />
            {programMeta(s.program).label}
          </p>
          <p className="mt-1 font-semibold text-ink">{s.activity}</p>
          <p className="text-sm text-ink-soft">
            {s.site}, {s.dateLabel}
          </p>
          {s.response && <p className="mt-1 text-sm text-ink-soft">Part of the response to {s.response}</p>}
          {(s.individuals || s.households) && (
            <p className="mt-1 text-sm text-ink">
              {s.individuals ? `${formatNumber(s.individuals)} people` : ''}
              {s.individuals && s.households ? ' in ' : ''}
              {s.households ? `${formatNumber(s.households)} households` : ''} {s.status === 'completed' ? 'served' : s.status === 'ongoing' ? 'being served' : 'planned'}
            </p>
          )}
        </>
      );
  } else if (pick.type === 'place') {
    const p = overview.places.find((x) => x.id === pick.id);
    if (p)
      body = (
        <>
          <p className="text-xs font-semibold" style={{ color: kindMeta(p.kind).color }}>
            {kindMeta(p.kind).label}
          </p>
          <p className="mt-1 font-semibold text-ink">{p.name}</p>
          {p.address && <p className="text-sm text-ink-soft">{p.address}</p>}
          <a className="link mt-2" href={directionsUrl(p)} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-3.5 w-3.5" aria-hidden /> Directions
          </a>
        </>
      );
  } else {
    const h = hazards.find((x) => x.id === pick.id);
    if (h)
      body = (
        <>
          <p className={`text-xs font-semibold ${h.level === 'red' ? 'text-status-out' : h.level === 'orange' ? 'text-status-low' : 'text-status-in'}`}>
            {LEVEL_WORD[h.level]}
            {h.current ? ', happening now' : ''}
          </p>
          <p className="mt-1 font-semibold text-ink">{h.title}</p>
          <p className="text-sm text-ink-soft">{h.detail}</p>
          <a className="link mt-2" href={h.url} target="_blank" rel="noopener noreferrer">
            {h.source} report <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </>
      );
  }
  if (!body) return null;
  return (
    <div className="mt-3 flex animate-pop-in items-start gap-3 rounded-2xl border border-line bg-surface-sunken p-4" role="status">
      <div className="min-w-0 flex-1">{body}</div>
      <button type="button" className="icon-btn -m-1.5" onClick={onClose} aria-label="Close details">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/** True once the screen's own big title has scrolled up under the app bar: then the bar shows it instead. */
function useTitleTucked(id: string) {
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    setTucked(false);
    const el = document.getElementById(id);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setTucked(!e.isIntersecting && e.boundingClientRect.top < 100), { rootMargin: '-76px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [id]);
  return tucked;
}

const WELCOMED = 'philrads.guest.welcomed.v1';
const welcomedBefore = () => {
  try {
    return localStorage.getItem(WELCOMED) === '1';
  } catch {
    return false;
  }
};

/**
 * The welcome: the PRISM glass over the page on a guest's first visit, with the two ways to help.
 * Closing it (the X, Escape, a tap outside, or "Look around") is remembered on this device; the
 * mark in the app bar opens it again.
 */
function WelcomeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdrop = useBackdropClose(ref, onClose);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) openDialog(el);
    else closeDialog(el);
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="guest-welcome-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      {...backdrop.handlers}
      className="motion-pop w-[min(26rem,calc(100vw-2rem))] animate-pop-in overflow-hidden rounded-3xl bg-transparent p-0 shadow-2xl shadow-black/60 backdrop:animate-fade-in backdrop:bg-black/60"
    >
      <PrismHero className="pb-6 pt-10">
        <h2 id="guest-welcome-title" className="mt-2 font-display text-[1.75rem] leading-[1.1] tracking-[-0.01em]">
          Welcome, guest
        </h2>
        <p className="max-w-md text-[0.975rem] leading-relaxed text-cloud/85">
          See where Philippine Relief and Development Services is helping, what is happening now, and how you can help.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link to="/guest/give" onClick={onClose} className="btn-primary">
            <HandCoins className="h-4 w-4" aria-hidden /> Give your donation
          </Link>
          <Link to="/guest/feedback?about=volunteer" onClick={onClose} className="btn border border-white/25 bg-white/10 text-cloud hover:bg-white/15">
            <HandHeart className="h-4 w-4" aria-hidden /> Volunteer
          </Link>
        </div>
        <button type="button" onClick={onClose} className="tap mt-1 rounded-full px-4 py-2 text-sm font-semibold text-cloud/80 underline-offset-4 hover:text-cloud hover:underline">
          Look around
        </button>
      </PrismHero>
      {/* After the glass, so it sits on top of it in the corner. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the welcome"
        className="tap absolute right-2.5 top-2.5 z-10 grid h-10 w-10 place-items-center rounded-full text-cloud/85 hover:bg-white/10 hover:text-cloud"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </dialog>
  );
}

/** A row on the More screen. */
function MoreRow({ to, href, icon: Icon, title, note }: { to?: string; href?: string; icon: LucideIcon; title: string; note: string }) {
  const body = (
    <>
      <span className="icon-chip rounded-xl bg-surface-sunken">
        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-sm text-ink-soft">{note}</span>
      </span>
      {href ? <ExternalLink className="h-4 w-4 shrink-0 text-muted" aria-hidden /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />}
    </>
  );
  const cls = 'tap flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-sunken sm:px-8';
  return (
    <li>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {body}
        </a>
      ) : (
        <Link to={to ?? '/guest'} className={cls}>
          {body}
        </Link>
      )}
    </li>
  );
}

/** Merch, Feedback and the ways out: the More tab. */
function MoreScreen() {
  return (
    <section aria-labelledby="more-title" className="py-7">
      <h2 id="more-title" className="px-5 font-display text-[1.375rem] leading-tight tracking-[-0.01em] text-ink sm:px-8">
        More
      </h2>
      <ul className="mt-4 divide-y divide-line/70 border-y border-line/70">
        <MoreRow to="/guest/merch" icon={Shirt} title="Merch" note="PHILRADS shirts and other items you can order" />
        <MoreRow to="/guest/feedback" icon={MessageSquareHeart} title="Feedback" note="Say thanks, tell us a need, or offer to volunteer" />
      </ul>
      <ul className="mt-6 divide-y divide-line/70 border-y border-line/70">
        <MoreRow href="https://philrads.org/" icon={ExternalLink} title="philrads.org" note="Philippine Relief and Development Services, Inc." />
        <MoreRow to="/" icon={LogIn} title="Staff sign-in" note="For PHILRADS staff with an account" />
      </ul>
      <p className="mt-6 flex items-center gap-2 px-5 text-sm text-ink-soft sm:px-8">
        <Phone className="h-4 w-4 text-status-out" aria-hidden />
        <span>
          In an emergency, call{' '}
          <a href="tel:911" className="font-semibold text-ink underline underline-offset-2">
            911
          </a>
          .
        </span>
      </p>
    </section>
  );
}

/**
 * The guest door from the sign-in screen: no account, nothing private. Where PHILRADS works and
 * what is happening now (Live Map, Disaster News), its stories (PHILReads), and ways to help
 * (Donation Drives, Merch, Feedback). Staff edit the content on the Guest page in the portal.
 */
export function GuestPage() {
  const { screen: param = 'map' } = useParams();
  const location = useLocation();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const screen: Screen = isScreen(param) ? param : 'map';
  const meta = SCREENS[screen];

  // Everything loads once, so moving between tabs is instant.
  const overview = useAsyncData(useCallback(() => guestService.overview(), []));
  const feed = useAsyncData(useCallback(() => guestService.hazards(), []));
  const stories = useAsyncData(useCallback(() => guestService.stories(), []));
  const notes = useAsyncData(useCallback(() => guestService.announcements(), []));
  const drives = useAsyncData(useCallback(() => guestService.drives(), []));
  const merch = useAsyncData(useCallback(() => guestService.merch(), []));

  const [layers, setLayers] = useState({ work: true, places: true, hazards: true });
  const [pick, setPick] = useState<GuestPick>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const hazards = feed.data?.hazards ?? [];
  // The News tab's count: alerts happening now, and PHILRADS's urgent announcements.
  const live = hazards.filter((h) => h.current).length + (notes.data ?? []).filter((a) => a.level === 'urgent').length;
  // The map keeps to what matters now: ongoing hazards and those from the last 30 days.
  const recent = useMemo(() => hazards.filter((h) => h.current || Date.now() - Date.parse(h.to ?? h.from) < 30 * 86_400_000), [hazards]);
  const programsShown = useMemo(() => PROGRAMS.filter((p) => overview.data?.sites.some((s) => s.program === p.key)), [overview.data]);
  const onPick = useCallback((p: GuestPick) => setPick(p), []);
  const tucked = useTitleTucked(`${meta.section}-title`);

  // First visit only, and not over a shared link to a drive or story.
  const [welcome, setWelcome] = useState(() => !welcomedBefore() && screen === 'map' && !location.hash && !search.get('story'));
  const closeWelcome = useCallback(() => {
    setWelcome(false);
    try {
      localStorage.setItem(WELCOMED, '1');
    } catch {
      /* it shows again next time */
    }
  }, []);

  // Each tab keeps its place, as app tabs do: leave News halfway down, come back halfway down.
  const scrolls = useRef(new Map<Screen, number>());
  const shown = useRef<Screen>(screen);
  useEffect(() => {
    const save = () => scrolls.current.set(shown.current, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, []);
  useLayoutEffect(() => {
    shown.current = screen;
    if (!location.hash) window.scrollTo({ top: scrolls.current.get(screen) ?? 0, behavior: 'instant' });
    // A hazard picked from News flies the map there once; coming back to the map later doesn't fly again.
    if (screen !== 'map') setFocus(null);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arriving on a shared drive link: go to it once the drives are in.
  useEffect(() => {
    if (screen === 'give' && drives.status === 'success' && location.hash.startsWith('#drive-')) {
      const t = setTimeout(() => go(location.hash.slice(1)), 150);
      return () => clearTimeout(t);
    }
  }, [drives.status, screen, location.hash]);

  const legacy = screen === 'map' ? legacyTarget(location.hash, search) : null;
  if (legacy) return <Navigate to={legacy} replace />;
  if (!isScreen(param)) return <Navigate to="/guest" replace />;

  const showHazard = (h: Hazard) => {
    setLayers((l) => ({ ...l, hazards: true }));
    setPick({ type: 'hazard', id: h.id });
    scrolls.current.set('map', 0);
    navigate('/guest');
    // After the map screen is up, so its fly-to sees the new place.
    setTimeout(() => setFocus({ lat: h.lat, lng: h.lng, key: Date.now() }), 0);
  };

  /** Pressing the tab you are already on takes you back to its top, as phones do. */
  const tabPress = (t: Tab) => (e: MouseEvent) => {
    if (screen === t) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: motion() });
    }
  };

  const sample = guestService.source === 'mock';
  const sub = screen === 'merch' || screen === 'feedback';
  const about = search.get('about');
  const showTitle = tucked || sub;

  let body: ReactNode;
  if (screen === 'map')
    body = (
      <GuestSection
        id="map"
        title="Live Map"
        lead={overview.data ? <Reach totals={overview.data.totals} /> : 'Where PHILRADS has worked, its offices and response sites, and hazards affecting the Philippines now.'}
        aside={sample ? <SampleBadge /> : undefined}
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show on the map">
          <button type="button" className="chip gap-1.5" aria-pressed={layers.work} onClick={() => setLayers((l) => ({ ...l, work: !l.work }))}>
            <span className="h-2 w-2 rounded-full bg-[#E07A7A]" aria-hidden /> Our work
          </button>
          <button type="button" className="chip gap-1.5" aria-pressed={layers.places} onClick={() => setLayers((l) => ({ ...l, places: !l.places }))}>
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Offices and sites
          </button>
          <button type="button" className="chip gap-1.5" aria-pressed={layers.hazards} onClick={() => setLayers((l) => ({ ...l, hazards: !l.hazards }))}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
              <path d="M12 2.8 22.4 20.6H1.6Z" fill="#f59e0b" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
            </svg>{' '}
            Hazards
            {hazards.some((h) => h.current) && <span className="tabular-nums">({hazards.filter((h) => h.current).length} now)</span>}
          </button>
        </div>
        <div className="relative isolate mt-3 h-[22rem] overflow-hidden rounded-2xl border border-line bg-surface-sunken sm:h-[27rem]">
          {overview.status === 'error' ? (
            <div className="grid h-full place-items-center p-6">
              <SectionError message={overview.error.message} onRetry={overview.reload} />
            </div>
          ) : (
            <Suspense fallback={<div className="skeleton h-full w-full rounded-none" />}>
              <GuestMap
                sites={layers.work ? overview.data?.sites ?? [] : []}
                places={layers.places ? overview.data?.places ?? [] : []}
                hazards={layers.hazards ? (pick?.type === 'hazard' && !recent.some((h) => h.id === pick.id) ? [...recent, ...hazards.filter((h) => h.id === pick.id)] : recent) : []}
                pick={pick}
                onPick={onPick}
                focus={focus}
              />
            </Suspense>
          )}
        </div>
        <Picked pick={pick} overview={overview.data} hazards={hazards} onClose={() => setPick(null)} />
        {layers.work && programsShown.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Dot colours">
            {programsShown.map((p) => (
              <li key={p.key} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
                {p.label}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">Staff locations are never shown here.</p>
      </GuestSection>
    );
  else if (screen === 'news') body = <NewsSection feed={feed} notes={notes.data ?? []} onRetry={feed.reload} onShow={showHazard} />;
  else if (screen === 'stories') body = <StoriesSection stories={stories} onRetry={stories.reload} />;
  else if (screen === 'give') body = <DrivesSection drives={drives} onRetry={drives.reload} />;
  else if (screen === 'merch') body = <MerchSection merch={merch} onRetry={merch.reload} />;
  else if (screen === 'feedback') body = <FeedbackSection key={about ?? ''} initialKind={isFeedbackKind(about) ? about : undefined} />;
  else body = <MoreScreen />;

  return (
    <main className="relative isolate min-h-dvh px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-4">
      <SignInBackground />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        {/* The app bar: where you are, a way back, and the way to sign in. The screen's name slides
            in here once its big title has scrolled away. */}
        <header className="sticky top-0 z-30 -mx-3 px-3 pb-1 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:-mx-4 sm:px-4">
          <div className="floating flex h-14 items-center gap-1.5 rounded-2xl pl-1.5 pr-2 backdrop-blur">
            {sub ? (
              <Link to="/guest/more" className="icon-btn tap" aria-label="Back to More">
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </Link>
            ) : (
              <button type="button" onClick={() => setWelcome(true)} className="tap grid h-11 w-11 place-items-center rounded-xl hover:bg-surface-sunken" aria-label="Show the welcome">
                <PrismMark className="h-8 w-8" />
              </button>
            )}
            <p className="relative h-6 min-w-0 flex-1 overflow-hidden font-display text-base leading-6 text-ink" aria-hidden>
              <span className={`absolute inset-0 truncate transition-[opacity,transform] duration-300 ${showTitle ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                {meta.title}
              </span>
              <span className={`absolute inset-0 truncate tracking-[0.06em] transition-[opacity,transform] duration-300 ${showTitle ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
                <span className="prism-p">P</span>RISM <span className="font-sans text-xs font-semibold tracking-normal text-muted">Guest</span>
              </span>
            </p>
            <Link to="/" className="chip tap shrink-0 gap-1.5">
              <LogIn className="h-4 w-4" aria-hidden /> Sign in
            </Link>
          </div>
        </header>

        <h1 className="sr-only">PRISM guest page: {meta.title}</h1>
        <div key={screen} className="floating animate-fade-in overflow-hidden rounded-2xl">
          {body}
        </div>
      </div>

      <WelcomeDialog open={welcome} onClose={closeWelcome} />

      {/* The tab bar: always in reach, the current tab marked. */}
      <nav aria-label="Guest" className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 sm:inset-x-4">
        <div className="floating relative mx-auto flex max-w-md rounded-2xl p-1.5 backdrop-blur">
          <SlidingPill className="rounded-xl bg-burgundy-500" />
          {TABS.map((t) => {
            const on = meta.tab === t.id;
            const Icon = t.icon;
            return (
              <Link
                key={t.id}
                to={pathOf(t.id)}
                onClick={tabPress(t.id)}
                aria-current={on ? 'page' : undefined}
                className={`tap relative z-10 flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.6875rem] font-semibold transition-colors ${
                  on ? 'text-cloud' : 'text-ink-soft hover:text-ink'
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" strokeWidth={on ? 2.25 : 1.75} aria-hidden />
                  {t.id === 'news' && live > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-status-out px-1 text-[0.625rem] font-bold leading-none text-white tabular-nums" aria-hidden>
                      {live}
                    </span>
                  )}
                </span>
                {t.label}
                {t.id === 'news' && live > 0 && <span className="sr-only">, {live} to see now</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
