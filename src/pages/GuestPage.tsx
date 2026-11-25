import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BellRing,
  BookOpen,
  ChevronRight,
  CloudOff,
  ExternalLink,
  HandCoins,
  HandHeart,
  HeartHandshake,
  LayoutGrid,
  LogIn,
  Map as MapIcon,
  MapPin,
  MessageSquareHeart,
  Navigation,
  Phone,
  ShieldCheck,
  Shirt,
  Siren,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PrismHero } from '../components/auth/PrismHero';
import { AlertsSection } from '../components/guest/AlertsSection';
import { DrivesSection } from '../components/guest/DrivesSection';
import { FeedbackSection, isFeedbackKind } from '../components/guest/FeedbackSection';
import type { GuestPick } from '../components/guest/GuestMap';
import { SectionError } from '../components/guest/guestUi';
import { HotlinesSection } from '../components/guest/HotlinesSection';
import { MerchSection } from '../components/guest/MerchSection';
import { NearMe, type Me } from '../components/guest/NearMe';
import { NewsSection } from '../components/guest/NewsSection';
import { PraySection } from '../components/guest/PraySection';
import { PrepareSection } from '../components/guest/PrepareSection';
import { StoriesSection } from '../components/guest/StoriesSection';
import { freshAgain, kept, useOnline, useSavedCopyAt } from '../services/guest/offline';
import { timeAgo } from '../lib/geo';
import { CountBadge } from '../components/ui/CountBadge';
import { PrismMark, PrismWord } from '../components/ui/PrismMark';
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
type Screen = 'map' | 'news' | 'stories' | 'give' | 'more' | 'merch' | 'feedback' | 'hotlines' | 'prepare' | 'alerts' | 'pray';
type Tab = 'map' | 'stories' | 'give' | 'merch' | 'more';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'stories', label: 'Stories', icon: BookOpen },
  { id: 'give', label: 'Give', icon: HandCoins },
  { id: 'merch', label: 'Merch', icon: Shirt },
  { id: 'more', label: 'More', icon: LayoutGrid },
];

/** Each screen's title, its tab, and the id of the section whose big title the app bar watches. */
const SCREENS: Record<Screen, { title: string; tab: Tab; section: string }> = {
  map: { title: 'Live Map', tab: 'map', section: 'map' },
  news: { title: 'Disaster News', tab: 'more', section: 'news' },
  stories: { title: 'PHILReads', tab: 'stories', section: 'stories' },
  give: { title: 'Fundraising', tab: 'give', section: 'drives' },
  more: { title: 'More', tab: 'more', section: 'more' },
  merch: { title: 'Merch', tab: 'merch', section: 'merch' },
  feedback: { title: 'Feedback', tab: 'more', section: 'feedback' },
  hotlines: { title: 'Hotlines', tab: 'more', section: 'hotlines' },
  prepare: { title: 'Be prepared', tab: 'more', section: 'prepare' },
  alerts: { title: 'Alerts', tab: 'more', section: 'alerts' },
  pray: { title: 'Pray with us', tab: 'more', section: 'pray' },
};
/** Screens reached from More on phones: they get a way back, and a reading width. */
const SUB: ReadonlySet<Screen> = new Set(['news', 'feedback', 'hotlines', 'prepare', 'alerts', 'pray']);
/** Wide screens: the portal's own sidebar, in three groups (phones use the tabs, with the rest under More). */
const SIDE: { group: string; items: { id: Screen; label: string; icon: LucideIcon }[] }[] = [
  {
    group: 'Stay safe',
    items: [
      { id: 'map', label: 'Live Map', icon: MapIcon },
      { id: 'news', label: 'Disaster News', icon: Siren },
      { id: 'hotlines', label: 'Hotlines', icon: Phone },
      { id: 'prepare', label: 'Be prepared', icon: ShieldCheck },
      { id: 'alerts', label: 'Alerts', icon: BellRing },
    ],
  },
  {
    group: 'Stories and prayer',
    items: [
      { id: 'stories', label: 'PHILReads', icon: BookOpen },
      { id: 'pray', label: 'Pray with us', icon: HeartHandshake },
    ],
  },
  {
    group: 'Ways to help',
    items: [
      { id: 'give', label: 'Fundraising', icon: HandCoins },
      { id: 'merch', label: 'Merch', icon: Shirt },
      { id: 'feedback', label: 'Feedback', icon: MessageSquareHeart },
    ],
  },
];

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
function MoreRow({ to, href, icon: Icon, title, note, dot }: { to?: string; href?: string; icon: LucideIcon; title: string; note: string; dot?: boolean }) {
  const body = (
    <>
      <span className="icon-chip relative rounded-xl bg-surface-sunken">
        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        {dot && <CountBadge tone="new" className="!bottom-[62%] !left-[68%]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">
          {title}
          {dot && <span className="sr-only"> (something is happening now)</span>}
        </span>
        <span className="block text-xs text-muted">{note}</span>
      </span>
      {href ? <ExternalLink className="h-4 w-4 shrink-0 text-muted" aria-hidden /> : <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />}
    </>
  );
  const cls = 'tap flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface-raised';
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

/** Disaster News, Feedback and the ways out: the More tab (phones; wide screens have them in the sidebar). */
function MoreScreen({ live }: { live: boolean }) {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Stay safe">
        <MoreRow to="/guest/news" icon={Siren} title="Disaster News" note="PHILRADS announcements, typhoons, floods and earthquakes" dot={live} />
        <MoreRow to="/guest/hotlines" icon={Phone} title="Hotlines" note="Emergency numbers, one tap to call" />
        <MoreRow to="/guest/prepare" icon={ShieldCheck} title="Be prepared" note="Go bag, family plan, and what to do in a disaster" />
        <MoreRow to="/guest/alerts" icon={BellRing} title="Alerts" note="Notifications for typhoons near you and urgent news" />
      </ul>
      <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Stay close">
        <MoreRow to="/guest/pray" icon={HeartHandshake} title="Pray with us" note="This week’s prayer points" />
        <MoreRow to="/guest/feedback" icon={MessageSquareHeart} title="Feedback" note="Say thanks, tell us a need, or offer to volunteer" />
      </ul>
      <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-surface">
        <MoreRow href="https://philrads.org/" icon={ExternalLink} title="philrads.org" note="Philippine Relief and Development Services, Inc." />
        <MoreRow to="/" icon={LogIn} title="Staff sign-in" note="For PHILRADS staff with an account" />
      </ul>
      <Emergency />
    </div>
  );
}

function Emergency() {
  return (
    <p className="flex items-center gap-2 text-sm text-ink-soft">
      <Phone className="h-4 w-4 text-status-out" aria-hidden />
      <span>
        In an emergency, call{' '}
        <a href="tel:911" className="font-semibold text-ink underline underline-offset-2">
          911
        </a>
        .
      </span>
    </p>
  );
}

/**
 * Wide screens: the same sidebar as the staff portal (fixed, burgundy highlight that glides between
 * pages), with the guest pages in two groups and the emergency number at the foot.
 */
function GuestSidebar({ screen, live, onWelcome }: { screen: Screen; live: boolean; onWelcome: () => void }) {
  return (
    <aside
      aria-label="Guest navigation"
      className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-hidden border-r border-line/70 bg-page bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0)_40%)] lg:flex"
    >
      <button type="button" onClick={onWelcome} className="flex h-16 shrink-0 items-center gap-3 pl-[1.125rem] text-left" aria-label="Show the welcome">
        <PrismMark className="h-9 w-9 shrink-0 text-ink" />
        <span className="flex min-w-0 flex-col leading-tight" aria-hidden>
          <PrismWord className="font-display text-base tracking-[0.06em] text-ink" />
          <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.2em] text-muted">Guest</span>
        </span>
      </button>
      <nav aria-label="Guest pages" className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SlidingPill className="gloss rounded-xl bg-burgundy-500 ring-1 ring-inset ring-burgundy-400" />
        {SIDE.map((g, gi) => (
          <div key={g.group} role="group" aria-label={g.group} className="flex flex-col gap-1">
            {gi > 0 && <hr className="mx-2 my-2 border-line/70" aria-hidden />}
            {g.items.map((item) => {
              const on = screen === item.id;
              return (
                <Link
                  key={item.id}
                  to={pathOf(item.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`relative z-10 flex h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                    on ? 'font-semibold text-cloud' : 'font-medium text-ink-soft hover:bg-ink/[0.04] hover:text-ink'
                  }`}
                >
                  <span className="relative shrink-0">
                    <item.icon className="h-5 w-5" aria-hidden />
                    {item.id === 'news' && live && <CountBadge tone="new" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.id === 'news' && live && <span className="sr-only">(new alerts)</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="flex shrink-0 flex-col gap-1 border-t border-line/70 px-3 py-3">
        <a href="tel:911" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-ink">
          <Phone className="h-5 w-5 shrink-0 text-status-out" aria-hidden /> Emergency: call 911
        </a>
        <a href="https://philrads.org/" target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-ink">
          <ExternalLink className="h-5 w-5 shrink-0" aria-hidden /> philrads.org
        </a>
      </div>
    </aside>
  );
}

/**
 * Phones: the tab bar docked at the bottom, as phone apps have it. The selected tab's icon sits on
 * the portal's burgundy, which opens out from the middle when you choose it.
 */
function GuestTabBar({ tab, live, onPress }: { tab: Tab; live: boolean; onPress: (t: Tab) => (e: MouseEvent) => void }) {
  return (
    <nav aria-label="Guest" className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-page pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-lg px-1">
        {TABS.map((t) => {
          const on = tab === t.id;
          // Give, the one thing we most hope a guest does, sits raised in the middle on the portal's burgundy.
          if (t.id === 'give')
            return (
              <Link
                key={t.id}
                to={pathOf(t.id)}
                onClick={onPress(t.id)}
                aria-current={on ? 'page' : undefined}
                className="tap group flex min-h-16 flex-1 flex-col items-center justify-end gap-1 pb-2"
              >
                {/* The page-coloured collar lifts it off the bar (a ring would fight .gloss's own shadow). */}
                <span className="-mt-7 rounded-full bg-page p-1">
                  <span
                    className={`gloss grid h-14 w-14 place-items-center rounded-full bg-burgundy-500 transition-transform duration-300 ease-glide group-active:scale-95 ${on ? 'scale-105' : ''}`}
                  >
                    <t.icon className="h-6 w-6 text-cloud" strokeWidth={on ? 2.25 : 2} aria-hidden />
                  </span>
                </span>
                <span className="text-[0.6875rem] font-semibold leading-none text-ink">{t.label}</span>
              </Link>
            );
          return (
            <Link
              key={t.id}
              to={pathOf(t.id)}
              onClick={onPress(t.id)}
              aria-current={on ? 'page' : undefined}
              className="tap flex min-h-16 flex-1 flex-col items-center justify-center gap-1 pb-1 pt-2"
            >
              <span className="relative grid h-8 w-14 place-items-center">
                <span className="gnav-ind gloss absolute inset-0 rounded-full" data-on={on} aria-hidden />
                <t.icon className={`relative h-5 w-5 transition-colors duration-300 ${on ? 'text-cloud' : 'text-ink-soft'}`} strokeWidth={on ? 2.25 : 1.75} aria-hidden />
                {t.id === 'more' && live && <CountBadge tone="new" className="!bottom-[60%] !left-[62%]" />}
              </span>
              <span className={`text-[0.6875rem] leading-none transition-colors duration-300 ${on ? 'font-semibold text-ink' : 'font-medium text-ink-soft'}`}>{t.label}</span>
              {t.id === 'more' && live && <span className="sr-only">(new alerts in Disaster News)</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * The guest door from the sign-in screen: no account, nothing private. Where PHILRADS works and
 * what is happening now (Live Map, Disaster News), its stories (PHILReads), and ways to help
 * (Fundraising, Merch, Feedback). Staff edit the content on the Guest page in the portal.
 */
export function GuestPage() {
  const { screen: param = 'map' } = useParams();
  const location = useLocation();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const screen: Screen = isScreen(param) ? param : 'map';
  const meta = SCREENS[screen];

  // Everything loads once, so moving between tabs is instant; each keeps a copy on the phone for when the signal goes.
  const overview = useAsyncData(useCallback(() => kept('overview', () => guestService.overview()), []));
  const feed = useAsyncData(useCallback(() => kept('hazards', () => guestService.hazards()), []));
  const stories = useAsyncData(useCallback(() => kept('stories', () => guestService.stories()), []));
  const notes = useAsyncData(useCallback(() => kept('announcements', () => guestService.announcements()), []));
  const facebook = useAsyncData(useCallback(() => kept('facebook', () => guestService.facebook(), (f) => !f.posts.length), []));
  const drives = useAsyncData(useCallback(() => kept('drives', () => guestService.drives()), []));
  const merch = useAsyncData(useCallback(() => kept('merch', () => guestService.merch()), []));
  const hotlines = useAsyncData(useCallback(() => kept('hotlines', () => guestService.hotlines()), []));
  const prayers = useAsyncData(useCallback(() => kept('prayers', () => guestService.prayers()), []));

  // Back online after showing saved copies: load everything afresh.
  const online = useOnline();
  const savedAt = useSavedCopyAt();
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current && savedAt) {
      freshAgain();
      for (const d of [overview, feed, stories, notes, facebook, drives, merch, hotlines, prayers]) d.reload();
    }
    wasOnline.current = online;
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const [layers, setLayers] = useState({ work: true, places: true, hazards: true });
  const [pick, setPick] = useState<GuestPick>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const showMe = useCallback((m: Me | null) => {
    setMe(m);
    if (m) setFocus({ ...m, key: Date.now() });
  }, []);
  const hazards = feed.data?.hazards ?? [];
  // News has something now: an alert happening, or an urgent PHILRADS announcement (a dot, as portal news gets).
  const live = hazards.some((h) => h.current) || (notes.data ?? []).some((a) => a.level === 'urgent');
  // The map keeps to what matters now: ongoing hazards and those from the last 30 days.
  const recent = useMemo(() => hazards.filter((h) => h.current || Date.now() - Date.parse(h.to ?? h.from) < 30 * 86_400_000), [hazards]);
  const programsShown = useMemo(() => PROGRAMS.filter((p) => overview.data?.sites.some((s) => s.program === p.key)), [overview.data]);
  const onPick = useCallback((p: GuestPick) => setPick(p), []);

  // First visit only, and not over a shared link to a drive or story.
  const [welcome, setWelcome] = useState(() => !welcomedBefore() && screen === 'map' && !location.hash && !search.get('story') && !search.get('drive'));
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
  useEffect(() => {
    document.title = `${meta.title} · PRISM Guest`;
  }, [meta.title]);
  useLayoutEffect(() => {
    shown.current = screen;
    if (!location.hash) window.scrollTo({ top: scrolls.current.get(screen) ?? 0, behavior: 'instant' });
    // A hazard picked from News flies the map there once; coming back to the map later doesn't fly again.
    if (screen !== 'map') setFocus(null);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arriving on a shared drive or prayer link: go to it once the list is in.
  const driveParam = search.get('drive');
  useEffect(() => {
    const target = screen === 'give' && drives.status === 'success' ? (driveParam ? `drive-${driveParam}` : location.hash.startsWith('#drive-') ? location.hash.slice(1) : null) : screen === 'pray' && prayers.status === 'success' && location.hash.startsWith('#prayer-') ? location.hash.slice(1) : null;
    if (target) {
      const t = setTimeout(() => go(target), 150);
      return () => clearTimeout(t);
    }
  }, [drives.status, prayers.status, screen, location.hash, driveParam]);

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
  const sub = SUB.has(screen);
  const about = search.get('about');

  const hazardsShown = layers.hazards ? (pick?.type === 'hazard' && !recent.some((h) => h.id === pick.id) ? [...recent, ...hazards.filter((h) => h.id === pick.id)] : recent) : [];

  let body: ReactNode;
  if (screen === 'map')
    body = (
      <section aria-labelledby="guest-title" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-x-8">
        {/* Phones: what it shows, the map, then what you pressed. Wide (1280+): the map on the left, the rest beside it. */}
        <div className="flex flex-col gap-4 xl:col-start-2 xl:row-start-1">
          {overview.data ? <Reach totals={overview.data.totals} /> : <p className="text-sm text-ink-soft">Where PHILRADS has worked, its offices and response sites, and hazards affecting the Philippines now.</p>}
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
        </div>
        <div className="relative isolate h-[24rem] max-h-[72dvh] overflow-hidden rounded-2xl border border-line bg-surface-sunken sm:h-[30rem] xl:max-h-none xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:h-[calc(100dvh-12.5rem)] xl:min-h-[32rem]">
          {overview.status === 'error' ? (
            <div className="grid h-full place-items-center p-6">
              <SectionError message={overview.error.message} onRetry={overview.reload} />
            </div>
          ) : (
            <Suspense fallback={<div className="skeleton h-full w-full rounded-none" />}>
              <GuestMap sites={layers.work ? overview.data?.sites ?? [] : []} places={layers.places ? overview.data?.places ?? [] : []} hazards={hazardsShown} pick={pick} onPick={onPick} focus={focus} me={me} />
            </Suspense>
          )}
        </div>
        <div className="flex flex-col gap-3 xl:col-start-2 xl:row-start-2">
          <NearMe
            places={overview.data?.places ?? []}
            me={me}
            onMe={showMe}
            onShow={(p) => {
              setLayers((l) => ({ ...l, places: true }));
              setPick({ type: 'place', id: p.id });
              setFocus({ lat: p.lat, lng: p.lng, key: Date.now() });
            }}
          />
          <Picked pick={pick} overview={overview.data} hazards={hazards} onClose={() => setPick(null)} />
          {!pick && <p className="hidden text-sm text-muted xl:block">Press a dot, a place or a hazard on the map to see what it is.</p>}
          {layers.work && programsShown.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted xl:flex-col" aria-label="Dot colours">
              {programsShown.map((p) => (
                <li key={p.key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
                  {p.label}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">Staff locations are never shown here.</p>
        </div>
      </section>
    );
  else if (screen === 'news') body = <NewsSection feed={feed} notes={notes.data ?? []} facebook={facebook.data ?? null} onRetry={feed.reload} onShow={showHazard} />;
  else if (screen === 'stories') body = <StoriesSection stories={stories} onRetry={stories.reload} />;
  else if (screen === 'give') body = <DrivesSection drives={drives} onRetry={drives.reload} />;
  else if (screen === 'merch') body = <MerchSection merch={merch} onRetry={merch.reload} />;
  else if (screen === 'hotlines') body = <HotlinesSection hotlines={hotlines} onRetry={hotlines.reload} />;
  else if (screen === 'prepare') body = <PrepareSection />;
  else if (screen === 'alerts') body = <AlertsSection />;
  else if (screen === 'pray') body = <PraySection prayers={prayers} onRetry={prayers.reload} />;
  else if (screen === 'feedback') body = <FeedbackSection key={about ?? ''} initialKind={isFeedbackKind(about) ? about : undefined} />;
  else body = <MoreScreen live={live} />;

  // Reading pages keep a comfortable line length; drives and merch use the width.
  const measure = SUB.has(screen) || screen === 'stories' ? 'max-w-3xl' : '';

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-xl bg-uplift px-4 py-2 font-semibold text-onaccent focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <GuestSidebar screen={screen} live={live} onWelcome={() => setWelcome(true)} />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        {/* The top bar, as in the portal: on phones the mark (or a way back), and Sign in on the right. */}
        <header className="sticky top-0 z-30 border-b border-ink/[0.05] bg-page">
          <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
            {sub && (
              <Link to="/guest/more" className="icon-btn lg:hidden" aria-label="Back to More">
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </Link>
            )}
            <button type="button" onClick={() => setWelcome(true)} className="flex items-center gap-2 lg:hidden" aria-label="Show the welcome">
              <PrismMark className="h-8 w-8 text-ink" />
              <PrismWord className="font-display text-sm tracking-[0.06em] text-ink" />
              <span className="text-[0.6875rem] font-semibold text-muted">Guest</span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Link to="/guest/feedback?about=volunteer" className="chip hidden gap-1.5 sm:inline-flex">
                <HandHeart className="h-4 w-4" aria-hidden /> Volunteer
              </Link>
              <Link to="/" className="chip gap-1.5">
                <LogIn className="h-4 w-4" aria-hidden /> Sign in
              </Link>
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[100rem] flex-1 px-4 pb-10 sm:px-6" style={{ viewTransitionName: 'page' }}>
          <div className="flex flex-wrap items-end justify-between gap-3 pb-6 pt-3">
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted">
                PHILRADS <span aria-hidden className="mx-1 text-ink-mute/50">/</span> <span className="text-ink-soft">{sub ? 'More' : 'Guest'}</span>
              </p>
              <h1 id="guest-title" className="mt-1 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
                {meta.title}
              </h1>
            </div>
            {sample && <SampleBadge />}
          </div>
          {(!online || savedAt) && (
            <p role="status" className="mb-5 flex items-start gap-2.5 rounded-xl border border-status-low/40 bg-status-low/10 px-4 py-3 text-sm text-ink">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-status-low" aria-hidden />
              <span>
                {online ? 'PHILRADS can’t be reached right now.' : 'You’re offline.'}{' '}
                {savedAt ? `Showing what was saved ${timeAgo(savedAt)}.` : 'What you’ve opened stays on screen.'} Hotlines and Be prepared work without a signal.
              </span>
            </p>
          )}
          {/* Keyed by screen so each one fades in, as portal pages do. */}
          <div key={screen} className={`animate-fade-in ${measure}`}>
            {body}
          </div>
        </main>
        <footer className="app-footer flex flex-wrap items-center justify-between gap-2 border-t border-line/50 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 text-xs text-muted sm:px-6 lg:pb-4">
          <span>Philippine Relief and Development Services, Inc. · PRISM Guest</span>
          <a href="https://philrads.org/" target="_blank" rel="noopener noreferrer" className="font-semibold text-uplift hover:underline">
            philrads.org
          </a>
        </footer>
      </div>

      <GuestTabBar tab={meta.tab} live={live} onPress={tabPress} />
      <WelcomeDialog open={welcome} onClose={closeWelcome} />
    </div>
  );
}
