import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The guest community: posts in topics, threaded comments, upvotes and reports
 * (supabase/migrations/20261129000000_guest_community.sql). Everything goes through database
 * functions, which hold the rules: who may write, rate limits, staff-only topics, moderation.
 */
export interface ForumTopic {
  key: string;
  name: string;
  description: string;
  staffOnly: boolean;
}
export interface ForumAuthor {
  /** Null when the comment was deleted. */
  id: string | null;
  name: string | null;
  avatar: string | null;
  color: string | null;
  /** PHILRADS staff. */
  staff: boolean;
}
export interface ForumPost {
  id: string;
  topic: string;
  title: string;
  /** In the feed, the first 700 characters. */
  body: string;
  score: number;
  commentCount: number;
  pinned: boolean;
  createdAt: string;
  author: ForumAuthor;
  voted: boolean;
  mine: boolean;
  /** Only its author and staff see a hidden or deleted post. */
  hidden: boolean;
  deleted: boolean;
}
export interface ForumComment {
  id: string;
  parentId: string | null;
  /** Null when deleted, or hidden (staff still see the words). */
  body: string | null;
  score: number;
  createdAt: string;
  author: ForumAuthor;
  voted: boolean;
  mine: boolean;
  hidden: boolean;
  deleted: boolean;
}
export type ForumSort = 'hot' | 'new' | 'top';
export type ForumKind = 'post' | 'comment';
export type ForumAction = 'hide' | 'unhide' | 'pin' | 'unpin' | 'dismiss';
export interface ForumReviewItem {
  kind: ForumKind;
  id: string;
  postId: string;
  title: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorStaff: boolean;
  openReports: number;
  reasons: string[];
  hidden: boolean;
  hiddenReason: string | null;
}

export const FORUM_TITLE_MAX = 140;
export const FORUM_BODY_MAX = 5000;
export const FORUM_COMMENT_MAX = 2000;
export const FORUM_PAGE = 25;

export interface ForumService {
  source: 'supabase' | 'mock';
  topics(): Promise<ForumTopic[]>;
  feed(topic: string | null, sort: ForumSort, offset?: number): Promise<ForumPost[]>;
  post(id: string): Promise<ForumPost | null>;
  comments(postId: string): Promise<ForumComment[]>;
  createPost(topic: string, title: string, body: string): Promise<string>;
  comment(postId: string, parentId: string | null, body: string): Promise<string>;
  /** Upvote, or take it back. Returns the new count. */
  vote(kind: ForumKind, id: string, on: boolean): Promise<number>;
  report(kind: ForumKind, id: string, reason: string): Promise<void>;
  /** Delete your own. */
  remove(kind: ForumKind, id: string): Promise<void>;
  /** Staff with the Guest page. */
  moderate(kind: ForumKind, id: string, action: ForumAction): Promise<void>;
  review(): Promise<ForumReviewItem[]>;
}

type Row = Record<string, unknown>;
const author = (r: Row): ForumAuthor => ({
  id: (r.author_id as string | null) ?? null,
  name: (r.author_name as string | null) ?? null,
  avatar: (r.author_avatar as string | null) ?? null,
  color: (r.author_color as string | null) ?? null,
  staff: Boolean(r.author_staff),
});
const toPost = (r: Row): ForumPost => ({
  id: r.id as string,
  topic: r.topic as string,
  title: r.title as string,
  body: (r.body as string) ?? '',
  score: Number(r.score ?? 0),
  commentCount: Number(r.comment_count ?? 0),
  pinned: Boolean(r.pinned),
  createdAt: r.created_at as string,
  author: author(r),
  voted: Boolean(r.voted),
  mine: Boolean(r.mine),
  hidden: Boolean(r.hidden),
  deleted: Boolean(r.deleted),
});
const toComment = (r: Row): ForumComment => ({
  id: r.id as string,
  parentId: (r.parent_id as string | null) ?? null,
  body: (r.body as string | null) ?? null,
  score: Number(r.score ?? 0),
  createdAt: r.created_at as string,
  author: author(r),
  voted: Boolean(r.voted),
  mine: Boolean(r.mine),
  hidden: Boolean(r.hidden),
  deleted: Boolean(r.deleted),
});

/** The database's own words ("Sign in to take part", "You've posted a lot this hour…"). */
const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message || 'That didn’t work. Try again.');
};

export function createSupabaseForumService(client: SupabaseClient): ForumService {
  return {
    source: 'supabase',
    async topics() {
      const { data, error } = await client.rpc('forum_topics_list');
      fail(error);
      return ((data ?? []) as Row[]).map((r) => ({ key: r.key as string, name: r.name as string, description: (r.description as string) ?? '', staffOnly: Boolean(r.staff_only) }));
    },
    async feed(topic, sort, offset = 0) {
      const { data, error } = await client.rpc('forum_feed', { p_topic: topic, p_sort: sort, p_limit: FORUM_PAGE, p_offset: offset });
      fail(error);
      return ((data ?? []) as Row[]).map(toPost);
    },
    async post(id) {
      const { data, error } = await client.rpc('forum_post', { p_id: id });
      fail(error);
      const r = ((data ?? []) as Row[])[0];
      return r ? toPost(r) : null;
    },
    async comments(postId) {
      const { data, error } = await client.rpc('forum_comments_of', { p_post: postId });
      fail(error);
      return ((data ?? []) as Row[]).map(toComment);
    },
    async createPost(topic, title, body) {
      const { data, error } = await client.rpc('forum_create_post', { p_topic: topic, p_title: title, p_body: body });
      fail(error);
      return data as string;
    },
    async comment(postId, parentId, body) {
      const { data, error } = await client.rpc('forum_create_comment', { p_post: postId, p_parent: parentId, p_body: body });
      fail(error);
      return data as string;
    },
    async vote(kind, id, on) {
      const { data, error } = await client.rpc('forum_vote', { p_kind: kind, p_id: id, p_on: on });
      fail(error);
      return Number(data ?? 0);
    },
    async report(kind, id, reason) {
      const { error } = await client.rpc('forum_report', { p_kind: kind, p_id: id, p_reason: reason });
      fail(error);
    },
    async remove(kind, id) {
      const { error } = await client.rpc('forum_delete', { p_kind: kind, p_id: id });
      fail(error);
    },
    async moderate(kind, id, action) {
      const { error } = await client.rpc('forum_moderate', { p_kind: kind, p_id: id, p_action: action });
      fail(error);
    },
    async review() {
      const { data, error } = await client.rpc('forum_review');
      fail(error);
      return ((data ?? []) as Row[]).map((r) => ({
        kind: r.kind as ForumKind,
        id: r.id as string,
        postId: r.post_id as string,
        title: (r.title as string) ?? '',
        body: (r.body as string) ?? '',
        createdAt: r.created_at as string,
        authorName: (r.author_name as string) ?? 'Guest',
        authorStaff: Boolean(r.author_staff),
        openReports: Number(r.open_reports ?? 0),
        reasons: (r.reasons as string[] | null) ?? [],
        hidden: Boolean(r.hidden),
        hiddenReason: (r.hidden_reason as string | null) ?? null,
      }));
    },
  };
}

/* ------------------------------------------------------------------------------------------------
 * Sample mode: a made-up community kept in memory for this visit. The signed-in "guest" is the
 * sample account the guest page keeps on this device (services/guest/account.tsx).
 * --------------------------------------------------------------------------------------------- */

const TOPICS: ForumTopic[] = [
  { key: 'updates', name: 'Updates', description: 'News from the PHILRADS team.', staffOnly: true },
  { key: 'stories', name: 'Stories', description: 'What you saw, what you lived through, what helped.', staffOnly: false },
  { key: 'prayer', name: 'Prayer', description: 'Ask for prayer, or say how you are praying.', staffOnly: false },
  { key: 'needs', name: 'Needs and offers', description: 'A family that needs help, or help you can give.', staffOnly: false },
  { key: 'questions', name: 'Questions', description: 'Ask PHILRADS or the community.', staffOnly: false },
  { key: 'fundraising', name: 'Fundraising', description: 'Fundraisers, and ideas to raise more.', staffOnly: false },
];

interface MockPost extends Omit<ForumPost, 'voted' | 'mine'> {
  voters: Set<string>;
}
interface MockComment extends Omit<ForumComment, 'voted' | 'mine'> {
  postId: string;
  text: string;
  voters: Set<string>;
}

const people = {
  team: { id: 's-team', name: 'Ate Grace', avatar: null, color: '#7a1f2b', staff: true },
  joy: { id: 's-1', name: 'Joy', avatar: null, color: '#3f8f5b', staff: false },
  marco: { id: 's-2', name: 'Marco', avatar: null, color: '#3c5fa8', staff: false },
  liza: { id: 's-3', name: 'Liza', avatar: null, color: '#a03f7a', staff: false },
  ben: { id: 's-4', name: 'Ben', avatar: null, color: '#b0702a', staff: false },
} satisfies Record<string, ForumAuthor>;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const votersOf = (n: number) => new Set(Array.from({ length: n }, (_, i) => `v-${i}`));

function seed() {
  const posts: MockPost[] = [
    { id: 'p-1', topic: 'updates', title: 'Relief packs for 600 families in Cagayan go out this Saturday', body: 'Thank you to everyone who gave last week. The team leaves Tuguegarao at 5 in the morning with rice, canned goods, hygiene kits and water. We will post photos here when the signal allows. If you live near Aparri and can help unload, send us a message under Feedback.', score: 48, commentCount: 3, pinned: true, createdAt: hoursAgo(9), author: people.team, hidden: false, deleted: false, voters: votersOf(48) },
    { id: 'p-2', topic: 'prayer', title: 'Please pray for my lola in Tacloban', body: 'The roof of her house came off last night and she is staying with the neighbours. She is 84 and her heart is weak. Salamat po sa inyong lahat.', score: 31, commentCount: 2, pinned: false, createdAt: hoursAgo(3), author: people.joy, hidden: false, deleted: false, voters: votersOf(31) },
    { id: 'p-3', topic: 'needs', title: 'Can give 40 sacks of rice to a family-run evacuation center', body: 'Our rice mill in Nueva Ecija has 40 sacks set aside. We can deliver within Central Luzon. Which centers need it most right now?', score: 22, commentCount: 1, pinned: false, createdAt: hoursAgo(14), author: people.marco, hidden: false, deleted: false, voters: votersOf(22) },
    { id: 'p-4', topic: 'questions', title: 'Can I volunteer if I only have weekends free?', body: 'I work Monday to Friday in Makati. Is there something I can help with on Saturdays?', score: 9, commentCount: 1, pinned: false, createdAt: hoursAgo(26), author: people.liza, hidden: false, deleted: false, voters: votersOf(9) },
    { id: 'p-5', topic: 'stories', title: 'What I saw at the distribution in Catanduanes', body: 'I joined my church group for the first time. A mother told me it was the first time anyone came to their barangay since the storm. I could not stop thinking about it on the boat home.', score: 37, commentCount: 0, pinned: false, createdAt: hoursAgo(40), author: people.ben, hidden: false, deleted: false, voters: votersOf(37) },
    { id: 'p-6', topic: 'fundraising', title: 'Our office ran a bake sale for the typhoon fund', body: 'We raised ₱18,450 in one afternoon! Sharing in case another office wants to try it: ube cheese pandesal sold out first.', score: 15, commentCount: 0, pinned: false, createdAt: hoursAgo(60), author: people.joy, hidden: false, deleted: false, voters: votersOf(15) },
  ];
  const comments: MockComment[] = [
    { id: 'c-1', postId: 'p-1', parentId: null, text: 'Praying for safe travel for the team!', body: null, score: 6, createdAt: hoursAgo(8), author: people.liza, hidden: false, deleted: false, voters: votersOf(6) },
    { id: 'c-2', postId: 'p-1', parentId: 'c-1', text: 'Salamat, Liza. We’ll post when we arrive.', body: null, score: 4, createdAt: hoursAgo(7), author: people.team, hidden: false, deleted: false, voters: votersOf(4) },
    { id: 'c-3', postId: 'p-1', parentId: null, text: 'I’m in Aparri, I can help unload on Saturday.', body: null, score: 3, createdAt: hoursAgo(5), author: people.ben, hidden: false, deleted: false, voters: votersOf(3) },
    { id: 'c-4', postId: 'p-2', parentId: null, text: 'Praying for her right now. Lord, cover her with Your peace.', body: null, score: 8, createdAt: hoursAgo(2), author: people.marco, hidden: false, deleted: false, voters: votersOf(8) },
    { id: 'c-5', postId: 'p-2', parentId: 'c-4', text: 'Amen. Salamat po, Marco.', body: null, score: 2, createdAt: hoursAgo(1), author: people.joy, hidden: false, deleted: false, voters: votersOf(2) },
    { id: 'c-6', postId: 'p-3', parentId: null, text: 'Thank you! Please message the team under Feedback so they can match you with a center.', body: null, score: 5, createdAt: hoursAgo(12), author: people.team, hidden: false, deleted: false, voters: votersOf(5) },
    { id: 'c-7', postId: 'p-4', parentId: null, text: 'Yes! Packing days are usually on Saturdays at the Quezon City office.', body: null, score: 4, createdAt: hoursAgo(20), author: people.team, hidden: false, deleted: false, voters: votersOf(4) },
  ];
  return { posts, comments };
}

export function createMockForumService(): ForumService {
  const db = seed();
  const me = (): ForumAuthor | null => {
    try {
      const m = JSON.parse(localStorage.getItem('philrads.guest.sampleAccount.v1') ?? 'null') as { id: string; name: string; avatar: string | null; color: string | null } | null;
      return m ? { id: m.id, name: m.name, avatar: m.avatar, color: m.color, staff: false } : null;
    } catch {
      return null;
    }
  };
  const need = () => {
    const m = me();
    if (!m) throw new Error('Sign in to take part');
    return m;
  };
  const wait = () => new Promise((r) => setTimeout(r, 120));
  const uid = () => me()?.id ?? '';
  const out = (p: MockPost): ForumPost => ({ ...p, voted: p.voters.has(uid()), mine: p.author.id === uid(), score: p.voters.size });
  const live = (p: MockPost) => !p.hidden && !p.deleted;

  return {
    source: 'mock',
    async topics() {
      return TOPICS;
    },
    async feed(topic, sort, offset = 0) {
      await wait();
      const now = Date.now();
      const hot = (p: MockPost) => (p.voters.size + p.commentCount * 0.5 + 1) / Math.pow((now - Date.parse(p.createdAt)) / 3_600_000 + 2, 1.5);
      const list = db.posts.filter((p) => live(p) && (!topic || p.topic === topic));
      list.sort((a, b) =>
        sort === 'new'
          ? b.createdAt.localeCompare(a.createdAt)
          : sort === 'top'
            ? b.voters.size - a.voters.size
            : Number(b.pinned) - Number(a.pinned) || hot(b) - hot(a),
      );
      return list.slice(offset, offset + FORUM_PAGE).map((p) => ({ ...out(p), body: p.body.slice(0, 700) }));
    },
    async post(id) {
      await wait();
      const p = db.posts.find((x) => x.id === id);
      return p && (live(p) || p.author.id === uid()) ? out(p) : null;
    },
    async comments(postId) {
      await wait();
      return db.comments
        .filter((c) => c.postId === postId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((c) => ({
          id: c.id,
          parentId: c.parentId,
          body: c.deleted || c.hidden ? null : c.text,
          score: c.voters.size,
          createdAt: c.createdAt,
          author: c.deleted ? { id: null, name: null, avatar: null, color: null, staff: false } : c.author,
          voted: c.voters.has(uid()),
          mine: c.author.id === uid(),
          hidden: c.hidden,
          deleted: c.deleted,
        }));
    },
    async createPost(topic, title, body) {
      const a = need();
      const t = TOPICS.find((x) => x.key === topic);
      if (!t) throw new Error('Choose a topic');
      if (t.staffOnly) throw new Error('Only PHILRADS staff post in this topic');
      if (title.trim().length < 3) throw new Error('Give your post a title');
      await wait();
      const id = `p-${Date.now()}`;
      db.posts.unshift({ id, topic, title: title.trim(), body: body.trim(), score: 0, commentCount: 0, pinned: false, createdAt: new Date().toISOString(), author: a, hidden: false, deleted: false, voters: new Set() });
      return id;
    },
    async comment(postId, parentId, body) {
      const a = need();
      const p = db.posts.find((x) => x.id === postId);
      if (!p || !live(p)) throw new Error('This post can’t take comments');
      if (!body.trim()) throw new Error('Write a comment first');
      await wait();
      const id = `c-${Date.now()}`;
      db.comments.push({ id, postId, parentId, text: body.trim(), body: null, score: 0, createdAt: new Date().toISOString(), author: a, hidden: false, deleted: false, voters: new Set() });
      p.commentCount += 1;
      return id;
    },
    async vote(kind, id, on) {
      const a = need();
      const item = kind === 'post' ? db.posts.find((x) => x.id === id) : db.comments.find((x) => x.id === id);
      if (!item) throw new Error('That isn’t here any more');
      if (on) item.voters.add(a.id!);
      else item.voters.delete(a.id!);
      return item.voters.size;
    },
    async report() {
      need();
      await wait();
    },
    async remove(kind, id) {
      const a = need();
      if (kind === 'post') {
        const p = db.posts.find((x) => x.id === id && x.author.id === a.id);
        if (!p) throw new Error('Only the person who wrote it can delete it');
        p.deleted = true;
      } else {
        const c = db.comments.find((x) => x.id === id && x.author.id === a.id);
        if (!c) throw new Error('Only the person who wrote it can delete it');
        c.deleted = true;
        const p = db.posts.find((x) => x.id === c.postId);
        if (p) p.commentCount = Math.max(0, p.commentCount - 1);
      }
    },
    async moderate() {
      throw new Error('Only staff with the Guest page can do this');
    },
    async review() {
      return [];
    },
  };
}
