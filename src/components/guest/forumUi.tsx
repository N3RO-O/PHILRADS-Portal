import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowBigUp, BadgeCheck, ImagePlus, Pin, X } from 'lucide-react';
import { forumService } from '../../services';
import { useGuestAccount } from '../../services/guest/account';
import { FORUM_BODY_MAX, FORUM_TITLE_MAX, shrinkPicture, type ForumAuthor, type ForumKind, type ForumTopic } from '../../services/guest/forum';
import { initialsOf } from '../../lib/format';
import { timeAgo } from '../../lib/geo';
import { Avatar } from '../ui/Avatar';
import { BusyLabel } from '../ui/BusyLabel';
import { PrismMark } from '../ui/PrismMark';
import { Sheet } from '../ui/Sheet';
import { SignInPrompt } from './SignInPrompt';

/** Each topic's colour: a small dot beside its name, as a forum's flair. */
const TOPIC_COLOR: Record<string, string> = {
  updates: '#c2364a',
  stories: '#c99a2e',
  prayer: '#8a6bd1',
  needs: '#2f9a74',
  questions: '#3f86c9',
  fundraising: '#d9792e',
};
export const topicColor = (key: string) => TOPIC_COLOR[key] ?? '#8a8f98';

/** Until the topics load (or offline), the ones the database starts with. */
export const DEFAULT_TOPICS: ForumTopic[] = [
  { key: 'updates', name: 'Updates', description: 'News from the PHILRADS team.', staffOnly: true },
  { key: 'stories', name: 'Stories', description: 'What you saw, what you lived through, what helped.', staffOnly: false },
  { key: 'prayer', name: 'Prayer', description: 'Ask for prayer, or say how you are praying.', staffOnly: false },
  { key: 'needs', name: 'Needs and offers', description: 'A family that needs help, or help you can give.', staffOnly: false },
  { key: 'questions', name: 'Questions', description: 'Ask PHILRADS or the community.', staffOnly: false },
  { key: 'fundraising', name: 'Fundraising', description: 'Fundraisers, and ideas to raise more.', staffOnly: false },
];

export function TopicTag({ topic, name }: { topic: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-ink-soft">
      <span className="h-2 w-2 rounded-full" style={{ background: topicColor(topic) }} aria-hidden />
      {name}
    </span>
  );
}

/** PHILRADS staff carry the mark beside their name. */
export function StaffMark() {
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold text-uplift" title="PHILRADS staff">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">PHILRADS staff</span>
    </span>
  );
}

/** "Joy ✓ · Prayer · 3 h ago": who, where and when, above a post or comment. */
export function Byline({ author, official, topic, at, pinned, size = 'xs' }: { author?: ForumAuthor; official?: boolean; topic?: { key: string; name: string }; at: string | null; pinned?: boolean; size?: 'xs' | 'sm' }) {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
      {official ? (
        <>
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-burgundy-600" aria-hidden>
            <PrismMark className="h-4 w-4 text-cloud" />
          </span>
          <span className="font-semibold text-ink">PHILRADS</span>
          <StaffMark />
        </>
      ) : author?.name ? (
        <>
          <Avatar initials={initialsOf(author.name)} src={author.avatar} color={author.color} size={size} ring="ring-0" />
          <span className="font-semibold text-ink">{author.name}</span>
          {author.staff && <StaffMark />}
        </>
      ) : (
        <span className="font-semibold text-ink-soft">Deleted</span>
      )}
      {topic && (
        <>
          <span aria-hidden>·</span>
          <TopicTag topic={topic.key} name={topic.name} />
        </>
      )}
      {at && (
        <>
          <span aria-hidden>·</span>
          <time dateTime={at}>{timeAgo(at)}</time>
        </>
      )}
      {pinned && (
        <span className="ml-1 inline-flex items-center gap-1 font-semibold text-status-in">
          <Pin className="h-3 w-3" aria-hidden /> Pinned
        </span>
      )}
    </p>
  );
}

/** The upvote: the arrow fills in the portal's yellow when it's yours. */
export function Upvote({ count, on, busy, onToggle, label }: { count: number; on: boolean; busy?: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      disabled={busy}
      aria-pressed={on}
      aria-label={`${on ? 'Remove your upvote from' : 'Upvote'} ${label}, ${count} ${count === 1 ? 'upvote' : 'upvotes'}`}
      className={`relative z-10 inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-bold tabular-nums transition-colors ${on ? 'text-uplift' : 'text-ink-soft hover:bg-ink/[0.06] hover:text-ink'}`}
    >
      <ArrowBigUp className={`h-5 w-5 ${on ? 'fill-current' : ''}`} strokeWidth={1.75} aria-hidden />
      {count}
    </button>
  );
}

/** A quiet action under a post or comment: Comments, Reply, Share, Report. */
export function ActionButton({ children, onClick, label }: { children: ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className="relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-ink/[0.06] hover:text-ink"
    >
      {children}
    </button>
  );
}

/**
 * Taking part needs an account: anything that writes asks this first. Signed out, it opens a small
 * sheet with the sign-in button instead.
 */
export function useJoinPrompt() {
  const { status } = useGuestAccount();
  const [asking, setAsking] = useState<string | null>(null);
  const needIn = useCallback(
    (why: string, then: () => void) => {
      if (status === 'in') then();
      else setAsking(why);
    },
    [status],
  );
  const prompt = (
    <Sheet open={asking !== null} onClose={() => setAsking(null)} title="Join the conversation">
      <SignInPrompt compact title={asking ?? ''} body="Sign in to post, comment and upvote. It’s free." />
    </Sheet>
  );
  return { needIn, prompt };
}

const REASONS = ['Spam or selling', 'Rude or hurtful', 'Not true', 'Someone’s private information', 'Something else'];

/** Report a post or comment to PHILRADS staff. */
export function ReportSheet({ target, onClose }: { target: { kind: ForumKind; id: string } | null; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const close = () => {
    setMsg(null);
    setNote('');
    onClose();
  };
  const send = async () => {
    if (!target) return;
    setBusy(true);
    setMsg(null);
    try {
      await forumService.report(target.kind, target.id, note.trim() ? `${reason}: ${note.trim()}` : reason);
      setMsg({ ok: true, text: 'Thank you. PHILRADS staff will take a look.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'The report didn’t go through. Try again.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={target !== null} onClose={close} title={`Report this ${target?.kind ?? 'post'}`} subtitle="Only PHILRADS staff see reports. Three reports hide it until staff look.">
      {msg?.ok ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-sm text-ink">{msg.text}</p>
          <button type="button" className="btn-primary self-start" onClick={close}>
            Done
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col divide-y divide-line/70 border-y border-line/70">
            <legend className="sr-only">What’s wrong with it?</legend>
            {REASONS.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-3 py-3 text-sm text-ink">
                <input type="radio" name="report-reason" className="h-4 w-4 accent-[rgb(var(--uplift))]" checked={reason === r} onChange={() => setReason(r)} />
                {r}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">
              Anything to add? <span className="font-normal text-muted">(optional)</span>
            </span>
            <input className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          </label>
          {msg && <p className="text-sm text-status-out">{msg.text}</p>}
          <button type="button" className="btn-primary self-start" disabled={busy} onClick={() => void send()}>
            <BusyLabel busy={busy} busyText="Sending…">
              Send report
            </BusyLabel>
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** Write a post: a topic, a title, and (optionally) more. Opens the post once it's up. */
export function ComposerSheet({ open, onClose, topics, topic: initial, canPostUpdates }: { open: boolean; onClose: () => void; topics: ForumTopic[]; topic: string | null; canPostUpdates: boolean }) {
  const navigate = useNavigate();
  const { status } = useGuestAccount();
  const choices = topics.filter((t) => !t.staffOnly || canPostUpdates);
  const [topic, setTopic] = useState(() => (choices.some((t) => t.key === initial) ? initial! : (choices.find((t) => t.key === 'questions') ?? choices[0])?.key ?? ''));
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picture, setPicture] = useState<{ blob: Blob; url: string } | null>(null);
  const [shrinking, setShrinking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = Boolean(title.trim() || body.trim() || picture);
  useEffect(() => () => {
    if (picture) URL.revokeObjectURL(picture.url);
  }, [picture]);

  const pick = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setShrinking(true);
    setError(null);
    try {
      const blob = await shrinkPicture(file);
      setPicture({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That picture couldn’t be read. Try another.');
    } finally {
      setShrinking(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      setError('Give your post a title (at least 3 letters).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await forumService.createPost(topic, title, body, picture?.blob ?? null);
      setTitle('');
      setBody('');
      setPicture(null);
      onClose();
      navigate(`/guest/post?id=${encodeURIComponent(id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your post didn’t go up. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Create a post" subtitle="Everyone here can read it." dirty={dirty}>
      {status !== 'in' ? (
        <SignInPrompt compact title="Sign in to post" body="It’s free. We’ll email you a code." />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Topic</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {choices.map((t) => (
                <button key={t.key} type="button" aria-pressed={topic === t.key} onClick={() => setTopic(t.key)} className="chip gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: topicColor(t.key) }} aria-hidden /> {t.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{choices.find((t) => t.key === topic)?.description}</p>
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-sm font-semibold text-ink">
              Title <span className="font-normal tabular-nums text-muted">{title.length}/{FORUM_TITLE_MAX}</span>
            </span>
            <input data-autofocus className="field" value={title} maxLength={FORUM_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="What’s it about?" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">
              More <span className="font-normal text-muted">(optional)</span>
            </span>
            <textarea className="field min-h-[7rem] resize-y py-2.5" value={body} maxLength={FORUM_BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder="Tell us more." />
          </label>
          {picture ? (
            <div className="relative self-start">
              <img src={picture.url} alt="Your picture" className="max-h-64 max-w-full rounded-xl" />
              <button type="button" onClick={() => setPicture(null)} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/75" aria-label="Remove the picture">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : (
            <button type="button" className="chip gap-1.5 self-start" onClick={() => fileInput.current?.click()} disabled={shrinking}>
              <ImagePlus className="h-4 w-4" aria-hidden />
              <BusyLabel busy={shrinking} busyText="Getting it ready…">
                Add a picture
              </BusyLabel>
            </button>
          )}
          <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void pick(e.target.files?.[0])} />
          <p className="text-xs text-muted">No addresses, numbers or photos of people without asking.</p>
          {error && <p role="alert" className="text-sm text-status-out">{error}</p>}
          <button type="submit" className="btn-primary self-start" disabled={busy || shrinking || !topic}>
            <BusyLabel busy={busy} busyText="Posting…">
              Post
            </BusyLabel>
          </button>
        </form>
      )}
    </Sheet>
  );
}
