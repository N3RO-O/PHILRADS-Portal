import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BellRing, BookOpen, Flame, HandCoins, HeartHandshake, Lock, MapPin, MessageCircle, Phone, Plus, ShieldCheck, Siren, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react';
import { forumService } from '../../services';
import { useAuth } from '../auth/AuthProvider';
import { useGuestAccount } from '../../services/guest/account';
import { amount, type DonationDrive, type GuestAnnouncement, type GuestOverview, type GuestPrayer, type GuestStory } from '../../services/guest/guestService';
import { FORUM_PAGE, type ForumPost, type ForumSort, type ForumTopic } from '../../services/guest/forum';
import type { Hazard } from '../../services/guest/hazards';
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

const rowCls = 'relative flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-ink/[0.025] sm:px-5';

/** The community's front: its banner and name, who's here, and the two things to do. */
function Banner({ totals, onCreate }: { totals: GuestOverview['totals'] | undefined; onCreate: () => void }) {
  const { here, me } = useGuestAccount();
  const people = totals ? totals.individuals || totals.households * 4 : 0;
  return (
    <header className="-mx-4 sm:-mx-6">
      <div className="relative h-24 overflow-hidden sm:h-32 lg:h-40">
        <img src="/brand/sign-in-red-1280.webp" alt="" className="h-full w-full object-cover object-[center_40%]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(28,10,14,0.15),rgba(28,10,14,0.7))]" aria-hidden />
      </div>
      <div className="px-4 sm:px-6">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <span className="-mt-8 grid h-16 w-16 shrink-0 place-items-center rounded-full bg-burgundy-600 ring-4 ring-page sm:-mt-10 sm:h-20 sm:w-20" aria-hidden>
            <PrismMark className="h-10 w-10 text-cloud sm:h-12 sm:w-12" />
          </span>
          <div className="min-w-0 flex-1 pt-3">
            <h1 id="guest-title" className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
              PHILRADS Community
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span>Relief, prayer and help after disasters</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-status-in" aria-hidden />
                <span className="tabular-nums">{formatNumber(here.count)}</span> here now
              </span>
            </p>
          </div>
          <div className="flex gap-2 pb-0.5">
            <button type="button" className="btn-primary" onClick={onCreate}>
              <Plus className="h-4 w-4" aria-hidden /> Create post
            </button>
            <Link to="/guest/give" className="btn border border-line bg-surface text-ink hover:bg-surface-raised">
              <HandCoins className="h-4 w-4" aria-hidden /> Give
            </Link>
          </div>
        </div>
        <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-ink-soft">
          {me ? `Welcome back, ${me.name}. ` : ''}
          Philippine Relief and Development Services brings relief to families after typhoons, floods and earthquakes, and stays to help them rebuild.
          {totals && totals.activities > 0 && (
            <>
              {' '}
              {totals.since ? `Since ${totals.since}: ` : ''}
              <strong className="font-semibold text-ink">{formatNumber(totals.activities)} activities</strong> in <strong className="font-semibold text-ink">{formatNumber(totals.places)} places</strong>
              {people > 0 && (
                <>
                  , <strong className="font-semibold text-ink">{formatNumber(people)} people</strong> reached
                </>
              )}
              .
            </>
          )}
        </p>
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
      <span className="flex-1 text-sm text-muted">Share something with the community…</span>
    </button>
  );
}

/** Happening now: urgent PHILRADS news and hazards, as rows with a coloured edge. */
function RightNow({ hazards, notes }: { hazards: Hazard[]; notes: GuestAnnouncement[] }) {
  const urgent = notes.filter((n) => n.level === 'urgent').slice(0, 1);
  const now = hazards.filter((h) => h.current).sort((a, b) => (a.level === 'red' ? -1 : b.level === 'red' ? 1 : 0)).slice(0, 2 - urgent.length);
  if (!urgent.length && !now.length) return null;
  const row = (key: string, red: boolean, label: string, title: string) => (
    <Link key={key} to="/guest/news" className={`flex items-center gap-3 border-b border-l-4 border-b-line/70 px-4 py-3 transition-colors hover:bg-ink/[0.025] sm:px-5 ${red ? 'border-l-status-out' : 'border-l-status-low'}`}>
      <Siren className={`h-5 w-5 shrink-0 ${red ? 'text-status-out' : 'text-status-low'}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={`block text-xs font-semibold ${red ? 'text-status-out' : 'text-status-low'}`}>{label}</span>
        <span className="block truncate font-semibold text-ink">{title}</span>
      </span>
    </Link>
  );
  return (
    <section aria-label="Happening now">
      {urgent.map((n) => row(n.id, true, 'From PHILRADS, urgent', n.title))}
      {now.map((h) => row(h.id, h.level === 'red', 'Happening now', h.title))}
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
      {post.body && <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{post.body}</p>}
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
function Rail({ drives, prayers }: { drives: DonationDrive[]; prayers: GuestPrayer[] }) {
  const { unlocked, here } = useGuestAccount();
  const featured = [...drives.filter((d) => d.status === 'open')].sort((a, b) => b.raised / b.goal - a.raised / a.goal)[0];
  const prayed = prayers.reduce((n, p) => n + p.prayedCount, 0);
  return (
    <aside aria-label="About the community" className="border-t border-line/70 xl:border-l xl:border-t-0">
      {!unlocked && (
        <RailSection title="Join the community">
          <div className="flex items-center gap-3">
            <Faces max={4} />
            <p className="text-sm text-ink-soft">
              <span className="font-semibold tabular-nums text-ink">{formatNumber(here.count)}</span> here now
            </p>
          </div>
          <p className="mt-3 text-sm text-ink-soft">Post, comment and upvote, read every story, pray with us, and see where the gifts went.</p>
          <GoogleButton className="mt-4 w-full" />
          <p className="mt-2 text-xs text-muted">Free. We only use your name and picture, and never post for you.</p>
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
          <RailLink to="/guest/map" icon={MapPin} label="Nearest PHILRADS site" />
          <RailLink to="/guest/hotlines" icon={Phone} label="Emergency hotlines" />
          <RailLink to="/guest/prepare" icon={ShieldCheck} label="Be prepared" />
          <RailLink to="/guest/alerts" icon={BellRing} label="Typhoon alerts" />
          <RailLink to="/guest/pray" icon={HeartHandshake} label={prayed ? `Pray with us (${formatNumber(prayed)} prayers)` : 'Pray with us'} />
        </ul>
      </RailSection>
      <RailSection title="Community rules">
        <ol className="flex list-decimal flex-col gap-2 pl-4 text-sm text-ink-soft marker:text-muted">
          <li>Be kind. People here may have just lost a home.</li>
          <li>Keep others safe: no addresses, phone numbers or photos of people without asking.</li>
          <li>Give through PHILRADS fundraisers, never to a person’s account.</li>
          <li>Only post what you know is true.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">PHILRADS staff may hide posts that break these. Three reports hide a post until staff look.</p>
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
  overview,
  hazards,
  notes,
  stories,
  drives,
  prayers,
}: {
  overview: GuestOverview | undefined;
  hazards: Hazard[];
  notes: GuestAnnouncement[];
  stories: GuestStory[];
  drives: DonationDrive[];
  prayers: GuestPrayer[];
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
      <Banner totals={overview?.totals} onCreate={create} />
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
          {!topic && <RightNow hazards={hazards} notes={notes} />}
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
              {items.map((i) =>
                i.type === 'post' ? (
                  <PostRow key={`p-${i.post.id}`} post={i.post} topicName={topicName(i.post.topic)} onVote={(p) => void vote(p)} needIn={needIn} />
                ) : (
                  <OfficialRow key={`${i.type}-${i.type === 'story' ? i.story.id : i.type === 'prayer' ? i.prayer.id : i.type === 'drive' ? i.drive.id : i.note.id}`} item={i} />
                ),
              )}
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
        <Rail drives={drives} prayers={prayers} />
      </div>
      <ComposerSheet key={`${composing}-${topic ?? ''}`} open={composing} onClose={() => setComposing(false)} topics={topics} topic={topic} canPostUpdates={staff && can('guest.manage')} />
      {prompt}
    </div>
  );
}

