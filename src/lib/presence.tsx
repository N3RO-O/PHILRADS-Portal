import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { supabase } from './supabase';

/** What others see, Discord-style. "invisible" is a choice that shows as offline. */
export type Status = 'online' | 'idle' | 'dnd' | 'offline';
export type Choice = 'online' | 'idle' | 'dnd' | 'invisible';

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  online: { label: 'Online', color: '#23a55a' },
  idle: { label: 'Idle', color: '#f0b232' },
  dnd: { label: 'Do Not Disturb', color: '#f23f43' },
  offline: { label: 'Offline', color: '#80848e' },
};
export const CHOICES: { value: Choice; label: string; note: string }[] = [
  { value: 'online', label: 'Online', note: 'Shown as available.' },
  { value: 'idle', label: 'Idle', note: 'Away for a bit. Also set on its own after 5 quiet minutes.' },
  { value: 'dnd', label: 'Do Not Disturb', note: 'No pop-ups or sounds. Notes still wait in the bell.' },
  { value: 'invisible', label: 'Invisible', note: 'You appear offline, but can use the portal as usual.' },
];

interface PresenceValue {
  /** Everyone's status right now (people not in the map are offline). */
  statusOf: (id: string) => Status;
  /** How many people are online, idle or busy (not offline). */
  activeCount: (ids: string[]) => number;
  choice: Choice;
  setChoice: (c: Choice) => void;
  /** What you're shown as (your choice, with automatic idle). */
  mine: Status;
}

const PresenceContext = createContext<PresenceValue>({
  statusOf: () => 'offline',
  activeCount: () => 0,
  choice: 'online',
  setChoice: () => undefined,
  mine: 'online',
});

const CHOICE_KEY = 'philrads.status';
const IDLE_AFTER = 5 * 60_000;
// Sample mode: made-up colleagues in each state.
const SAMPLE: Record<string, Status> = { 'p-ana': 'online', 'p-maria': 'idle', 'p-jun': 'dnd' };

const readChoice = (): Choice => {
  try {
    const v = localStorage.getItem(CHOICE_KEY);
    return v === 'idle' || v === 'dnd' || v === 'invisible' ? v : 'online';
  } catch {
    return 'online';
  }
};

/**
 * Staff presence over Supabase Realtime: everyone signed in joins one channel and shares their
 * status (online, idle, do not disturb). Leaving the portal, losing the connection or choosing
 * Invisible removes you, so you show as offline. Nothing is stored on the server.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const { state, profile } = useAuth();
  const me = profile?.id ?? null;
  const [choice, setChoiceState] = useState<Choice>(readChoice);
  const [away, setAway] = useState(false);
  const [others, setOthers] = useState<Record<string, Status>>({});
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  // Idle on its own: nothing touched for 5 minutes, or the portal is in the background.
  useEffect(() => {
    let last = Date.now();
    const touch = () => {
      last = Date.now();
      setAway(false);
    };
    const tick = () => setAway(document.visibilityState === 'hidden' || Date.now() - last > IDLE_AFTER);
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    document.addEventListener('visibilitychange', tick);
    const t = setInterval(tick, 30_000);
    return () => {
      for (const e of events) window.removeEventListener(e, touch);
      document.removeEventListener('visibilitychange', tick);
      clearInterval(t);
    };
  }, []);

  const mine: Status = choice === 'invisible' ? 'offline' : choice === 'dnd' ? 'dnd' : choice === 'idle' || away ? 'idle' : 'online';

  // Join the channel once signed in.
  useEffect(() => {
    if (!me || state.status !== 'signed-in' || !supabase) return;
    const channel = supabase.channel('staff-presence', { config: { presence: { key: me } } });
    channelRef.current = channel;
    channel
      .on('presence', { event: 'sync' }, () => {
        const next: Record<string, Status> = {};
        for (const [id, metas] of Object.entries(channel.presenceState<{ status?: Status }>())) {
          // Several tabs or devices: the most available one wins.
          const order: Status[] = ['online', 'dnd', 'idle'];
          const ss = metas.map((m) => m.status ?? 'online');
          next[id] = order.find((s) => ss.includes(s)) ?? 'online';
        }
        setOthers(next);
      })
      .subscribe();
    return () => {
      channelRef.current = null;
      void supabase?.removeChannel(channel);
    };
  }, [me, state.status]);

  // Share your status (or leave, when invisible).
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const send = () => (mine === 'offline' ? void channel.untrack() : void channel.track({ status: mine, at: new Date().toISOString() }));
    // The first track waits until the channel is joined.
    if ((channel as unknown as { state?: string }).state === 'joined') send();
    else {
      const t = setInterval(() => {
        if ((channel as unknown as { state?: string }).state === 'joined') {
          clearInterval(t);
          send();
        }
      }, 300);
      return () => clearInterval(t);
    }
  }, [mine, me, state.status]);

  const setChoice = useCallback((c: Choice) => {
    setChoiceState(c);
    try {
      localStorage.setItem(CHOICE_KEY, c);
    } catch {
      /* this visit only */
    }
  }, []);

  const value = useMemo<PresenceValue>(() => {
    const live = state.status === 'signed-in' && Boolean(supabase);
    const statusOf = (id: string): Status => {
      if (id === me) return mine;
      return live ? (others[id] ?? 'offline') : (SAMPLE[id] ?? 'offline');
    };
    return { statusOf, activeCount: (ids) => ids.filter((id) => statusOf(id) !== 'offline').length, choice, setChoice, mine };
  }, [state.status, me, mine, others, choice, setChoice]);

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export const usePresence = () => useContext(PresenceContext);
