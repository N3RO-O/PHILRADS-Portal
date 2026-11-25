import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, BellRing, BookOpen, ChevronLeft, ChevronRight, Flame, HandCoins, HeartHandshake, Lock, MapPin, Megaphone, MessageCircle, Mountain, Newspaper, Phone, Plus, ShieldCheck, Shirt, Siren, Sparkles, Sun, TrendingUp, Waves, Wind, type LucideIcon } from 'lucide-react';
import { forumService } from '../../services';
import { useAuth } from '../auth/AuthProvider';
import { useGuestAccount } from '../../services/guest/account';
import { amount, peso, type DonationDrive, type GuestAnnouncement, type GuestPrayer, type GuestStory, type MerchItem } from '../../services/guest/guestService';
import { FORUM_PAGE, type ForumPost, type ForumSort, type ForumTopic } from '../../services/guest/forum';
import type { Hazard, HazardKind } from '../../services/guest/hazards';
import type { FacebookPost } from '../../services/guest/facebook';
import { timeAgo } from '../../lib/geo';
import { formatNumber } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { PrismMark } from '../ui/PrismMark';
import { Picture, ShareButton } from './guestUi';
import { ActionButton, Byline, ComposerSheet, DEFAULT_TOPICS, TopicTag, Upvote, topicColor, useJoinPrompt } from './forumUi';
import { GoogleButton } from './SignInPrompt';
import { OPEN_STORIES } from './StoriesSection';
import { Faces } from './WhoIsHere';

const SORTS: { key: ForumSort; label: string; icon: LucideIcon }[] = [
  { key: 'hot', label: 'Hot', icon: Flame },
  { key: 'new', label: 'New', icon: Sparkles },
  { key: 'top', label: 'Top', icon: TrendingUp },
];
const isSort = (s: string | null): s is ForumSort => s === 'hot' || s === 'new' || s === 'top';

/** What the feed shows: community posts, and PHILRADS's own stories, prayer points, fundraisers and news among them. */
type Item =
  | { type: 'post'; at: string; post: ForumPost }
  | { type: 'story'; at: string; story: GuestStory; index: number }
  | { type: 'prayer'; at: string; prayer: GuestPrayer }
  | { type: 'drive'; at: string; drive: DonationDrive }
  | { type: 'note'; at: string; note: GuestAnnouncement };
const OFFICIAL_TOPIC: Record<Exclude<Item['type'], 'post'>, string> = { story: 'stories', prayer: 'prayer', drive: 'fundraising', note: 'updates' };
const topicOf = (i: Item) => (i.type === 'post' ? i.post.topic : OFFICIAL_TOPIC[i.type]);

/** Where the merch carousel sits in the feed. */
const MERCH_AFTER = 4;

const rowCls = 'relative flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-ink/[0.025] sm:px-5';

/** The community's front: its banner, its name, who's here, and the two things to do. */
function Banner({ onCreate }: { onCreate: () => void }) {
  const { here } = useGuestAccount();
  return (
    <header className="-mx-4 sm:-mx-6">
      <div className="relative h-24 overflow-hidden sm:h-32 lg:h-40">
        <img src="/brand/sign-in-red-1280.webp" alt="" className="h-full w-full object-cover object-[center_40%]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(28,10,14,0.15),rgba(28,10,14,0.7))]" aria-hidden />
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 pb-3 sm:px-6">
        <span className="relative z-10 -mt-8 grid h-16 w-16 shrink-0 place-items-center rounded-full bg-burgundy-600 ring-4 ring-page sm:-mt-10 sm:h-20 sm:w-20" aria-hidden>
          <PrismMark className="h-10 w-10 text-cloud sm:h-12 sm:w-12" />
        </span>
        <div className="min-w-0 flex-1 pt-3">
          <h1 id="guest-title" className="text-[1.375rem] font-bold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
            PHILRADS Community
          </h1>
          <p className="mt-0.5 inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted">
            <span className="h-2 w-2 rounded-full bg-status-in" aria-hidden />
            <span className="tabular-nums">{`${formatNumber(here.count)} here now`}</span>
          </p>
        </div>
        {/* Phones: the buttons get their own row, so the name never gets squeezed. */}
        <div className="flex w-full gap-2 pb-0.5 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          <button type="button" className="btn-primary" onClick={onCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Post
          </button>
          <Link to="/guest/give" className="btn border border-line bg-surface text-ink hover:bg-surface-raised">
            <HandCoins className="h-4 w-4" aria-hidden /> Give
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Topics along the top, as a forum's tabs: underlined, never boxed. */
function TopicBar({ topics, topic, sort }: { topics: ForumTopic[]; topic: string | null; sort: ForumSort }) {
  const href = (t: string | null) => {
    const q = new URLSearchParams();
    if (t) q.set('t', t);
    if (sort !== 'hot') q.set('sort', sort);
    const s = q.toString();
    return s ? `/guest?${s}` : '/guest';
  };
  const tab = (key: string | null, label: string) => {
    const on = topic === key;
    return (
      <Link
        key={key ?? 'all'}
        to={href(key)}
        replace
        aria-current={on ? 'page' : undefined}
        className={`relative inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-sm font-semibold transition-colors ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}
      >
        {key && <span className="h-2 w-2 rounded-full" style={{ background: topicColor(key) }} aria-hidden />}
        {label}
        <span className={`absolute inset-x-0 bottom-0 h-[3px] rounded-t-full ${on ? 'bg-uplift' : 'bg-transparent'}`} aria-hidden />
      </Link>
    );
  };
  return (
    <nav aria-label="Topics" className="-mx-4 mt-4 border-b border-line/70 px-4 sm:-mx-6 sm:px-6">
      <div className="flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tab(null, 'All')}
        {topics.map((t) => tab(t.key, t.name))}
      </div>
    </nav>
  );
}

function SortBar({ sort, topic }: { sort: ForumSort; topic: string | null }) {
  const [, setSearch] = useSearchParams();
  return (
    <div className="flex items-center gap-1 border-b border-line/70 px-2 py-1.5 sm:px-3" role="group" aria-label="Sort posts">
      {SORTS.map((s) => (
        <button
          key={s.key}
          type="button"
          aria-pressed={sort === s.key}
          onClick={() =>
            setSearch(
              (q) => {
                const n = new URLSearchParams(q);
                if (s.key === 'hot') n.delete('sort');
                else n.set('sort', s.key);
                if (topic) n.set('t', topic);
                return n;
              },
              { replace: true },
            )
          }
          className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${sort === s.key ? 'bg-ink/[0.07] text-ink' : 'text-muted hover:bg-ink/[0.04] hover:text-ink'}`}
        >
          <s.icon className="h-4 w-4" aria-hidden /> {s.label}
        </button>
      ))}
    </div>
  );
}

/** "Share something": opens the composer (or, signed out, the invitation to sign in). */
function ComposeRow({ onCreate }: { onCreate: () => void }) {
  const { me } = useGuestAccount();
  return (
    <button type="button" onClick={onCreate} className="flex w-full items-center gap-3 border-b border-line/70 px-4 py-3 text-left transition-colors hover:bg-ink/[0.025] sm:px-5">
      {me ? <Avatar initials={me.initials} src={me.avatar} color={me.color} size="sm" ring="ring-0" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-sunken text-muted" aria-hidden><Plus className="h-4 w-4" /></span>}
      <span className="flex-1 text-sm text-muted">Share something…</span>
    </button>
  );
}

const KIND_ICON: Record<HazardKind, LucideIcon> = { typhoon: Wind, flood: Waves, earthquake: Activity, volcano: Mountain, drought: Sun, wildfire: Flame };
/** A row that scrolls sideways, edge to edge, snapping to each item. */
const stripCls = 'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * A sideways row. Touch screens swipe it; with a mouse, arrows at each end move it a screenful
 * (each shows only when there is more that way).
 */
function ScrollRow({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  const row = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState({ start: true, end: true });
  const measure = useCallback(() => {
    const el = row.current;
    if (el) setEnds({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);
  const move = (dir: 1 | -1) => {
    const el = row.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const arrow = (dir: 1 | -1, hidden: boolean) => (
    <button
      type="button"
      onClick={() => move(dir)}
      tabIndex={-1}
      aria-hidden
      className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface-raised/95 text-ink shadow-lg shadow-black/30 transition-opacity hover:bg-surface-raised [@media(hover:hover)]:grid ${dir < 0 ? 'left-2' : 'right-2'} ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      {dir < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </button>
  );
  return (
    <div className="relative">
      <ul ref={row} aria-label={label} onScroll={measure} className={`${stripCls} ${className}`}>
        {children}
      </ul>
      {arrow(-1, ends.start)}
      {arrow(1, ends.end)}
    </div>
  );
}

function StripHead({ title, icon: Icon, to, more }: { title: string; icon: LucideIcon; to: string; more: string }) {
  return (
    <div className="flex items-center justify-between px-4 pt-2 sm:px-5">
      <h2 className="inline-flex items-center gap-2 text-[0.8125rem] font-bold text-ink">
        <Icon className="h-4 w-4 text-ink-soft" aria-hidden /> {title}
      </h2>
      <Link to={to} className="inline-flex h-9 items-center gap-0.5 text-xs font-semibold text-uplift hover:underline">
        {more} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

/** A Facebook post's headline: its first line that has words. */
const headline = (text: string) => text.split(/\r?\n/).find((l) => l.trim())?.trim() ?? text;

type NewsItem = { key: string; tone: 'red' | 'orange' | 'plain'; label: string; title: string; at: string | null; icon: LucideIcon; image?: string | null; to?: string; href?: string };

/** Disaster News across the top of home: urgent PHILRADS news and hazards first, then the latest posts. */
function NewsStrip({ hazards, notes, facebook }: { hazards: Hazard[]; notes: GuestAnnouncement[]; facebook: FacebookPost[] }) {
  const items = useMemo<NewsItem[]>(() => {
    const urgent = notes.filter((n) => n.level === 'urgent');
    const rest = notes.filter((n) => n.level !== 'urgent');
    const now = hazards.filter((h) => h.current).sort((a, b) => (a.level === 'red' ? -1 : b.level === 'red' ? 1 : 0));
    return [
      ...urgent.map((n): NewsItem => ({ key: `n-${n.id}`, tone: 'red', label: 'Urgent', title: n.title, at: n.publishedAt, icon: Megaphone, to: '/guest/news' })),
      ...now.map((h): NewsItem => ({ key: `h-${h.id}`, tone: h.level === 'red' ? 'red' : 'orange', label: h.level === 'red' ? 'Red alert' : h.level === 'orange' ? 'Orange alert' : 'Alert', title: h.title, at: h.from, icon: KIND_ICON[h.kind], to: '/guest/news' })),
      ...rest.slice(0, 3).map((n): NewsItem => ({ key: `n-${n.id}`, tone: 'plain', label: 'PHILRADS', title: n.title, at: n.publishedAt, icon: Megaphone, to: '/guest/news' })),
      ...facebook.slice(0, 6).map((p): NewsItem => ({ key: `f-${p.id}`, tone: 'plain', label: 'Facebook', title: headline(p.text), at: p.postedAt, icon: Newspaper, image: p.image, href: p.url })),
    ].slice(0, 10);
  }, [hazards, notes, facebook]);
  if (!items.length) return null;
  const toneCls = { red: 'text-status-out', orange: 'text-status-low', plain: 'text-muted' } as const;
  const panelCls = { red: 'bg-status-out/15 text-status-out', orange: 'bg-status-low/15 text-status-low', plain: 'bg-burgundy-500/15 text-ink-soft' } as const;
  return (
    <section aria-label="Disaster News" className="-mx-4 border-t border-line/70 sm:-mx-6">
      <StripHead title="Disaster News" icon={Siren} to="/guest/news" more="All news" />
      <ScrollRow label="Latest news" className="scroll-px-2 px-2 pb-3 sm:scroll-px-3 sm:px-3">
        {items.map((i) => {
          const body = (
            <>
              {/* The post's own picture; without one, a panel in the item's colour with its icon. */}
              {i.image ? (
                <img src={i.image} alt="" loading="lazy" className="aspect-[16/10] w-full rounded-lg bg-surface-sunken object-cover" />
              ) : (
                <span className={`grid aspect-[16/10] w-full place-items-center rounded-lg ${panelCls[i.tone]}`} aria-hidden>
                  <i.icon className="h-8 w-8" />
                </span>
              )}
              <span className={`mt-2 flex items-center gap-1.5 text-[0.6875rem] font-semibold ${toneCls[i.tone]}`}>
                {i.label}
                {i.at && <span className="font-medium text-muted">· {timeAgo(i.at)}</span>}
              </span>
              <span className="mt-0.5 line-clamp-3 text-sm font-semibold leading-snug text-ink">{i.title}</span>
            </>
          );
          const cls = 'flex w-56 flex-col px-2 py-1 transition-opacity hover:opacity-90 sm:w-60';
          return (
            <li key={i.key} className="flex shrink-0 snap-start">
              {i.href ? (
                <a href={i.href} target="_blank" rel="noopener noreferrer" className={cls}>
                  {body}
                </a>
              ) : (
                <Link to={i.to ?? '/guest/news'} className={cls}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ScrollRow>
    </section>
  );
}

/** Merch, as a carousel in the feed. */
function MerchStrip({ merch }: { merch: MerchItem[] }) {
  const list = merch.filter((m) => m.inStock).slice(0, 10);
  if (!list.length) return null;
  return (
    <section aria-label="Merch">
      <StripHead title="Merch" icon={Shirt} to="/guest/merch" more="Shop" />
      <ScrollRow label="Merch" className="scroll-px-4 gap-3 px-4 pb-4 pt-1 sm:scroll-px-5 sm:px-5">
        {list.map((m) => (
          <li key={m.id} className="w-36 shrink-0 snap-start sm:w-40">
            <Link to="/guest/merch" className="group flex flex-col">
              <Picture src={m.imageUrl} alt={m.name} icon={Shirt} className="aspect-square w-full rounded-xl transition-opacity group-hover:opacity-90" />
              <span className="mt-2 truncate text-sm font-semibold text-ink">{m.name}</span>
              <span className="text-xs tabular-nums text-ink-soft">{m.price !== null ? peso(m.price) : 'Ask for the price'}</span>
            </Link>
          </li>
        ))}
      </ScrollRow>
    </section>
  );
}

function PostRow({ post, topicName, onVote, needIn }: { post: ForumPost; topicName: string; onVote: (p: ForumPost) => void; needIn: (why: string, then: () => void) => void }) {
  const to = `/guest/post?id=${encodeURIComponent(post.id)}`;
  return (
    <article className={rowCls} aria-labelledby={`post-${post.id}`}>
      <Byline author={post.author} topic={{ key: post.topic, name: topicName }} at={post.createdAt} pinned={post.pinned} />
      <h2 id={`post-${post.id}`} className="text-[1.0625rem] font-semibold leading-snug text-ink">
        <Link to={to} className="after:absolute after:inset-0 after:content-['']">
          {post.title}
        </Link>
      </h2>
      {post.body && <p className={`${post.image ? 'line-clamp-2' : 'line-clamp-3'} whitespace-pre-line text-sm leading-relaxed text-ink-soft`}>{post.body}</p>}
      {/* The whole picture, never cropped: people post photos with words on them. */}
      {post.image && <img src={post.image} alt="" loading="lazy" className="max-h-[28rem] w-auto max-w-full self-start rounded-xl bg-surface-sunken" />}
      <div className="-ml-2 flex items-center gap-1">
        <Upvote count={post.score} on={post.voted} label={post.title} onToggle={() => needIn('Sign in to upvote', () => onVote(post))} />
        <Link to={to} className="relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-ink/[0.06] hover:text-ink">
          <MessageCircle className="h-4 w-4" aria-hidden />
          {post.commentCount === 1 ? '1 comment' : `${post.commentCount} comments`}
        </Link>
        <span className="relative z-10">
          <ShareButton title={post.title} path={to} className="!min-h-8 !border-0 !bg-transparent !px-2.5 !text-xs !text-ink-soft hover:!bg-ink/[0.06]" />
        </span>
      </div>
    </article>
  );
}

function OfficialRow({ item }: { item: Exclude<Item, { type: 'post' }> }) {
  const { unlocked } = useGuestAccount();
  const topic = { key: OFFICIAL_TOPIC[item.type], name: DEFAULT_TOPICS.find((t) => t.key === OFFICIAL_TOPIC[item.type])?.name ?? '' };
  let to: string, title: string, text: string | null, picture: string | null, icon: LucideIcon, action: React.ReactNode;
  if (item.type === 'story') {
    const locked = !unlocked && item.index >= OPEN_STORIES;
    to = `/guest/stories?story=${item.story.id}`;
    title = item.story.title;
    text = item.story.summary;
    picture = item.story.coverUrl;
    icon = BookOpen;
    action = locked ? (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
        <Lock className="h-3.5 w-3.5" aria-hidden /> Sign in to read
      </span>
    ) : (
      <span className="text-xs font-semibold text-uplift">Read the story</span>
    );
  } else if (item.type === 'prayer') {
    to = `/guest/pray#prayer-${item.prayer.id}`;
    title = item.prayer.title;
    text = item.prayer.body;
    picture = null;
    icon = HeartHandshake;
    action = (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
        <HeartHandshake className="h-4 w-4 text-burgundy-400" aria-hidden />
        {item.prayer.prayedCount === 1 ? '1 prayed' : `${formatNumber(item.prayer.prayedCount)} prayed`} · Pray with us
      </span>
    );
  } else if (item.type === 'drive') {
    const d = item.drive;
    const pct = Math.min(100, Math.round((d.raised / d.goal) * 100));
    to = `/guest/give?drive=${d.id}`;
    title = d.title;
    text = d.summary;
    picture = d.coverUrl;
    icon = HandCoins;
    action = (
      <span className="flex w-full max-w-sm flex-col gap-1.5">
        <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Raised so far">
          <span className="block h-full rounded-full bg-burgundy-500" style={{ width: `${pct}%` }} />
        </span>
        <span className="text-xs tabular-nums text-ink-soft">
          <strong className="font-semibold text-ink">{amount(d.raised, d.unit)}</strong> of {amount(d.goal, d.unit)} · <span className="font-semibold text-uplift">Give</span>
        </span>
      </span>
    );
  } else {
    to = '/guest/news';
    title = item.note.title;
    text = item.note.body;
    picture = null;
    icon = Siren;
    action = <span className="text-xs font-semibold text-uplift">Disaster News</span>;
  }
  return (
    <article className={rowCls}>
      <Byline official topic={topic} at={item.at} />
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="text-[1.0625rem] font-semibold leading-snug text-ink">
            <Link to={to} className="after:absolute after:inset-0 after:content-['']">
              {title}
            </Link>
          </h2>
          {text && <p className="line-clamp-2 text-sm leading-relaxed text-ink-soft">{text}</p>}
        </div>
        {picture && <Picture src={picture} alt="" icon={icon} className="h-20 w-28 shrink-0 rounded-lg sm:h-24 sm:w-36" />}
      </div>
      <div className="flex items-center">{action}</div>
    </article>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line/70 px-4 py-5 sm:px-5 xl:px-6">
      <h2 className="mb-3 text-[0.8125rem] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function RailLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <li>
      <Link to={to} className="-mx-2 flex h-10 items-center gap-3 rounded-lg px-2 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-ink">
        <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden /> {label}
      </Link>
    </li>
  );
}

/** Beside the feed: joining, the fundraiser to finish, staying safe, and the community's rules. */
function Rail({ drives }: { drives: DonationDrive[] }) {
  const { unlocked, here } = useGuestAccount();
  const featured = [...drives.filter((d) => d.status === 'open')].sort((a, b) => b.raised / b.goal - a.raised / a.goal)[0];
  return (
    <aside aria-label="About the community" className="border-t border-line/70 xl:border-l xl:border-t-0">
      {!unlocked && (
        <RailSection title="Join">
          <div className="flex items-center gap-3">
            <Faces max={4} />
            <p className="text-sm text-ink-soft">
              <span className="font-semibold tabular-nums text-ink">{formatNumber(here.count)}</span> here now
            </p>
          </div>
          <GoogleButton className="mt-4 w-full" />
          <p className="mt-2 text-xs text-muted">Free. We never post for you.</p>
        </RailSection>
      )}
      {featured && (
        <RailSection title="Closest to its goal">
          <Link to={`/guest/give?drive=${featured.id}`} className="group flex flex-col gap-2">
            <span className="font-semibold leading-snug text-ink group-hover:underline">{featured.title}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
              <span className="block h-full rounded-full bg-burgundy-500" style={{ width: `${Math.min(100, Math.round((featured.raised / featured.goal) * 100))}%` }} />
            </span>
            <span className="text-xs tabular-nums text-ink-soft">
              <strong className="font-semibold text-ink">{amount(featured.raised, featured.unit)}</strong> of {amount(featured.goal, featured.unit)}
            </span>
            <span className="btn-primary mt-1 self-start">
              <HandCoins className="h-4 w-4" aria-hidden /> Give to this
            </span>
          </Link>
        </RailSection>
      )}
      <RailSection title="Stay safe">
        <ul className="flex flex-col">
          <RailLink to="/guest/map" icon={MapPin} label="Nearest site" />
          <RailLink to="/guest/hotlines" icon={Phone} label="Hotlines" />
          <RailLink to="/guest/prepare" icon={ShieldCheck} label="Be prepared" />
          <RailLink to="/guest/alerts" icon={BellRing} label="Alerts" />
          <RailLink to="/guest/pray" icon={HeartHandshake} label="Pray with us" />
        </ul>
      </RailSection>
      <RailSection title="Rules">
        <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-sm text-ink-soft marker:text-muted">
          <li>Be kind.</li>
          <li>No addresses, numbers or photos of people without asking.</li>
          <li>Give only through PHILRADS.</li>
          <li>Post only what’s true.</li>
        </ol>
      </RailSection>
    </aside>
  );
}

/**
 * The guest home, as a community forum: the PHILRADS banner, topics, and one feed of what guests
 * post with PHILRADS's own stories, prayer points, fundraisers and news among it. Beside it (below
 * it on phones): joining, the fundraiser to finish, staying safe, and the rules.
 */
export function CommunitySection({
  hazards,
  notes,
  stories,
  drives,
  prayers,
  facebook,
  merch,
}: {
  hazards: Hazard[];
  notes: GuestAnnouncement[];
  stories: GuestStory[];
  drives: DonationDrive[];
  prayers: GuestPrayer[];
  facebook: FacebookPost[];
  merch: MerchItem[];
}) {
  const [search] = useSearchParams();
  const { can } = useAuth();
  const { staff } = useGuestAccount();
  const { needIn, prompt } = useJoinPrompt();
  const topic = search.get('t');
  const sortParam = search.get('sort');
  const sort: ForumSort = isSort(sortParam) ? sortParam : 'hot';

  const [topics, setTopics] = useState<ForumTopic[]>(DEFAULT_TOPICS);
  useEffect(() => {
    forumService.topics().then((t) => t.length && setTopics(t), () => {});
  }, []);
  const topicName = useCallback((k: string) => topics.find((t) => t.key === k)?.name ?? k, [topics]);

  const [feed, setFeed] = useState<{ status: 'loading' | 'ok' | 'error'; posts: ForumPost[]; more: boolean; error?: string }>({ status: 'loading', posts: [], more: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setFeed((f) => ({ ...f, status: 'loading' }));
    forumService.feed(topic, sort).then(
      (posts) => current && setFeed({ status: 'ok', posts, more: posts.length === FORUM_PAGE }),
      (e: unknown) => current && setFeed({ status: 'error', posts: [], more: false, error: e instanceof Error ? e.message : 'The community couldn’t load.' }),
    );
    return () => {
      current = false;
    };
  }, [topic, sort, attempt]);
  const loadMore = async () => {
    const next = await forumService.feed(topic, sort, feed.posts.length).catch(() => [] as ForumPost[]);
    setFeed((f) => ({ ...f, posts: [...f.posts, ...next.filter((p) => !f.posts.some((x) => x.id === p.id))], more: next.length === FORUM_PAGE }));
  };

  const vote = async (p: ForumPost) => {
    const on = !p.voted;
    const patch = (score: number, voted: boolean) => setFeed((f) => ({ ...f, posts: f.posts.map((x) => (x.id === p.id ? { ...x, score, voted } : x)) }));
    patch(p.score + (on ? 1 : -1), on);
    try {
      patch(await forumService.vote('post', p.id, on), on);
    } catch {
      patch(p.score, p.voted);
    }
  };

  const [composing, setComposing] = useState(false);
  const create = () => needIn('Sign in to post', () => setComposing(true));

  // PHILRADS's own posts, mixed in: the latest stories, prayer points, open fundraisers and news.
  const official = useMemo<Item[]>(() => {
    const list: Item[] = [
      ...stories.slice(0, 6).map((story, index): Item => ({ type: 'story', at: story.publishedAt ?? story.updatedAt, story, index })),
      ...prayers.slice(0, 3).map((prayer): Item => ({ type: 'prayer', at: prayer.publishedAt ?? prayer.updatedAt, prayer })),
      ...drives.filter((d) => d.status === 'open').map((drive): Item => ({ type: 'drive', at: drive.startsOn ?? drive.raisedUpdatedAt ?? new Date().toISOString(), drive })),
      ...notes.filter((n) => n.level !== 'urgent').slice(0, 3).map((note): Item => ({ type: 'note', at: note.publishedAt ?? note.updatedAt, note })),
    ];
    return list.filter((i) => !topic || topicOf(i) === topic).sort((a, b) => b.at.localeCompare(a.at));
  }, [stories, prayers, drives, notes, topic]);

  // New: everything by date. Hot and Top: the community's order, with a PHILRADS post after every two.
  const items = useMemo<Item[]>(() => {
    const posts = feed.posts.map((post): Item => ({ type: 'post', at: post.createdAt, post }));
    if (sort === 'new') return [...posts, ...official].sort((a, b) => b.at.localeCompare(a.at));
    const out: Item[] = [];
    let o = 0;
    posts.forEach((p, i) => {
      out.push(p);
      if (i % 2 === 1 && o < official.length) out.push(official[o++]);
    });
    return [...out, ...(feed.more ? [] : official.slice(o))];
  }, [feed.posts, feed.more, official, sort]);

  const topicNow = topic ? topics.find((t) => t.key === topic) : null;

  return (
    <div>
      <Banner onCreate={create} />
      {!topic && <NewsStrip hazards={hazards} notes={notes} facebook={facebook} />}
      <TopicBar topics={topics} topic={topic} sort={sort} />
      <div className="-mx-4 grid sm:-mx-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-label={topicNow ? `${topicNow.name} posts` : 'Posts'} className="min-w-0">
          {topicNow && (
            <p className="border-b border-line/70 px-4 py-3 text-sm text-ink-soft sm:px-5">
              <TopicTag topic={topicNow.key} name={topicNow.name} />
              <span className="ml-2">{topicNow.description}</span>
            </p>
          )}
          <SortBar sort={sort} topic={topic} />
          <ComposeRow onCreate={create} />
          {feed.status === 'error' && (
            <div className="flex flex-col items-start gap-3 border-b border-line/70 px-4 py-6 sm:px-5">
              <p className="text-sm text-ink-soft">{feed.error}</p>
              <button type="button" className="chip" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            </div>
          )}
          {feed.status === 'loading' && !feed.posts.length ? (
            <ul aria-label="Loading posts" className="divide-y divide-line/70">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex flex-col gap-2.5 px-4 py-5 sm:px-5">
                  <span className="h-3 w-40 animate-pulse rounded bg-surface-sunken" />
                  <span className="h-4 w-3/4 animate-pulse rounded bg-surface-sunken" />
                  <span className="h-3 w-1/2 animate-pulse rounded bg-surface-sunken" />
                </li>
              ))}
            </ul>
          ) : (
            <div className={`divide-y divide-line/70 border-b border-line/70 transition-opacity ${feed.status === 'loading' ? 'opacity-60' : ''}`}>
              {items.map((i, n) => (
                <Fragment key={i.type === 'post' ? `p-${i.post.id}` : `${i.type}-${i.type === 'story' ? i.story.id : i.type === 'prayer' ? i.prayer.id : i.type === 'drive' ? i.drive.id : i.note.id}`}>
                  {i.type === 'post' ? <PostRow post={i.post} topicName={topicName(i.post.topic)} onVote={(p) => void vote(p)} needIn={needIn} /> : <OfficialRow item={i} />}
                  {!topic && n === Math.min(MERCH_AFTER, items.length) - 1 && <MerchStrip merch={merch} />}
                </Fragment>
              ))}
              {feed.status === 'ok' && !items.length && (
                <div className="flex flex-col items-start gap-3 px-4 py-8 sm:px-5">
                  <p className="font-semibold text-ink">Nothing here yet</p>
                  <p className="text-sm text-ink-soft">Be the first to post{topicNow ? ` in ${topicNow.name}` : ''}.</p>
                  <button type="button" className="btn-primary" onClick={create}>
                    <Plus className="h-4 w-4" aria-hidden /> Create post
                  </button>
                </div>
              )}
            </div>
          )}
          {feed.more && (
            <div className="px-4 py-4 sm:px-5">
              <ActionButton onClick={() => void loadMore()}>Show more posts</ActionButton>
            </div>
          )}
        </section>
        <Rail drives={drives} />
      </div>
      <ComposerSheet key={`${composing}-${topic ?? ''}`} open={composing} onClose={() => setComposing(false)} topics={topics} topic={topic} canPostUpdates={staff && can('guest.manage')} />
      {prompt}
    </div>
  );
}

