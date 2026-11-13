import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AlertCircle, Check, Clock, CornerUpLeft, Lock, Search, SendHorizontal, Smile, Trash2, X } from 'lucide-react';
import { chatService } from '../../services';
import type { ChatMessage, GifResult } from '../../services/chat/chatService';
import { usePresence } from '../../lib/presence';
import { formatShortDate } from '../../lib/format';
import { PersonAvatar } from '../ui/PersonAvatar';
import { Sheet } from '../ui/Sheet';

interface Person {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  /** Only an ongoing project's chat takes new messages; the rest are read-only. */
  canPost: boolean;
  statusLabel: string;
  me: Person;
  team: Person[];
}

type Pending = ChatMessage & { state?: 'sending' | 'failed' };

const MAX = 2000;
const EMOJI = [
  '👍', '🙏', '😊', '😂', '❤️', '🎉', '🙌', '👏', '🔥', '✅', '💪', '🚀',
  '😅', '🤔', '😮', '😢', '😍', '🥳', '😎', '🤝', '👀', '💯', '⭐', '✨',
  '📦', '🚚', '🏠', '🍚', '💧', '🩺', '📸', '📍', '🗓️', '⏰', '📝', '📣',
  '☀️', '🌧️', '🌀', '⚠️', '🆗', '👋', '🙂', '😴', '🤗', '🫡', '💙', '🌱',
];

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const dayOf = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatShortDate(iso);
};

/**
 * The team chat of one project: messages live, who's typing, emoji and GIFs, replies. A full-height
 * sheet on phones and a side panel on wider screens.
 */
export function ProjectChat({ open, onClose, projectId, projectName, canPost, statusLabel, me, team }: Props) {
  const [messages, setMessages] = useState<Pending[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [panel, setPanel] = useState<'emoji' | 'gif' | null>(null);
  const [typing, setTyping] = useState<Record<string, { name: string; until: number }>>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const sub = useRef<{ typing(): void; close(): void } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const { statusOf } = usePresence();

  const names = useMemo(() => new Map(team.map((p) => [p.id, p.name])), [team]);
  const nameOf = (id: string) => (id === me.id ? 'You' : (names.get(id) ?? 'Former team member'));
  const online = team.filter((p) => p.id !== me.id && statusOf(p.id) !== 'offline').length;

  const upsert = useCallback((m: ChatMessage) => {
    setMessages((list) => {
      if (!list) return [m];
      const at = list.findIndex((x) => x.id === m.id);
      if (at >= 0) return list.map((x, i) => (i === at ? m : x));
      return [...list, m];
    });
  }, []);

  // Load, then stay live while the chat is open.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoadError(null);
    chatService.list(projectId).then(
      (list) => alive && setMessages(list),
      (e: unknown) => alive && setLoadError(e instanceof Error ? e.message : 'Couldn’t load the chat.'),
    );
    void chatService.markRead(projectId);
    sub.current = chatService.subscribe(projectId, { id: me.id, name: me.name }, {
      message(m) {
        upsert(m);
        setTyping((t) => {
          if (!t[m.authorId]) return t;
          const { [m.authorId]: _gone, ...rest } = t;
          return rest;
        });
        if (m.authorId !== me.id) void chatService.markRead(projectId);
      },
      typing(person) {
        setTyping((t) => ({ ...t, [person.id]: { name: person.name, until: Date.now() + 4000 } }));
      },
    });
    return () => {
      alive = false;
      sub.current?.close();
      sub.current = null;
    };
  }, [open, projectId, me.id, me.name, upsert]);

  // "Is typing" fades out when the signal stops.
  useEffect(() => {
    if (!Object.keys(typing).length) return;
    const t = setInterval(() => {
      const now = Date.now();
      setTyping((all) => Object.fromEntries(Object.entries(all).filter(([, v]) => v.until > now)));
    }, 1000);
    return () => clearInterval(t);
  }, [typing]);

  const typers = Object.entries(typing).map(([id, v]) => ({ id, name: names.get(id) ?? v.name }));

  // Keep the newest message in view.
  const count = messages?.length ?? 0;
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: 'end', behavior: count > 0 ? 'smooth' : 'auto' });
  }, [open, count, typers.length]);

  const send = async (body: string, gifUrl: string | null = null, retryOf?: Pending) => {
    const text = body.trim();
    if ((!text && !gifUrl) || text.length > MAX) return;
    setSendError(null);
    const temp: Pending = retryOf ?? {
      id: `tmp-${Date.now()}`,
      projectId,
      authorId: me.id,
      body: text,
      gifUrl,
      replyTo: replyTo?.id ?? null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    upsert({ ...temp, state: 'sending' } as Pending);
    if (!retryOf) {
      setDraft('');
      setReplyTo(null);
      setPanel(null);
      input.current?.focus();
    }
    try {
      const saved = await chatService.send(projectId, { body: temp.body, gifUrl: temp.gifUrl, replyTo: temp.replyTo });
      setMessages((list) => {
        const rest = (list ?? []).filter((x) => x.id !== temp.id && x.id !== saved.id);
        return [...rest, saved].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      });
    } catch (e) {
      upsert({ ...temp, state: 'failed' } as Pending);
      setSendError(e instanceof Error ? e.message : 'Couldn’t send it.');
    }
  };

  const remove = async (m: ChatMessage) => {
    setPicked(null);
    try {
      await chatService.remove(m.id);
      upsert({ ...m, body: '', gifUrl: null, deletedAt: new Date().toISOString() });
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Couldn’t delete it.');
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = input.current;
    const start = el?.selectionStart ?? draft.length;
    const stop = el?.selectionEnd ?? draft.length;
    const next = (draft.slice(0, start) + emoji + draft.slice(stop)).slice(0, MAX);
    setDraft(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  // The text box grows with what's typed, up to about five lines.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [draft]);

  // The Reply / Delete row of a tapped message comes into view.
  useEffect(() => {
    if (picked) document.querySelector(`[data-actions="${CSS.escape(picked)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [picked]);

  const byId = useMemo(() => new Map((messages ?? []).map((m) => [m.id, m])), [messages]);

  const subtitle = typers.length ? (
    <span className="font-medium text-uplift">{typers.length === 1 ? `${typers[0].name} is typing…` : `${typers.length} people are typing…`}</span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-status-in' : 'bg-ink-mute'}`} aria-hidden />
      {team.length} {team.length === 1 ? 'person' : 'people'} on the team · {online ? `${online} online` : 'nobody else online'}
    </span>
  );

  const footer = canPost ? (
    <div className="flex flex-col gap-2">
      {sendError && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-status-out/10 px-3 py-2 text-xs">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-status-out" aria-hidden /> {sendError}
        </p>
      )}
      {replyTo && (
        <div className="flex items-center gap-2 rounded-xl border-l-4 border-uplift bg-ink/[0.04] px-3 py-2 text-xs">
          <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          <p className="min-w-0 flex-1 truncate">
            Replying to <strong>{nameOf(replyTo.authorId)}</strong>: {replyTo.body || 'GIF'}
          </p>
          <button type="button" className="icon-btn -my-2 -mr-2 h-8 w-8" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      {panel === 'emoji' && <EmojiPanel onPick={insertEmoji} />}
      {panel === 'gif' && <GifPanel onPick={(g) => void send(draft, g.url)} />}
      <div className="flex items-end gap-2">
        <div className="flex min-h-12 min-w-0 flex-1 items-end gap-1 rounded-3xl border border-line bg-ink/[0.03] py-1 pl-1.5 pr-2 focus-within:border-uplift/70 focus-within:ring-2 focus-within:ring-uplift/25">
          <button
            type="button"
            className={`icon-btn h-10 w-10 shrink-0 ${panel === 'emoji' ? 'text-uplift' : ''}`}
            aria-label="Emoji"
            aria-pressed={panel === 'emoji'}
            onClick={() => setPanel((x) => (x === 'emoji' ? null : 'emoji'))}
          >
            <Smile className="h-5 w-5" aria-hidden />
          </button>
          <textarea
            ref={input}
            data-autofocus
            rows={1}
            value={draft}
            maxLength={MAX}
            onChange={(e) => {
              setDraft(e.target.value);
              sub.current?.typing();
            }}
            onKeyDown={onKey}
            placeholder="Message the team…"
            aria-label="Message"
            enterKeyHint="send"
            className="max-h-[8.25rem] min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-[0.9375rem] leading-snug outline-none placeholder:text-muted"
          />
          <button
            type="button"
            className={`mb-1.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wide ${panel === 'gif' ? 'border-uplift text-uplift' : 'border-line text-muted hover:text-ink'}`}
            aria-label="GIFs"
            aria-pressed={panel === 'gif'}
            onClick={() => setPanel((x) => (x === 'gif' ? null : 'gif'))}
          >
            GIF
          </button>
        </div>
        <button
          type="button"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-uplift text-onaccent shadow-lg shadow-uplift/25 transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
          aria-label="Send"
          disabled={!draft.trim()}
          onClick={() => void send(draft)}
        >
          <SendHorizontal className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {draft.length > MAX - 200 && <p className="text-right text-[0.6875rem] text-muted">{MAX - draft.length} characters left</p>}
    </div>
  ) : (
    <p className="flex items-center gap-2 rounded-xl bg-ink/[0.04] px-4 py-3 text-sm text-ink-soft">
      <Lock className="h-4 w-4 shrink-0" aria-hidden /> This project is {statusLabel.toLowerCase()}, so its chat is read-only.
    </p>
  );

  return (
    <Sheet open={open} onClose={onClose} title={`${projectName} chat`} subtitle={subtitle} footer={footer} dirty={Boolean(draft.trim())}>
      <div className="flex min-h-full flex-col justify-end gap-1" onClick={() => setPicked(null)}>
        {loadError ? (
          <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
            {loadError}
          </p>
        ) : messages === null ? (
          <p className="py-10 text-center text-sm text-muted">Loading the chat…</p>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-3xl" aria-hidden>
              👋
            </p>
            <p className="mt-2 font-semibold">No messages yet</p>
            <p className="mt-1 text-sm text-muted">Only this project’s team can read and post here.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const mine = m.authorId === me.id;
            const newDay = !prev || dayOf(prev.createdAt) !== dayOf(m.createdAt);
            const near = (a?: ChatMessage) => a && a.authorId === m.authorId && Math.abs(Date.parse(a.createdAt) - Date.parse(m.createdAt)) < 5 * 60_000;
            const first = newDay || !near(prev);
            const last = !near(next) || (next && dayOf(next.createdAt) !== dayOf(m.createdAt));
            const quoted = m.replyTo ? byId.get(m.replyTo) : undefined;
            const open = picked === m.id;
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <p className="my-3 self-center rounded-full bg-ink/[0.05] px-3 py-1 text-[0.6875rem] font-semibold text-muted">{dayOf(m.createdAt)}</p>
                )}
                <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} ${first ? 'mt-2' : ''}`}>
                  {!mine && (
                    <span className="w-8 shrink-0">{last && <PersonAvatar id={m.authorId} name={nameOf(m.authorId)} size="sm" ring="ring-0" frame={false} />}</span>
                  )}
                  <div className={`flex min-w-0 max-w-[80%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {first && (
                      <p className={`mb-1 flex items-baseline gap-2 px-1 text-[0.6875rem] ${mine ? 'flex-row-reverse' : ''}`}>
                        <span className="font-semibold text-ink-soft">{nameOf(m.authorId)}</span>
                        <span className="text-muted">{timeOf(m.createdAt)}</span>
                      </p>
                    )}
                    <button
                      type="button"
                      className={`chat-bubble text-left ${mine ? 'chat-bubble-mine' : 'chat-bubble-theirs'} ${m.deletedAt ? 'italic opacity-70' : ''} ${m.gifUrl && !m.body ? 'p-1' : 'px-3.5 py-2'}`}
                      aria-expanded={m.deletedAt ? undefined : open}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!m.deletedAt && !m.id.startsWith('tmp-')) setPicked(open ? null : m.id);
                      }}
                    >
                      {quoted && (
                        <span className="mb-1.5 block rounded-lg border-l-[3px] border-current/40 bg-black/10 px-2 py-1 text-xs opacity-80">
                          <strong className="block">{nameOf(quoted.authorId)}</strong>
                          <span className="line-clamp-2">{quoted.deletedAt ? 'Deleted message' : quoted.body || 'GIF'}</span>
                        </span>
                      )}
                      {m.deletedAt ? (
                        'Message deleted'
                      ) : (
                        <>
                          {m.gifUrl && <img src={m.gifUrl} alt="GIF" loading="lazy" referrerPolicy="no-referrer" className="block max-h-56 w-auto max-w-full rounded-xl" />}
                          {m.body && <span className={`block whitespace-pre-wrap break-words text-[0.9375rem] leading-snug ${m.gifUrl ? 'mt-1.5 px-2.5 pb-1.5' : ''}`}>{m.body}</span>}
                        </>
                      )}
                    </button>
                    {mine && last && (
                      <p className="mt-0.5 flex items-center gap-1 px-1 text-[0.625rem] text-muted">
                        {m.state === 'sending' ? (
                          <>
                            <Clock className="h-3 w-3" aria-hidden /> Sending
                          </>
                        ) : m.state === 'failed' ? (
                          <button type="button" className="font-semibold text-status-out underline" onClick={() => void send(m.body, m.gifUrl, m)}>
                            Not sent. Try again
                          </button>
                        ) : (
                          <>
                            <Check className="h-3 w-3" aria-hidden /> Sent {!first && timeOf(m.createdAt)}
                          </>
                        )}
                      </p>
                    )}
                    {open && (
                      <div data-actions={m.id} className="mt-1 flex animate-pop-in gap-1" onClick={(e) => e.stopPropagation()}>
                        {canPost && (
                          <button
                            type="button"
                            className="btn-ghost min-h-8 px-2.5 text-xs"
                            onClick={() => {
                              setReplyTo(m);
                              setPicked(null);
                              input.current?.focus();
                            }}
                          >
                            <CornerUpLeft className="h-3.5 w-3.5" aria-hidden /> Reply
                          </button>
                        )}
                        {mine && (
                          <button type="button" className="btn-ghost min-h-8 px-2.5 text-xs text-status-out" onClick={() => void remove(m)}>
                            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
        {typers.length > 0 && (
          <div className="mt-2 flex items-end gap-2" aria-live="polite">
            <span className="w-8 shrink-0">
              <PersonAvatar id={typers[0].id} name={typers[0].name} size="sm" ring="ring-0" frame={false} />
            </span>
            <span className="chat-bubble chat-bubble-theirs flex items-center gap-1 px-4 py-3" aria-label={`${typers[0].name} is typing`}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </div>
        )}
        <div ref={end} className="h-px" />
      </div>
    </Sheet>
  );
}

function EmojiPanel({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto overscroll-contain rounded-2xl border border-line/70 bg-ink/[0.03] p-2 sm:grid-cols-12" role="group" aria-label="Emoji">
      {EMOJI.map((e) => (
        <button key={e} type="button" className="grid h-10 place-items-center rounded-lg text-xl transition hover:bg-ink/[0.07] active:scale-90" onClick={() => onPick(e)} aria-label={e}>
          {e}
        </button>
      ))}
    </div>
  );
}

function GifPanel({ onPick }: { onPick: (g: GifResult) => void }) {
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<GifResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(
      () => {
        setError(null);
        chatService.gifs(q).then(
          (list) => alive && setGifs(list),
          (e: unknown) => {
            if (!alive) return;
            setGifs([]);
            setError(e instanceof Error ? e.message : 'Couldn’t load GIFs.');
          },
        );
      },
      q ? 350 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line/70 bg-ink/[0.03] p-2">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-page px-3">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <input className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search GIFs" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search GIFs" />
      </label>
      {error ? (
        <p className="px-1 py-3 text-center text-xs text-muted">{error}</p>
      ) : gifs === null ? (
        <p className="py-6 text-center text-xs text-muted">Loading…</p>
      ) : gifs.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">No GIFs found.</p>
      ) : (
        <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto overscroll-contain">
          {gifs.map((g) => (
            <button key={g.id} type="button" className="overflow-hidden rounded-lg bg-ink/[0.05] transition active:scale-95" onClick={() => onPick(g)} aria-label={g.title || 'Send this GIF'}>
              <img src={g.preview} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-24 w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="text-right text-[0.625rem] font-semibold uppercase tracking-wider text-muted">Powered by GIPHY</p>
    </div>
  );
}
