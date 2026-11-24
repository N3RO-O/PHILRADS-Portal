import { useState } from 'react';
import { Activity, ExternalLink, Flame, MapPin, Megaphone, Mountain, Phone, Sun, Waves, Wind, type LucideIcon } from 'lucide-react';
import type { Hazard, HazardFeed, HazardKind, HazardLevel } from '../../services/guest/hazards';
import type { FacebookFeed, FacebookPost } from '../../services/guest/facebook';
import { announcementLevelLabel, type AnnouncementLevel, type GuestAnnouncement } from '../../services/guest/guestService';
import { timeAgo } from '../../lib/geo';
import { formatShortInstant } from '../../lib/format';
import type { AsyncState } from '../../hooks/useAsyncData';
import { GuestSection, RowsLoading, SectionError } from './guestUi';

const KIND_ICON: Record<HazardKind, LucideIcon> = { typhoon: Wind, flood: Waves, earthquake: Activity, volcano: Mountain, drought: Sun, wildfire: Flame };
const LEVEL: Record<HazardLevel, { label: string; dot: string; text: string }> = {
  red: { label: 'Red alert', dot: 'bg-status-out', text: 'text-status-out' },
  orange: { label: 'Orange alert', dot: 'bg-status-low', text: 'text-status-low' },
  green: { label: 'Green alert', dot: 'bg-status-in', text: 'text-status-in' },
};

/** Where to check before acting: the government agencies that issue the official warnings. */
const OFFICIAL = [
  { name: 'PAGASA', what: 'Typhoon bulletins, rainfall and flood warnings', href: 'https://www.pagasa.dost.gov.ph/' },
  { name: 'PHIVOLCS', what: 'Earthquake, tsunami and volcano bulletins', href: 'https://www.phivolcs.dost.gov.ph/' },
  { name: 'NDRRMC', what: 'National disaster situation reports', href: 'https://ndrrmc.gov.ph/' },
];

const NOTE_STYLE: Record<AnnouncementLevel, { card: string; label: string }> = {
  urgent: { card: 'border-status-out/50 bg-status-out/10', label: 'text-status-out' },
  advisory: { card: 'border-status-low/45 bg-status-low/10', label: 'text-status-low' },
  update: { card: 'border-line bg-surface-sunken', label: 'text-ink-soft' },
};

/** PHILRADS's own posts, written by staff in the portal: above the alerts, urgent ones first. */
function Announcements({ list }: { list: GuestAnnouncement[] }) {
  if (!list.length) return null;
  return (
    <div className="mb-7">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Megaphone className="h-4 w-4 text-ink-soft" aria-hidden /> From PHILRADS
      </h3>
      <ul className="mt-2.5 flex flex-col gap-2.5">
        {list.map((a) => {
          const look = NOTE_STYLE[a.level];
          return (
            <li key={a.id} className={`rounded-2xl border px-4 py-3.5 ${look.card}`}>
              <p className={`text-xs font-bold ${look.label}`}>{announcementLevelLabel(a.level)}</p>
              <p className="mt-0.5 font-semibold leading-snug text-ink">{a.title}</p>
              {a.body && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{a.body}</p>}
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {a.area && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden /> {a.area}
                  </span>
                )}
                {a.publishedAt && <span>Posted {timeAgo(a.publishedAt)}</span>}
                {a.linkUrl && (
                  <a className="link" href={a.linkUrl} target="_blank" rel="noopener noreferrer">
                    More details <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function when(h: Hazard) {
  if (h.kind === 'earthquake') return timeAgo(h.from);
  if (h.current) return `Since ${formatShortInstant(h.from)}`;
  return h.to && h.to.slice(0, 10) !== h.from.slice(0, 10) ? `${formatShortInstant(h.from)} to ${formatShortInstant(h.to)}` : formatShortInstant(h.from);
}

function HazardRow({ h, onShow }: { h: Hazard; onShow: (h: Hazard) => void }) {
  const Icon = KIND_ICON[h.kind];
  const level = LEVEL[h.level];
  return (
    <li className="flex gap-3.5 py-3.5">
      <span className="icon-chip mt-0.5 rounded-xl bg-surface-sunken">
        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-semibold text-ink">{h.title}</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${level.text}`}>
            <span className={`h-2 w-2 rounded-full ${level.dot}`} aria-hidden />
            {level.label}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">{h.detail}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{when(h)}</span>
          <button type="button" className="link" onClick={() => onShow(h)}>
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Show on map
          </button>
          <a className="link" href={h.url} target="_blank" rel="noopener noreferrer">
            {h.source} report <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </p>
      </div>
    </li>
  );
}

/**
 * Disaster News: what is affecting the Philippines now and in the last few months, from GDACS
 * and USGS, with the official agencies to check before acting.
 */
/** One Facebook post: its picture (top on phones, beside the text on wider screens), the text, a link. */
function FacebookCard({ p }: { p: FacebookPost }) {
  const [broken, setBroken] = useState(false);
  const [full, setFull] = useState(false);
  const long = p.text.length > 260 || p.text.split('\n').length > 4;
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface sm:flex">
      {p.image && !broken && (
        <a href={p.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden className="relative block bg-surface-sunken sm:min-h-[10rem] sm:w-56 sm:shrink-0">
          <img
            src={p.image}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="aspect-[16/10] w-full object-cover sm:absolute sm:inset-0 sm:aspect-auto sm:h-full"
          />
        </a>
      )}
      <div className="flex min-w-0 flex-1 flex-col px-4 py-3.5">
        <p className={`whitespace-pre-line break-words text-sm leading-relaxed text-ink ${full ? '' : 'line-clamp-4'}`}>{p.text}</p>
        {long && (
          <button type="button" className="mt-1 self-start text-xs font-semibold text-ink-soft hover:text-ink" onClick={() => setFull((f) => !f)} aria-expanded={full}>
            {full ? 'Show less' : 'Read more'}
          </button>
        )}
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted">
          {p.postedAt && <span>Posted {timeAgo(p.postedAt)}</span>}
          <a className="link" href={p.url} target="_blank" rel="noopener noreferrer">
            Open on Facebook <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </p>
      </div>
    </li>
  );
}

/** PHILRADS's latest Facebook posts (through rss.app); nothing at all until the feed is set up. */
function FacebookPosts({ feed }: { feed: FacebookFeed | null }) {
  const [all, setAll] = useState(false);
  if (!feed?.posts.length) return null;
  const shown = all ? feed.posts : feed.posts.slice(0, 3);
  return (
    <div className="mt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">On our Facebook page</h3>
        <a className="link text-xs" href={feed.page} target="_blank" rel="noopener noreferrer">
          See all on Facebook <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>
      <ul className="mt-2.5 flex flex-col gap-3">
        {shown.map((p) => (
          <FacebookCard key={p.id} p={p} />
        ))}
      </ul>
      {feed.posts.length > 3 && (
        <button type="button" className="chip mt-3" onClick={() => setAll((a) => !a)} aria-expanded={all}>
          {all ? 'Show fewer' : `Show ${feed.posts.length - 3} more`}
        </button>
      )}
    </div>
  );
}

export function NewsSection({
  feed,
  notes,
  facebook,
  onRetry,
  onShow,
}: {
  feed: AsyncState<HazardFeed>;
  /** Staff announcements; if they can't load, the alerts still show. */
  notes: GuestAnnouncement[];
  /** PHILRADS's Facebook posts; null while loading or when the feed isn't set up. */
  facebook: FacebookFeed | null;
  onRetry: () => void;
  onShow: (h: Hazard) => void;
}) {
  const [more, setMore] = useState(false);
  const hazards = feed.data?.hazards ?? [];
  const now = hazards.filter((h) => h.current);
  const earlier = hazards.filter((h) => !h.current).sort((a, b) => Date.parse(b.from) - Date.parse(a.from));
  const shownEarlier = more ? earlier : earlier.slice(0, 4);

  return (
    <GuestSection
      id="news"
      title="Disaster News"
      lead="Announcements and posts from PHILRADS, and typhoons, floods, earthquakes and volcanoes affecting the Philippines from international alert systems. Always follow the official advisories below."
    >
      <Announcements list={notes} />
      {feed.status === 'loading' ? (
        <>
          <RowsLoading />
          <FacebookPosts feed={facebook} />
        </>
      ) : feed.status === 'error' ? (
        <>
          <SectionError message={feed.error.message || 'Disaster news could not be loaded.'} onRetry={onRetry} />
          <FacebookPosts feed={facebook} />
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-ink">Happening now</h3>
          {now.length ? (
            <ul className="divide-y divide-line/70">
              {now.map((h) => (
                <HazardRow key={h.id} h={h} onShow={onShow} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink-soft">No active alerts for the Philippines right now.</p>
          )}
          <FacebookPosts feed={facebook} />
          {earlier.length > 0 && (
            <>
              <h3 className="mt-7 text-sm font-semibold text-ink">Earlier alerts</h3>
              <ul className="divide-y divide-line/70">
                {shownEarlier.map((h) => (
                  <HazardRow key={h.id} h={h} onShow={onShow} />
                ))}
              </ul>
              {earlier.length > 4 && (
                <button type="button" className="chip mt-1" onClick={() => setMore((m) => !m)} aria-expanded={more}>
                  {more ? 'Show fewer' : `Show ${earlier.length - 4} more`}
                </button>
              )}
            </>
          )}
          <p className="mt-4 text-xs text-muted">
            From{' '}
            <a className="underline underline-offset-2 hover:text-ink" href="https://www.gdacs.org/" target="_blank" rel="noopener noreferrer">
              GDACS
            </a>{' '}
            and{' '}
            <a className="underline underline-offset-2 hover:text-ink" href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer">
              USGS
            </a>
            , checked {timeAgo(feed.data.checkedAt)}.
            {feed.data.missing.length > 0 && ` ${feed.data.missing.join(' and ')} didn't answer this time.`}
          </p>
        </>
      )}

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {OFFICIAL.map((o) => (
          <a key={o.name} href={o.href} target="_blank" rel="noopener noreferrer" className="tile tap group flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-surface">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {o.name} <ExternalLink className="h-3 w-3 text-muted group-hover:text-ink" aria-hidden />
            </span>
            <span className="text-xs text-muted">{o.what}</span>
          </a>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
        <Phone className="h-4 w-4 text-status-out" aria-hidden />
        <span>
          In an emergency, call{' '}
          <a href="tel:911" className="font-semibold text-ink underline underline-offset-2">
            911
          </a>
          .
        </span>
      </p>
    </GuestSection>
  );
}
