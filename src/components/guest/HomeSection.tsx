import { Link } from 'react-router-dom';
import { BellRing, BookOpen, ChevronRight, HandCoins, HeartHandshake, Lock, MapPin, Phone, ShieldCheck, Shirt, Siren, type LucideIcon } from 'lucide-react';
import { useGuestAccount } from '../../services/guest/account';
import { amount, type DonationDrive, type GuestAnnouncement, type GuestOverview, type GuestPrayer, type GuestStory, type MerchItem } from '../../services/guest/guestService';
import type { Hazard } from '../../services/guest/hazards';
import { formatNumber } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Picture } from './guestUi';
import { GoogleButton } from './SignInPrompt';
import { OPEN_STORIES } from './StoriesSection';
import { Faces } from './WhoIsHere';

const hour = () => new Date().getHours();
const greeting = () => (hour() < 12 ? 'Good morning' : hour() < 18 ? 'Good afternoon' : 'Good evening');

function SectionHead({ id, title, to, more }: { id: string; title: string; to: string; more: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-lg font-bold tracking-tight text-ink">
        {title}
      </h2>
      <Link to={to} className="hit inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-sm font-semibold text-uplift hover:underline">
        {more} <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

/** The opening: PHILRADS's own field photos behind one sentence, and the two things to do. */
function Hero({ totals }: { totals: GuestOverview['totals'] | undefined }) {
  const { me } = useGuestAccount();
  const people = totals ? totals.individuals || totals.households * 4 : 0;
  return (
    <section aria-labelledby="home-title" className="relative isolate -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl">
      <img src="/brand/sign-in-red-1280.webp" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(18,7,9,0.94)_0%,rgba(28,10,14,0.86)_55%,rgba(60,12,20,0.45)_100%)]" aria-hidden />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-9 sm:px-9 sm:pb-10 sm:pt-12 lg:px-12">
        {me && (
          <p className="flex items-center gap-2.5 text-sm font-semibold text-cloud/90">
            <Avatar initials={me.initials} src={me.avatar} color={me.color} size="sm" ring="ring-2 ring-white/20" />
            {greeting()}, {me.name}
          </p>
        )}
        <h1 id="home-title" className="max-w-[17ch] font-display text-[2.125rem] leading-[1.04] tracking-[-0.01em] text-cloud sm:text-5xl lg:text-[3.5rem]">
          See where we’re helping, and how you can help.
        </h1>
        <p className="max-w-[46ch] text-[0.975rem] leading-relaxed text-cloud/80 sm:text-base">
          Philippine Relief and Development Services brings relief to families after typhoons, floods and earthquakes, and stays to help them rebuild.
          {totals && totals.activities > 0 && (
            <>
              {' '}
              {totals.since ? `Since ${totals.since}: ` : 'So far: '}
              <strong className="font-semibold text-cloud">{formatNumber(totals.activities)} activities</strong> in{' '}
              <strong className="font-semibold text-cloud">{formatNumber(totals.places)} places</strong>
              {people > 0 && (
                <>
                  , <strong className="font-semibold text-cloud">{totals.individuals ? formatNumber(people) : `about ${formatNumber(people)}`} people</strong> reached
                </>
              )}
              .
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/guest/give" className="btn-primary">
            <HandCoins className="h-4 w-4" aria-hidden /> Give
          </Link>
          <Link to="/guest/map" className="btn border border-white/25 bg-white/10 text-cloud hover:bg-white/15">
            <MapPin className="h-4 w-4" aria-hidden /> Find the nearest site
          </Link>
        </div>
      </div>
    </section>
  );
}

/** What is going on now: urgent PHILRADS news first, then hazards happening now. */
function RightNow({ hazards, notes }: { hazards: Hazard[]; notes: GuestAnnouncement[] }) {
  const urgent = notes.filter((n) => n.level === 'urgent').slice(0, 1);
  const now = hazards.filter((h) => h.current).sort((a, b) => (a.level === 'red' ? -1 : b.level === 'red' ? 1 : 0)).slice(0, 2 - urgent.length);
  if (!urgent.length && !now.length) return null;
  return (
    <section aria-label="Right now" className="flex flex-col gap-2">
      {urgent.map((n) => (
        <Link key={n.id} to="/guest/news" className="tap flex items-center gap-3 rounded-2xl border border-status-out/40 bg-status-out/10 px-4 py-3 transition-colors hover:bg-status-out/15">
          <Siren className="h-5 w-5 shrink-0 text-status-out" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-status-out">From PHILRADS, urgent</span>
            <span className="block truncate font-semibold text-ink">{n.title}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        </Link>
      ))}
      {now.map((h) => (
        <Link
          key={h.id}
          to="/guest/news"
          className={`tap flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${h.level === 'red' ? 'border-status-out/40 bg-status-out/10 hover:bg-status-out/15' : 'border-status-low/40 bg-status-low/10 hover:bg-status-low/15'}`}
        >
          <Siren className={`h-5 w-5 shrink-0 ${h.level === 'red' ? 'text-status-out' : 'text-status-low'}`} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className={`block text-xs font-semibold ${h.level === 'red' ? 'text-status-out' : 'text-status-low'}`}>Happening now</span>
            <span className="block truncate font-semibold text-ink">{h.title}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        </Link>
      ))}
    </section>
  );
}

function Fundraiser({ d }: { d: DonationDrive }) {
  const pct = Math.min(100, Math.round((d.raised / d.goal) * 100));
  return (
    <Link to={`/guest/give?drive=${d.id}`} className="tap group grid overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-ink-mute sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <Picture src={d.coverUrl} alt="" icon={HandCoins} className="aspect-[16/9] w-full sm:aspect-auto sm:h-full" />
      <span className="flex flex-col gap-3 p-5">
        <span className="text-lg font-bold leading-snug text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{d.title}</span>
        {d.impactNote && <span className="text-sm text-ink-soft">{d.impactNote}</span>}
        <span className="mt-auto flex flex-col gap-1.5">
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Raised so far">
            <span className="block h-full rounded-full bg-burgundy-500" style={{ width: `${pct}%` }} />
          </span>
          <span className="flex justify-between gap-2 text-xs tabular-nums text-ink-soft">
            <span>
              <strong className="font-semibold text-ink">{amount(d.raised, d.unit)}</strong> of {amount(d.goal, d.unit)}
            </span>
            <span>{pct}%</span>
          </span>
        </span>
        <span className="btn-primary self-start">
          <HandCoins className="h-4 w-4" aria-hidden /> Give to this
        </span>
      </span>
    </Link>
  );
}

function Stories({ stories }: { stories: GuestStory[] }) {
  const { unlocked } = useGuestAccount();
  const [lead, ...rest] = stories.slice(0, 3);
  if (!lead) return null;
  const lockedAt = (i: number) => !unlocked && i >= OPEN_STORIES;
  return (
    <section aria-labelledby="home-stories">
      <SectionHead id="home-stories" title="Stories from the field" to="/guest/stories" more="See all" />
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <Link to={`/guest/stories?story=${lead.id}`} className="tap group flex flex-col gap-3">
          <Picture src={lead.coverUrl} alt="" icon={BookOpen} className="aspect-[16/10] w-full rounded-2xl" />
          <span className="font-serif text-[1.5rem] font-semibold leading-[1.15] text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{lead.title}</span>
          {lead.summary && <span className="line-clamp-3 font-serif text-[1.0625rem] leading-relaxed text-ink-soft">{lead.summary}</span>}
        </Link>
        <ul className="flex flex-col divide-y divide-line/70 md:border-l md:border-line/70 md:pl-4">
          {rest.map((s, i) => (
            <li key={s.id}>
              <Link to={`/guest/stories?story=${s.id}`} className="tap group flex gap-3 py-3 first:pt-0">
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg font-semibold leading-snug text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{s.title}</span>
                  {lockedAt(i + 1) ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
                      <Lock className="h-3 w-3" aria-hidden /> Sign in to read
                    </span>
                  ) : (
                    s.summary && <span className="mt-0.5 line-clamp-2 block font-serif text-[0.975rem] leading-snug text-ink-soft">{s.summary}</span>
                  )}
                </span>
                {s.coverUrl && <Picture src={s.coverUrl} alt="" icon={BookOpen} className="h-16 w-20 shrink-0 rounded-xl" />}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SafetyRow({ to, icon: Icon, title, note }: { to: string; icon: LucideIcon; title: string; note: string }) {
  return (
    <li>
      <Link to={to} className="tap flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface-raised">
        <span className="icon-chip rounded-xl bg-surface-sunken">
          <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{title}</span>
          <span className="block text-xs text-muted">{note}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

/** For guests not signed in: what signing in opens, who's here now, and the one button. */
function Join() {
  const { here } = useGuestAccount();
  return (
    <section aria-labelledby="home-join" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Faces max={4} />
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink tabular-nums">{here.count === 1 ? '1 person' : `${formatNumber(here.count)} people`}</span> here now
        </p>
      </div>
      <h2 id="home-join" className="mt-4 text-xl font-bold leading-snug tracking-tight text-ink">
        Join the PHILRADS community
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-soft">
        {['Read every story from our responses', 'Pray with us, and see who prayed', 'See where each fundraiser’s gifts went', 'Your own profile, and who’s here with you'].map((t) => (
          <li key={t} className="flex gap-2.5">
            <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-burgundy-400" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
      <GoogleButton className="mt-5 w-full sm:w-auto" />
      <p className="mt-2.5 text-xs text-muted">Free. We only use your name and picture, and never post for you.</p>
    </section>
  );
}

function Pray({ prayers }: { prayers: GuestPrayer[] }) {
  const p = prayers[0];
  if (!p) return null;
  const total = prayers.reduce((n, x) => n + x.prayedCount, 0);
  return (
    <Link to="/guest/pray" className="tap group flex flex-col gap-2 rounded-3xl border border-line bg-surface p-5 transition-colors hover:border-ink-mute sm:p-6">
      <span className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <HeartHandshake className="h-4 w-4 text-burgundy-400" aria-hidden /> Pray with us this week
      </span>
      <span className="font-serif text-xl font-semibold leading-snug text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{p.title}</span>
      {total > 0 && <span className="text-xs tabular-nums text-muted">{total === 1 ? '1 prayer so far' : `${formatNumber(total)} prayers so far`}</span>}
    </Link>
  );
}

function Merch({ items }: { items: MerchItem[] }) {
  const shown = items.filter((m) => m.inStock).slice(0, 3);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="home-merch">
      <SectionHead id="home-merch" title="Wear it, fund it" to="/guest/merch" more="See all" />
      <ul className="grid grid-cols-3 gap-3">
        {shown.map((m) => (
          <li key={m.id}>
            <Link to="/guest/merch" className="tap group flex flex-col gap-2">
              <Picture src={m.imageUrl} alt="" icon={Shirt} className="aspect-square w-full rounded-2xl" />
              <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink group-hover:underline">{m.name}</span>
              {m.price !== null && <span className="-mt-1 text-xs tabular-nums text-ink-soft">{amount(m.price, 'PHP')}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The guest home: what PHILRADS does, what's happening now, the fundraiser to give to, stories,
 * ways to stay safe, prayer, and (for guests not signed in) the invitation to join.
 */
export function HomeSection({
  overview,
  hazards,
  notes,
  stories,
  drives,
  prayers,
  merch,
}: {
  overview: GuestOverview | undefined;
  hazards: Hazard[];
  notes: GuestAnnouncement[];
  stories: GuestStory[];
  drives: DonationDrive[];
  prayers: GuestPrayer[];
  merch: MerchItem[];
}) {
  const { unlocked } = useGuestAccount();
  const open = drives.filter((d) => d.status === 'open');
  // The one closest to its goal is the one a gift helps finish.
  const featured = [...open].sort((a, b) => b.raised / b.goal - a.raised / a.goal)[0];
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <Hero totals={overview?.totals} />
      <RightNow hazards={hazards} notes={notes} />
      <div className="grid gap-8 sm:gap-10 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
          {featured && (
            <section aria-labelledby="home-give">
              <SectionHead id="home-give" title="Give where it’s needed" to="/guest/give" more="See all" />
              <Fundraiser d={featured} />
            </section>
          )}
          <Stories stories={stories} />
          <Merch items={merch} />
        </div>
        <aside className="flex flex-col gap-6" aria-label="Stay safe, pray and join">
          {!unlocked && <Join />}
          <section aria-labelledby="home-safe">
            <h2 id="home-safe" className="mb-3 text-lg font-bold tracking-tight text-ink">
              Stay safe
            </h2>
            <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-surface">
              <SafetyRow to="/guest/map" icon={MapPin} title="Nearest site" note="PHILRADS sites near you, with directions" />
              <SafetyRow to="/guest/hotlines" icon={Phone} title="Hotlines" note="Emergency numbers, one tap to call" />
              <SafetyRow to="/guest/prepare" icon={ShieldCheck} title="Be prepared" note="Go bag and family plan" />
              <SafetyRow to="/guest/alerts" icon={BellRing} title="Alerts" note="Typhoons near you, on your phone" />
            </ul>
          </section>
          <Pray prayers={prayers} />
        </aside>
      </div>
    </div>
  );
}
