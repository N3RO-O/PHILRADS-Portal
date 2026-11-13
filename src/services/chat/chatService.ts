import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Project chat: one chat per ongoing project, for its team only (the account enforces it:
 * supabase/migrations/20261120000000_project_chat.sql). Messages arrive live; "is typing" is a
 * short-lived signal between the people in the chat (never what they're typing).
 */
export interface ChatMessage {
  id: string;
  projectId: string;
  authorId: string;
  body: string;
  /** A GIPHY GIF, shown as the message (or under its text). */
  gifUrl: string | null;
  replyTo: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface ChatDraft {
  body: string;
  gifUrl?: string | null;
  replyTo?: string | null;
}

export interface GifResult {
  id: string;
  title: string;
  /** The GIF sent in the chat. */
  url: string;
  /** A smaller copy for the picker. */
  preview: string;
  width: number;
  height: number;
}

export interface ChatSubscription {
  /** Tell the others you're typing (call on each keystroke; it's throttled). */
  typing(): void;
  close(): void;
}

export interface ChatService {
  /** The latest messages, oldest first. */
  list(projectId: string): Promise<ChatMessage[]>;
  send(projectId: string, draft: ChatDraft): Promise<ChatMessage>;
  remove(messageId: string): Promise<void>;
  markRead(projectId: string): Promise<void>;
  /** Unread messages per project, for the chats you're on. */
  unread(): Promise<Record<string, number>>;
  /** GIPHY search (trending when the words are empty), through /api/gifs. */
  gifs(q: string): Promise<GifResult[]>;
  subscribe(
    projectId: string,
    me: { id: string; name: string },
    on: { message(m: ChatMessage): void; typing(person: { id: string; name: string }): void },
  ): ChatSubscription;
}

/** GIFs may only come from GIPHY's own servers (the account checks this too). */
export const isGifUrl = (url: string) => /^https:\/\/(media[0-9]*|i)\.giphy\.com\//.test(url);

const LIMIT = 300;

// ───────────────────────── Sample (demo) ─────────────────────────

const key = (projectId: string) => `philrads.chat.v1.${projectId}`;
const readKey = 'philrads.chat.read.v1';
const bus = new EventTarget();

function load(projectId: string, seed: () => ChatMessage[]): ChatMessage[] {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {
    /* storage blocked: a fresh sample each time */
  }
  const s = seed();
  if (s.length) save(projectId, s);
  return s;
}
function save(projectId: string, list: ChatMessage[]) {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(list.slice(-LIMIT)));
  } catch {
    /* kept for this visit only */
  }
}
const reads = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(readKey) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
};

/** Who's on a sample project's team, so the demo chat has voices. Set by the Projects page. */
const sampleTeams = new Map<string, { id: string; name: string }[]>();
export const setSampleTeam = (projectId: string, people: { id: string; name: string }[]) => sampleTeams.set(projectId, people);

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const SAMPLE_LINES = [
  'Morning team! Trucks leave the warehouse at 8:30.',
  'Copy. I’ll bring the attendance sheets for Purok 3.',
  'Barangay captain confirmed the covered court for distribution 👍',
  'Please upload today’s photos to Documentation before 5 PM.',
];
const REPLIES = ['Noted, thanks! 🙏', 'On it.', 'Got it 👍', 'Sounds good. See you there!', 'Thanks for the update.'];

function seedFor(projectId: string, meId: string): ChatMessage[] {
  const team = (sampleTeams.get(projectId) ?? []).filter((p) => p.id !== meId);
  if (!team.length) return [];
  return SAMPLE_LINES.map((body, i) => ({
    id: `${projectId}-seed-${i}`,
    projectId,
    authorId: team[i % team.length].id,
    body,
    gifUrl: null,
    replyTo: null,
    createdAt: ago(180 - i * 35),
    deletedAt: null,
  }));
}

let sampleMe = 'demo-user';

export const mockChatService: ChatService = {
  async list(projectId) {
    return load(projectId, () => seedFor(projectId, sampleMe));
  },
  async send(projectId, draft) {
    const m: ChatMessage = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      projectId,
      authorId: sampleMe,
      body: draft.body.trim(),
      gifUrl: draft.gifUrl ?? null,
      replyTo: draft.replyTo ?? null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    save(projectId, [...load(projectId, () => []), m]);
    bus.dispatchEvent(new CustomEvent('message', { detail: m }));
    // Demo: a teammate starts typing, then answers.
    const team = (sampleTeams.get(projectId) ?? []).filter((p) => p.id !== sampleMe);
    if (team.length) {
      const who = team[Math.floor(Math.random() * team.length)];
      setTimeout(() => bus.dispatchEvent(new CustomEvent('typing', { detail: { projectId, person: who } })), 900);
      setTimeout(() => bus.dispatchEvent(new CustomEvent('typing', { detail: { projectId, person: who } })), 2400);
      setTimeout(() => {
        const r: ChatMessage = { id: `${m.id}-r`, projectId, authorId: who.id, body: REPLIES[Math.floor(Math.random() * REPLIES.length)], gifUrl: null, replyTo: null, createdAt: new Date().toISOString(), deletedAt: null };
        save(projectId, [...load(projectId, () => []), r]);
        bus.dispatchEvent(new CustomEvent('message', { detail: r }));
      }, 3600);
    }
    return m;
  },
  async remove(messageId) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('philrads.chat.v1.')) continue;
      const projectId = k.slice('philrads.chat.v1.'.length);
      const list = load(projectId, () => []);
      const at = list.findIndex((m) => m.id === messageId);
      if (at < 0) continue;
      list[at] = { ...list[at], body: '', gifUrl: null, deletedAt: new Date().toISOString() };
      save(projectId, list);
      bus.dispatchEvent(new CustomEvent('message', { detail: list[at] }));
      return;
    }
  },
  async markRead(projectId) {
    const r = reads();
    r[projectId] = new Date().toISOString();
    try {
      localStorage.setItem(readKey, JSON.stringify(r));
    } catch {
      /* ignore */
    }
  },
  async unread() {
    const r = reads();
    const out: Record<string, number> = {};
    for (const [projectId] of sampleTeams) {
      const n = load(projectId, () => seedFor(projectId, sampleMe)).filter((m) => m.authorId !== sampleMe && !m.deletedAt && m.createdAt > (r[projectId] ?? '')).length;
      if (n) out[projectId] = n;
    }
    return out;
  },
  async gifs() {
    throw new Error('GIFs work on the live portal (sample data here).');
  },
  subscribe(projectId, me, on) {
    sampleMe = me.id;
    const onMessage = (e: Event) => {
      const m = (e as CustomEvent<ChatMessage>).detail;
      if (m.projectId === projectId) on.message(m);
    };
    const onTyping = (e: Event) => {
      const d = (e as CustomEvent<{ projectId: string; person: { id: string; name: string } }>).detail;
      if (d.projectId === projectId) on.typing(d.person);
    };
    bus.addEventListener('message', onMessage);
    bus.addEventListener('typing', onTyping);
    return {
      typing() {
        /* nobody else is really here in the demo */
      },
      close() {
        bus.removeEventListener('message', onMessage);
        bus.removeEventListener('typing', onTyping);
      },
    };
  },
};

// ───────────────────────── Live ─────────────────────────

const COLUMNS = 'id, project_id, author_id, body, gif_url, reply_to, created_at, deleted_at';
const fromRow = (r: Record<string, unknown>): ChatMessage => ({
  id: r.id as string,
  projectId: r.project_id as string,
  authorId: r.author_id as string,
  body: (r.body as string) ?? '',
  gifUrl: (r.gif_url as string | null) ?? null,
  replyTo: (r.reply_to as string | null) ?? null,
  createdAt: r.created_at as string,
  deletedAt: (r.deleted_at as string | null) ?? null,
});

const friendly = (message: string) =>
  /row-level security|42501|permission/i.test(message)
    ? 'Only the project team can post here, and only while the project is ongoing.'
    : 'Couldn’t send it. Check your connection and try again.';

export function createSupabaseChatService(client: SupabaseClient): ChatService {
  return {
    async list(projectId) {
      const { data, error } = await client.from('project_messages').select(COLUMNS).eq('project_id', projectId).order('created_at', { ascending: false }).limit(LIMIT);
      if (error) throw new Error('Couldn’t load the chat. Try again.');
      return (data ?? []).map(fromRow).reverse();
    },
    async send(projectId, draft) {
      const { data, error } = await client
        .from('project_messages')
        .insert({ project_id: projectId, body: draft.body.trim(), gif_url: draft.gifUrl ?? null, reply_to: draft.replyTo ?? null })
        .select(COLUMNS)
        .single();
      if (error || !data) throw new Error(friendly(error?.message ?? ''));
      return fromRow(data);
    },
    async remove(messageId) {
      const { error } = await client.rpc('delete_project_message', { p_id: messageId });
      if (error) throw new Error('Couldn’t delete it. Try again.');
    },
    async markRead(projectId) {
      await client.rpc('mark_project_chat_read', { p_project: projectId });
    },
    async unread() {
      const { data, error } = await client.rpc('project_chat_unread');
      if (error || !data) return {};
      return Object.fromEntries((data as { project_id: string; unread: number }[]).map((r) => [r.project_id, r.unread]));
    },
    async gifs(q) {
      const { data } = await client.auth.getSession();
      let res: Response;
      try {
        res = await fetch(`/api/gifs?q=${encodeURIComponent(q.trim())}`, { headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
      } catch {
        throw new Error('Couldn’t reach GIPHY. Check your connection.');
      }
      const body = (await res.json().catch(() => null)) as { gifs?: GifResult[]; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? 'Couldn’t load GIFs.');
      return (body?.gifs ?? []).filter((g) => isGifUrl(g.url) && isGifUrl(g.preview));
    },
    subscribe(projectId, me, on) {
      let channel: RealtimeChannel | null = client
        .channel(`project-chat-${projectId}`, { config: { broadcast: { self: false } } })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'project_messages', filter: `project_id=eq.${projectId}` }, (p) => {
          if (p.new && (p.new as { id?: string }).id) on.message(fromRow(p.new as Record<string, unknown>));
        })
        .on('broadcast', { event: 'typing' }, (p) => {
          const who = p.payload as { id?: string; name?: string };
          if (who?.id && who.id !== me.id) on.typing({ id: who.id, name: String(who.name ?? 'Someone') });
        })
        .subscribe();
      let last = 0;
      return {
        typing() {
          const now = Date.now();
          if (!channel || now - last < 2000) return;
          last = now;
          void channel.send({ type: 'broadcast', event: 'typing', payload: { id: me.id, name: me.name } });
        },
        close() {
          if (channel) void client.removeChannel(channel);
          channel = null;
        },
      };
    },
  };
}
