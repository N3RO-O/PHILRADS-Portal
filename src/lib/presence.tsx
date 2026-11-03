import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { supabase } from './supabase';

/** Who has the portal open right now (profile ids). */
const PresenceContext = createContext<ReadonlySet<string>>(new Set());

// Sample mode: a few made-up colleagues are "online".
const SAMPLE_ONLINE = ['sample-ana', 'sample-maria'];

/**
 * Staff presence over Supabase Realtime: everyone signed in joins one channel with their profile id,
 * and leaves when the portal closes or the connection drops. Nothing is stored.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const { state, profile } = useAuth();
  const [online, setOnline] = useState<ReadonlySet<string>>(new Set());
  const me = profile?.id ?? null;

  useEffect(() => {
    if (!me) return;
    if (state.status !== 'signed-in' || !supabase) {
      setOnline(new Set([me, ...SAMPLE_ONLINE]));
      return;
    }
    const channel = supabase.channel('staff-presence', { config: { presence: { key: me } } });
    channel
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ at: new Date().toISOString() });
      });
    return () => {
      void channel.untrack();
      void supabase?.removeChannel(channel);
    };
  }, [me, state.status]);

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}

export const usePresence = () => useContext(PresenceContext);
