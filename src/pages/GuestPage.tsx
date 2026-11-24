import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, HandCoins, HandHeart, MapPin, Navigation, X } from 'lucide-react';
import { SignInBackground } from '../components/auth/SignInBackground';
import { PrismHero } from '../components/auth/PrismHero';
import { DrivesSection } from '../components/guest/DrivesSection';
import { FeedbackSection, type FeedbackHandle } from '../components/guest/FeedbackSection';
import type { GuestPick } from '../components/guest/GuestMap';
import { GuestSection, SectionError } from '../components/guest/guestUi';
import { MerchSection } from '../components/guest/MerchSection';
import { NewsSection } from '../components/guest/NewsSection';
import { StoriesSection } from '../components/guest/StoriesSection';
import { SampleBadge } from '../components/ui/SampleBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { guestService } from '../services';
import { programMeta, PROGRAMS } from '../services/activities/types';
import type { GuestOverview } from '../services/guest/guestService';
import type { Hazard } from '../services/guest/hazards';
import { kindMeta } from '../services/map/types';
import { directionsUrl } from '../lib/geo';
import { formatNumber } from '../lib/format';

// Leaflet only loads once the guest page opens, so the sign-in screen stays light.
const GuestMap = lazy(() => import('../components/guest/GuestMap'));

const SECTIONS = [
  { id: 'map', label: 'Live Map' },
  { id: 'news', label: 'Disaster News' },
  { id: 'stories', label: 'PHILReads' },
  { id: 'drives', label: 'Donation Drives' },
  { id: 'merch', label: 'Merch' },
  { id: 'feedback', label: 'Feedback' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const LEVEL_WORD = { red: 'Red alert', orange: 'Orange alert', green: 'Green alert' } as const;

/** The section in the middle of the screen, for the bar's highlight. */
function useCurrentSection() {
  const [current, setCurrent] = useState<SectionId>('map');
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = SECTIONS.find((s) => seen.get(s.id));
        if (first) setCurrent(first.id);
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return current;
}

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

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

/**
 * The guest door from the sign-in screen: no account, nothing private. Where PHILRADS works and
 * what is happening now (Live Map, Disaster News), its stories (PHILReads), and ways to help
 * (Donation Drives, Merch, Feedback). Staff edit the content on the Guest page in the portal.
 */
export function GuestPage() {
  const overview = useAsyncData(useCallback(() => guestService.overview(), []));
  const feed = useAsyncData(useCallback(() => guestService.hazards(), []));
  const stories = useAsyncData(useCallback(() => guestService.stories(), []));
  const drives = useAsyncData(useCallback(() => guestService.drives(), []));
  const merch = useAsyncData(useCallback(() => guestService.merch(), []));
  const feedback = useRef<FeedbackHandle>(null);
  const current = useCurrentSection();
  const nav = useRef<HTMLDivElement>(null);

  const [layers, setLayers] = useState({ work: true, places: true, hazards: true });
  const [pick, setPick] = useState<GuestPick>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const hazards = feed.data?.hazards ?? [];
  // The map keeps to what matters now: ongoing hazards and those from the last 30 days.
  const recent = useMemo(() => hazards.filter((h) => h.current || Date.now() - Date.parse(h.to ?? h.from) < 30 * 86_400_000), [hazards]);
  const programsShown = useMemo(() => PROGRAMS.filter((p) => overview.data?.sites.some((s) => s.program === p.key)), [overview.data]);
  const onPick = useCallback((p: GuestPick) => setPick(p), []);

  // Keep the highlighted section's chip in view on narrow screens.
  // (Sideways only: scrollIntoView would also move the page.)
  useEffect(() => {
    const bar = nav.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-section="${current}"]`);
    if (!bar || !chip) return;
    const left = chip.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft) bar.scrollTo({ left: left - 8, behavior: 'smooth' });
    else if (left + chip.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: left + chip.offsetWidth - bar.clientWidth + 8, behavior: 'smooth' });
  }, [current]);

  // Arriving on a shared drive link: go to it once the drives are in.
  useEffect(() => {
    if (drives.status === 'success' && location.hash.startsWith('#drive-')) setTimeout(() => go(location.hash.slice(1)), 150);
  }, [drives.status]);

  const showHazard = (h: Hazard) => {
    setLayers((l) => ({ ...l, hazards: true }));
    setPick({ type: 'hazard', id: h.id });
    setFocus({ lat: h.lat, lng: h.lng, key: Date.now() });
    go('map');
  };

  const sample = guestService.source === 'mock';

  return (
    <main className="relative isolate min-h-dvh px-3 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-4 sm:pt-[calc(2rem+env(safe-area-inset-top))]">
      <SignInBackground />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <header className="floating relative animate-fade-up overflow-hidden rounded-2xl bg-transparent">
          <Link to="/" className="tap absolute left-2 top-2 z-10 flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-cloud/80 hover:bg-white/10 hover:text-cloud">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Sign in
          </Link>
          <PrismHero>
            <h1 className="mt-2 font-display text-[1.75rem] leading-[1.1] tracking-[-0.01em]">Welcome, guest</h1>
            <p className="max-w-md text-[0.975rem] leading-relaxed text-cloud/85">
              See where Philippine Relief and Development Services is helping, what is happening now, and how you can help.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-primary" onClick={() => go('drives')}>
                <HandCoins className="h-4 w-4" aria-hidden /> Give to a drive
              </button>
              <button
                type="button"
                className="btn border border-white/25 bg-white/10 text-cloud hover:bg-white/15"
                onClick={() => {
                  feedback.current?.choose('volunteer');
                  go('feedback');
                }}
              >
                <HandHeart className="h-4 w-4" aria-hidden /> Volunteer
              </button>
            </div>
          </PrismHero>
        </header>

        {/* The section bar: always in reach, the current section marked. */}
        <nav aria-label="Guest sections" className="sticky top-[env(safe-area-inset-top)] z-20 -mx-3 px-3 py-1.5 sm:-mx-4 sm:px-4">
          <div ref={nav} className="guest-nav floating flex gap-1 overflow-x-auto rounded-2xl p-1.5 backdrop-blur">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                data-section={s.id}
                aria-current={current === s.id ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  go(s.id);
                }}
                className={`tap flex min-h-9 shrink-0 items-center rounded-xl px-3 text-xs font-semibold transition-colors ${
                  current === s.id ? 'bg-burgundy-500 text-cloud' : 'text-ink-soft hover:bg-surface-sunken hover:text-ink'
                }`}
              >
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="floating overflow-hidden rounded-2xl">
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
                {feed.data && hazards.some((h) => h.current) && <span className="tabular-nums">({hazards.filter((h) => h.current).length} now)</span>}
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

          <NewsSection feed={feed} onRetry={feed.reload} onShow={showHazard} />
          <StoriesSection stories={stories} onRetry={stories.reload} />
          <DrivesSection drives={drives} onRetry={drives.reload} />
          <MerchSection merch={merch} onRetry={merch.reload} />
          <FeedbackSection ref={feedback} />
        </div>

        <footer className="flex flex-col items-center gap-3 px-4 py-4 text-center text-xs text-cloud/70 sm:flex-row sm:justify-between sm:text-left">
          <p>Philippine Relief and Development Services, Inc.</p>
          <p className="flex items-center gap-4">
            <a href="https://philrads.org/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-cloud/85 hover:text-cloud hover:underline">
              philrads.org <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            <Link to="/" className="font-semibold text-cloud/85 hover:text-cloud hover:underline">
              Staff sign-in
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
