import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, EyeOff, Flag, MessageCircle, Pin, PinOff, Reply, Trash2, Eye } from 'lucide-react';
import { forumService } from '../../services';
import { useAuth } from '../auth/AuthProvider';
import { useGuestAccount } from '../../services/guest/account';
import { FORUM_COMMENT_MAX, type ForumAction, type ForumComment, type ForumKind, type ForumPost } from '../../services/guest/forum';
import { BusyLabel } from '../ui/BusyLabel';
import { ShareButton } from './guestUi';
import { ActionButton, Byline, DEFAULT_TOPICS, ReportSheet, Upvote, useJoinPrompt } from './forumUi';

/** Replies indent this deep; deeper ones line up with the last level, so phones keep their width. */
const MAX_DEPTH = 4;

function CommentBox({ placeholder, onSend, onCancel, autoFocus }: { placeholder: string; onSend: (text: string) => Promise<void>; onCancel?: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(text);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your comment didn’t go up. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="field min-h-[5.5rem] resize-y py-2.5"
        value={text}
        maxLength={FORUM_COMMENT_MAX}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
      {error && <p role="alert" className="text-sm text-status-out">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" className="btn-primary min-h-9 px-4 text-sm" disabled={busy || !text.trim()} onClick={() => void send()}>
          <BusyLabel busy={busy} busyText="Posting…">
            Comment
          </BusyLabel>
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost min-h-9 px-3 text-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

interface Ctx {
  postOpen: boolean;
  mod: boolean;
  needIn: (why: string, then: () => void) => void;
  onReply: (parent: string, text: string) => Promise<void>;
  onVote: (c: ForumComment) => void;
  onReport: (kind: ForumKind, id: string) => void;
  onDelete: (kind: ForumKind, id: string) => Promise<void>;
  onModerate: (kind: ForumKind, id: string, a: ForumAction) => Promise<void>;
}

function CommentNode({ c, kids, depth, ctx }: { c: ForumComment; kids: Map<string | null, ForumComment[]>; depth: number; ctx: Ctx }) {
  const [replying, setReplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const replies = kids.get(c.id) ?? [];
  const gone = c.deleted || (c.hidden && c.body === null);
  return (
    <li className="flex flex-col">
      <div className="flex flex-col gap-1.5 py-2.5">
        <div className="flex items-center gap-2">
          <Byline author={c.author} at={c.deleted ? null : c.createdAt} />
          {c.hidden && <span className="text-xs font-semibold text-status-low">Hidden</span>}
        </div>
        {collapsed ? null : gone ? (
          <p className="text-sm italic text-muted">{c.deleted ? 'Comment deleted by its writer.' : 'Comment hidden by PHILRADS staff.'}</p>
        ) : (
          <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink">{c.body}</p>
        )}
        {!collapsed && !gone && (
          <div className="-ml-2 flex flex-wrap items-center">
            <Upvote count={c.score} on={c.voted} label="this comment" onToggle={() => ctx.needIn('Sign in to upvote', () => ctx.onVote(c))} />
            {ctx.postOpen && (
              <ActionButton onClick={() => ctx.needIn('Sign in to reply', () => setReplying((r) => !r))}>
                <Reply className="h-4 w-4" aria-hidden /> Reply
              </ActionButton>
            )}
            {c.mine ? (
              confirming ? (
                <span className="inline-flex items-center gap-1 px-2 text-xs text-ink-soft">
                  Delete it?
                  <button type="button" className="font-semibold text-status-out hover:underline" onClick={() => void ctx.onDelete('comment', c.id)}>
                    Delete
                  </button>
                  <button type="button" className="font-semibold text-ink hover:underline" onClick={() => setConfirming(false)}>
                    Keep
                  </button>
                </span>
              ) : (
                <ActionButton onClick={() => setConfirming(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete
                </ActionButton>
              )
            ) : (
              <ActionButton label="Report this comment" onClick={() => ctx.needIn('Sign in to report', () => ctx.onReport('comment', c.id))}>
                <Flag className="h-4 w-4" aria-hidden />
              </ActionButton>
            )}
            {ctx.mod && (
              <ActionButton onClick={() => void ctx.onModerate('comment', c.id, c.hidden ? 'unhide' : 'hide')}>
                {c.hidden ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />} {c.hidden ? 'Unhide' : 'Hide'}
              </ActionButton>
            )}
          </div>
        )}
        {replying && (
          <div className="mt-1">
            <CommentBox
              autoFocus
              placeholder={`Reply to ${c.author.name ?? 'this comment'}`}
              onCancel={() => setReplying(false)}
              onSend={async (t) => {
                await ctx.onReply(c.id, t);
                setReplying(false);
              }}
            />
          </div>
        )}
      </div>
      {replies.length > 0 && (
        <div className="flex">
          {/* The thread line: press it to fold the replies away, as forums do. */}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? `Show ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'Hide the replies'}
            aria-expanded={!collapsed}
            className="group mr-3 flex w-4 shrink-0 justify-center"
          >
            <span className="w-px bg-line transition-colors group-hover:bg-uplift" />
          </button>
          {collapsed ? (
            <button type="button" onClick={() => setCollapsed(false)} className="py-1 text-xs font-semibold text-uplift hover:underline">
              {replies.length === 1 ? '1 more reply' : `${replies.length} more replies`}
            </button>
          ) : (
            <ul className={`min-w-0 flex-1 ${depth >= MAX_DEPTH ? '-ml-7' : ''}`}>
              {replies.map((r) => (
                <CommentNode key={r.id} c={r} kids={kids} depth={depth + 1} ctx={ctx} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** One post in full, with its comments as threads. */
export function PostSection() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const id = search.get('id') ?? '';
  const { can } = useAuth();
  const { staff } = useGuestAccount();
  const mod = staff && can('guest.manage');
  const { needIn, prompt } = useJoinPrompt();

  const [post, setPost] = useState<ForumPost | null | undefined>(undefined);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<'best' | 'new'>('best');
  const [reporting, setReporting] = useState<{ kind: ForumKind; id: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([forumService.post(id), forumService.comments(id)]);
      setPost(p);
      setComments(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This post couldn’t load.');
    }
  }, [id]);
  useEffect(() => {
    setPost(undefined);
    void load();
  }, [load]);
  useEffect(() => {
    if (post?.title) document.title = `${post.title} · PRISM Guest`;
  }, [post?.title]);

  const kids = useMemo(() => {
    const m = new Map<string | null, ForumComment[]>();
    for (const c of comments) {
      // A reply whose parent isn't here (shouldn't happen) shows at the top level.
      const parent = c.parentId && comments.some((x) => x.id === c.parentId) ? c.parentId : null;
      m.set(parent, [...(m.get(parent) ?? []), c]);
    }
    const top = m.get(null) ?? [];
    m.set(null, order === 'best' ? [...top].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt)) : [...top].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    return m;
  }, [comments, order]);

  const votePost = async () => {
    if (!post) return;
    const on = !post.voted;
    setPost({ ...post, voted: on, score: post.score + (on ? 1 : -1) });
    try {
      const score = await forumService.vote('post', post.id, on);
      setPost((p) => (p ? { ...p, score, voted: on } : p));
    } catch {
      setPost(post);
    }
  };
  const ctx: Ctx = {
    postOpen: Boolean(post && !post.hidden && !post.deleted),
    mod,
    needIn,
    onReply: async (parent, text) => {
      await forumService.comment(id, parent, text);
      await load();
    },
    onVote: async (c) => {
      const on = !c.voted;
      const patch = (score: number, voted: boolean) => setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, score, voted } : x)));
      patch(c.score + (on ? 1 : -1), on);
      try {
        patch(await forumService.vote('comment', c.id, on), on);
      } catch {
        patch(c.score, c.voted);
      }
    },
    onReport: (kind, rid) => setReporting({ kind, id: rid }),
    onDelete: async (kind, rid) => {
      try {
        await forumService.remove(kind, rid);
        if (kind === 'post') navigate('/guest', { replace: true });
        else await load();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'That didn’t work. Try again.');
      }
    },
    onModerate: async (kind, rid, a) => {
      try {
        await forumService.moderate(kind, rid, a);
        await load();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'That didn’t work. Try again.');
      }
    },
  };

  const back = (
    <Link to="/guest" className="hit inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Community
    </Link>
  );

  if (error)
    return (
      <div className="flex flex-col items-start gap-3 py-4">
        {back}
        <p className="text-sm text-ink-soft">{error}</p>
        <button type="button" className="chip" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  if (post === undefined)
    return (
      <div className="flex flex-col gap-3 py-4" aria-label="Loading the post">
        {back}
        <span className="h-3 w-48 animate-pulse rounded bg-surface-sunken" />
        <span className="h-6 w-3/4 animate-pulse rounded bg-surface-sunken" />
        <span className="h-20 w-full animate-pulse rounded bg-surface-sunken" />
      </div>
    );
  if (post === null)
    return (
      <div className="flex flex-col items-start gap-3 py-4">
        {back}
        <h1 id="guest-title" className="text-xl font-bold text-ink">
          This post isn’t here
        </h1>
        <p className="text-sm text-ink-soft">It may have been deleted by its writer, or hidden by PHILRADS staff.</p>
      </div>
    );

  const topic = { key: post.topic, name: DEFAULT_TOPICS.find((t) => t.key === post.topic)?.name ?? post.topic };
  const path = `/guest/post?id=${encodeURIComponent(post.id)}`;
  return (
    <div className="flex flex-col pb-6">
      <div className="py-2">{back}</div>
      <article aria-labelledby="guest-title" className="flex flex-col gap-3 border-b border-line/70 pb-3 pt-2">
        <Byline author={post.author} topic={topic} at={post.createdAt} pinned={post.pinned} size="sm" />
        {(post.hidden || post.deleted) && (
          <p className="border-l-4 border-status-low bg-status-low/10 px-3 py-2 text-sm text-ink">
            {post.deleted ? 'You deleted this post. Only you can see it.' : 'This post is hidden from the guest page.'}
          </p>
        )}
        <h1 id="guest-title" className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
          {post.title}
        </h1>
        {post.body && <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-ink">{post.body}</p>}
        {post.image && (
          <a href={post.image} target="_blank" rel="noopener noreferrer" className="self-start" aria-label="Open the picture full size">
            <img src={post.image} alt="" className="max-h-[40rem] w-auto max-w-full rounded-xl bg-surface-sunken" />
          </a>
        )}
        <div className="-ml-2 flex flex-wrap items-center">
          <Upvote count={post.score} on={post.voted} label={post.title} onToggle={() => needIn('Sign in to upvote', () => void votePost())} />
          <span className="inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-semibold text-ink-soft">
            <MessageCircle className="h-4 w-4" aria-hidden /> {post.commentCount === 1 ? '1 comment' : `${post.commentCount} comments`}
          </span>
          <ShareButton title={post.title} path={path} className="!min-h-8 !border-0 !bg-transparent !px-2.5 !text-xs !text-ink-soft hover:!bg-ink/[0.06]" />
          {post.mine ? (
            confirming ? (
              <span className="inline-flex items-center gap-1.5 px-2 text-xs text-ink-soft">
                Delete this post?
                <button type="button" className="font-semibold text-status-out hover:underline" onClick={() => void ctx.onDelete('post', post.id)}>
                  Delete
                </button>
                <button type="button" className="font-semibold text-ink hover:underline" onClick={() => setConfirming(false)}>
                  Keep
                </button>
              </span>
            ) : (
              !post.deleted && (
                <ActionButton onClick={() => setConfirming(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete
                </ActionButton>
              )
            )
          ) : (
            <ActionButton onClick={() => needIn('Sign in to report', () => setReporting({ kind: 'post', id: post.id }))}>
              <Flag className="h-4 w-4" aria-hidden /> Report
            </ActionButton>
          )}
          {mod && (
            <>
              <ActionButton onClick={() => void ctx.onModerate('post', post.id, post.pinned ? 'unpin' : 'pin')}>
                {post.pinned ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />} {post.pinned ? 'Unpin' : 'Pin'}
              </ActionButton>
              <ActionButton onClick={() => void ctx.onModerate('post', post.id, post.hidden ? 'unhide' : 'hide')}>
                {post.hidden ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />} {post.hidden ? 'Unhide' : 'Hide'}
              </ActionButton>
            </>
          )}
        </div>
      </article>

      {ctx.postOpen && (
        <section aria-label="Add a comment" className="border-b border-line/70 py-4">
          <JoinOrComment needIn={needIn} onSend={async (t) => {
            await forumService.comment(id, null, t);
            await load();
          }} />
        </section>
      )}

      <section aria-labelledby="comments-title" className="pt-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="comments-title" className="text-sm font-bold text-ink">
            Comments
          </h2>
          <div className="flex gap-1" role="group" aria-label="Order comments">
            {(['best', 'new'] as const).map((o) => (
              <button key={o} type="button" aria-pressed={order === o} onClick={() => setOrder(o)} className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${order === o ? 'bg-ink/[0.07] text-ink' : 'text-muted hover:text-ink'}`}>
                {o === 'best' ? 'Best' : 'Newest'}
              </button>
            ))}
          </div>
        </div>
        {comments.length === 0 ? (
          <p className="py-6 text-sm text-muted">No comments yet. Say something kind.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line/50">
            {(kids.get(null) ?? []).map((c) => (
              <CommentNode key={c.id} c={c} kids={kids} depth={1} ctx={ctx} />
            ))}
          </ul>
        )}
      </section>
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
      {prompt}
    </div>
  );
}

/** Signed in: the comment box. Signed out: a quiet row that opens the invitation to sign in. */
function JoinOrComment({ needIn, onSend }: { needIn: (why: string, then: () => void) => void; onSend: (t: string) => Promise<void> }) {
  const { status } = useGuestAccount();
  if (status === 'in') return <CommentBox placeholder="Add a comment" onSend={onSend} />;
  return (
    <button type="button" onClick={() => needIn('Sign in to comment', () => {})} className="field flex w-full items-center text-left text-muted">
      Add a comment
    </button>
  );
}
