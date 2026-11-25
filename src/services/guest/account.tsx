import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../components/auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { initialsOf } from '../../lib/format';
import { guestService } from '..';

/**
 * Guest accounts: a guest may sign in with Google to read every story, pray with us and see
 * where a fundraiser's gifts went, to set up a profile, and to see who else is here.
 *
 * A guest's account is a profile with role 'guest' that is never active, so it never reaches
 * staff data (see supabase/migrations/20261128000000_guest_accounts.sql). Staff who open the
 * guest page while signed in see everything too, but aren't listed in "Who's here".
 *
 * Sample mode keeps a made-up guest on this device, so the page can be tried without Google.
 */
export interface GuestMe {
  id: string;
  name: string;
  bio: string;
  avatar: string | null;
  color: string | null;
  initials: string;
}
export type GuestPatch = Partial<Pick<GuestMe, 'name' | 'bio' | 'avatar' | 'color'>>;

export interface Here {
  /** Signed-in guests here now (you first), as they chose to be shown. */
  people: { id: string; name: string; initials: string; color: string | null; avatar: string | null; bio: string; me: boolean }[];
  /** Everyone on the guest page now, signed in or not. */
  count: number;
}

interface GuestAccount {
  status: 'loading' | 'out' | 'in';
  /** The signed-in guest; null when signed out or signed in as staff. */
  me: GuestMe | null;
  /** Signed in as PHILRADS staff (everything open; their profile lives in the portal). */
  staff: boolean;
  /** Full stories, prayer and gift reports are open. */
  unlocked: boolean;
  signIn: () => Promise<string | null>;
  signOut: () => Promise<void>;
  save: (p: GuestPatch) => Promise<void>;
  /** Whether others see you in "Who's here" (kept on this device). */
  shown: boolean;
  setShown: (v: boolean) => void;
  here: Here;
}

const Ctx = createContext<GuestAccount | null>(null);
export const useGuestAccount = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGuestAccount outside GuestAccountProvider');
  return v;
};

const MOCK_KEY = 'philrads.guest.sampleAccount.v1';
const SHOWN_KEY = 'philrads.guest.shown.v1';
const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private browsing: lasts for this visit */
  }
};

const SAMPLE_HERE: Here['people'] = [
  { id: 's-1', name: 'Joy', initials: 'J', color: '#3f8f5b', avatar: null, bio: 'From Tacloban. Praying for the families in Cagayan.', me: false },
  { id: 's-2', name: 'Marco', initials: 'M', color: '#3c5fa8', avatar: null, bio: 'Rice mill in Nueva Ecija. Happy to help with deliveries.', me: false },
  { id: 's-3', name: 'Liza', initials: 'L', color: '#a03f7a', avatar: null, bio: '', me: false },
];

export function GuestAccountProvider({ children }: { children: ReactNode }) {
  const { state, updateProfile, signOut: staffSignOut } = useAuth();
  const sample = guestService.source === 'mock';
  const [mock, setMock] = useState<GuestMe | null>(() => (sample ? read<GuestMe | null>(MOCK_KEY, null) : null));
  const [shown, setShownState] = useState(() => read<boolean>(SHOWN_KEY, true));
  const setShown = useCallback((v: boolean) => {
    setShownState(v);
    write(SHOWN_KEY, v);
  }, []);

  const profile = state.status === 'signed-in' ? state.profile : null;
  const isGuest = profile?.roleKey === 'guest';
  const staff = state.status === 'signed-in' && !!profile && !isGuest;
  const me: GuestMe | null = sample
    ? mock
    : isGuest && profile
      ? { id: profile.id, name: profile.displayName, bio: profile.bio ?? '', avatar: profile.avatar ?? null, color: profile.avatarColor ?? null, initials: profile.initials }
      : null;
  const status: GuestAccount['status'] = sample ? (mock ? 'in' : 'out') : state.status === 'loading' ? 'loading' : me || staff ? 'in' : 'out';

  const signIn = useCallback(async (): Promise<string | null> => {
    if (sample) {
      const m: GuestMe = { id: 'sample-guest', name: 'Guest', bio: '', avatar: null, color: '#2f7f8f', initials: 'G' };
      write(MOCK_KEY, m);
      setMock(m);
      return null;
    }
    if (!supabase) return 'Sign-in isn’t available right now.';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`, queryParams: { prompt: 'select_account' } },
    });
    return error ? 'Google sign-in isn’t available right now. Try again later.' : null;
  }, [sample]);

  const signOut = useCallback(async () => {
    if (sample) {
      write(MOCK_KEY, null);
      setMock(null);
      return;
    }
    await staffSignOut();
  }, [sample, staffSignOut]);

  const save = useCallback(
    async (p: GuestPatch) => {
      const name = p.name?.trim();
      if (p.name !== undefined && (!name || name.length > 40)) throw new Error('Choose a name of 1 to 40 characters.');
      if (p.bio !== undefined && p.bio.length > 160) throw new Error('Keep the line about you under 160 characters.');
      if (sample) {
        setMock((m) => {
          if (!m) return m;
          const n = { ...m, ...p, ...(name ? { name, initials: initialsOf(name) } : {}) };
          write(MOCK_KEY, n);
          return n;
        });
        return;
      }
      if (!supabase || !me) throw new Error('Sign in first.');
      const row: Record<string, unknown> = {};
      if (name) row.display_name = name;
      if (p.bio !== undefined) row.bio = p.bio.trim() || null;
      if (p.avatar !== undefined) row.avatar_data = p.avatar;
      if (p.color !== undefined) row.avatar_color = p.color;
      const { error } = await supabase.from('profiles').update(row).eq('id', me.id);
      if (error) throw new Error('Your profile couldn’t be saved. Check your connection and try again.');
      updateProfile({
        ...(name ? { displayName: name } : {}),
        ...(p.bio !== undefined ? { bio: p.bio.trim() || null } : {}),
        ...(p.avatar !== undefined ? { avatar: p.avatar } : {}),
        ...(p.color !== undefined ? { avatarColor: p.color } : {}),
      });
    },
    [sample, me, updateProfile],
  );

  const here = useHere(sample, me, shown);

  const value = useMemo<GuestAccount>(
    () => ({ status, me, staff, unlocked: status === 'in', signIn, signOut, save, shown, setShown, here }),
    [status, me, staff, signIn, signOut, save, shown, setShown, here],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Who's here: everyone on the guest page joins one Realtime presence channel. Visitors who aren't
 * signed in are counted, never named; signed-in guests share the name, colour and picture of
 * their guest profile (unless they turned "Show me" off). Staff aren't listed. Nothing is stored.
 */
function useHere(sample: boolean, me: GuestMe | null, shown: boolean): Here {
  const [here, setHere] = useState<Here>({ people: [], count: 1 });
  const key = useRef(`v-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const myId = me?.id ?? null;

  useEffect(() => {
    if (sample || !supabase) return;
    const channel = supabase.channel('guest-presence', { config: { presence: { key: key.current } } });
    channelRef.current = channel;
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ guest?: { id: string; name: string; color: string | null; avatar: string | null; bio?: string } }>();
        const seen = new Map<string, Here['people'][number]>();
        for (const metas of Object.values(state))
          for (const m of metas)
            if (m.guest && typeof m.guest.name === 'string' && !seen.has(m.guest.id))
              seen.set(m.guest.id, {
                id: m.guest.id,
                name: m.guest.name.slice(0, 40),
                initials: initialsOf(m.guest.name),
                color: typeof m.guest.color === 'string' && /^#[0-9a-f]{6}$/i.test(m.guest.color) ? m.guest.color : null,
                avatar: typeof m.guest.avatar === 'string' && m.guest.avatar.startsWith('data:image/') ? m.guest.avatar : null,
                bio: typeof m.guest.bio === 'string' ? m.guest.bio.slice(0, 160) : '',
                me: false,
              });
        setHere({ people: [...seen.values()], count: Math.max(1, Object.keys(state).length) });
      })
      .subscribe();
    return () => {
      channelRef.current = null;
      void supabase?.removeChannel(channel);
    };
  }, [sample]);

  // Share who you are (or just that someone is here).
  const payload = me && shown ? { guest: { id: me.id, name: me.name, color: me.color, avatar: me.avatar && me.avatar.length < 40_000 ? me.avatar : null, bio: me.bio.slice(0, 160) } } : { guest: null };
  const sig = JSON.stringify(payload);
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const send = () => void channel.track(JSON.parse(sig));
    if ((channel as unknown as { state?: string }).state === 'joined') send();
    else {
      const t = setInterval(() => {
        if ((channel as unknown as { state?: string }).state === 'joined') {
          clearInterval(t);
          send();
        }
      }, 400);
      return () => clearInterval(t);
    }
  }, [sig]);

  if (sample) {
    const people = [...(me && shown ? [{ id: me.id, name: me.name, initials: me.initials, color: me.color, avatar: me.avatar, bio: me.bio, me: true }] : []), ...SAMPLE_HERE];
    return { people, count: people.length + 4 };
  }
  const people = here.people.map((p) => ({ ...p, me: p.id === myId }));
  people.sort((a, b) => Number(b.me) - Number(a.me));
  return { people, count: here.count };
}
