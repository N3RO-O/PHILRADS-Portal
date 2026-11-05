import type { SupabaseClient } from '@supabase/supabase-js';
import { demoProfile } from '../../data/mockDashboard';
import { initialsOf, manilaDayKey } from '../../lib/format';

/** How long a reflection can be: a thought, not an essay (the database checks this too). */
export const REFLECTION_MAX = 280;

/** One person's short reflection on the day's verse (Home → Verse of the day → Read more). */
export interface Reflection {
  id: string;
  authorId: string;
  authorName: string;
  initials: string;
  avatar: string | null;
  color: string | null;
  body: string;
  createdAt: string;
  edited: boolean;
  mine: boolean;
}

export interface ReflectionsService {
  readonly source: 'supabase' | 'mock';
  /** Everyone's reflections on today's verse, newest first. */
  today(): Promise<Reflection[]>;
  /** Share or change your own reflection for today (one per person per day). */
  save(verseRef: string, body: string): Promise<Reflection>;
  remove(id: string): Promise<void>;
}

export class ReflectionError extends Error {}

const todayKey = () => manilaDayKey(new Date().toISOString());
const clean = (body: string) => {
  const b = body.trim().replace(/\s+\n/g, '\n');
  if (b.length < 3) throw new ReflectionError('Write a few words first.');
  if (b.length > REFLECTION_MAX) throw new ReflectionError(`Keep it to ${REFLECTION_MAX} characters.`);
  return b;
};

export function createSupabaseReflections(client: SupabaseClient): ReflectionsService {
  const columns = 'id, author_id, body, created_at, updated_at, author:profiles!verse_reflections_author_id_fkey(display_name, avatar_data, avatar_color)';
  const me = async () => (await client.auth.getSession()).data.session?.user.id ?? null;
  const map = (r: Record<string, unknown>, uid: string | null): Reflection => {
    const a = (r.author ?? {}) as { display_name?: string; avatar_data?: string | null; avatar_color?: string | null };
    const name = a.display_name || 'A colleague';
    return {
      id: r.id as string,
      authorId: r.author_id as string,
      authorName: name,
      initials: initialsOf(name),
      avatar: a.avatar_data ?? null,
      color: a.avatar_color ?? null,
      body: r.body as string,
      createdAt: r.created_at as string,
      edited: Date.parse(r.updated_at as string) - Date.parse(r.created_at as string) > 1000,
      mine: r.author_id === uid,
    };
  };
  const fail = (what: string, e: { message: string; code?: string }): never => {
    console.error(`[reflections] ${what}`, e);
    if (e.code === '23514') throw new ReflectionError(`Keep it between 3 and ${REFLECTION_MAX} characters.`);
    if (e.code === '42501' || /row-level security/i.test(e.message)) throw new ReflectionError('Only today’s verse can be written about, by active staff.');
    throw new ReflectionError(`Couldn’t ${what}. Check the connection and try again.`);
  };
  return {
    source: 'supabase',
    async today() {
      const [uid, res] = await Promise.all([me(), client.from('verse_reflections').select(columns).eq('verse_day', todayKey()).order('created_at', { ascending: false }).limit(200)]);
      if (res.error) fail('load the reflections', res.error);
      return (res.data ?? []).map((r) => map(r as Record<string, unknown>, uid));
    },
    async save(verseRef, body) {
      const uid = await me();
      const text = clean(body);
      const { data, error } = await client
        .from('verse_reflections')
        .upsert({ verse_day: todayKey(), verse_ref: verseRef, author_id: uid, body: text }, { onConflict: 'author_id,verse_day' })
        .select(columns)
        .single();
      if (error) fail('share your reflection', error);
      return map(data as Record<string, unknown>, uid);
    },
    async remove(id) {
      const { error } = await client.from('verse_reflections').delete().eq('id', id);
      if (error) fail('delete the reflection', error);
    },
  };
}

// ───────────────────────── Sample data (this browser only) ─────────────────────────

const later = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 200));
const KEY = 'philrads.sample.reflections.v1';
const at = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const sample = (): Reflection[] => [
  { id: 'r1', authorId: 'p-ana', authorName: 'Ana Reyes', initials: 'AR', avatar: null, color: '#3f8f5b', body: 'Needed this today. My mother is in the hospital and I keep forgetting that I don’t carry it alone.', createdAt: at(2), edited: false, mine: false },
  { id: 'r2', authorId: 'p-jun', authorName: 'Jun Santos', initials: 'JS', avatar: null, color: '#3c5fa8', body: 'Reminder to slow down and be present with my kids tonight, not just get through the evening.', createdAt: at(4), edited: false, mine: false },
];

export const mockReflections: ReflectionsService = {
  source: 'mock',
  async today() {
    let mine: Reflection | null = null;
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { day: string; r: Reflection } | null;
      if (raw?.day === todayKey()) mine = raw.r;
    } catch {
      /* nothing saved */
    }
    return later([...(mine ? [mine] : []), ...sample()]);
  },
  async save(_ref, body) {
    const r: Reflection = {
      id: 'mine',
      authorId: demoProfile.id,
      authorName: demoProfile.displayName,
      initials: demoProfile.initials,
      avatar: null,
      color: null,
      body: clean(body),
      createdAt: new Date().toISOString(),
      edited: false,
      mine: true,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify({ day: todayKey(), r }));
    } catch {
      /* storage blocked: this visit only */
    }
    return later(r);
  },
  async remove() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to remove */
    }
    await later(null);
  },
};
