import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { dailyXpService } from '../services';
import type { DailyXpStatus } from '../services/dailyXp/dailyXpService';

/** Fired after a claim, so every part of the page showing XP (Home, Staff Tasks) catches up. */
const CHANGED = 'prism:daily-xp';

/** Today's check-in XP: what's been claimed in all, whether today's is taken, and claiming it. */
export function useDailyXp() {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const [status, setStatus] = useState<DailyXpStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    const load = () => void dailyXpService.status(userId).then((s) => live && setStatus(s));
    load();
    window.addEventListener(CHANGED, load);
    // A new Manila day can start while the portal is open.
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      window.removeEventListener(CHANGED, load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  const claim = useCallback(async () => {
    if (!userId || busy) return false;
    setBusy(true);
    setError(null);
    try {
      setStatus(await dailyXpService.claim(userId));
      window.dispatchEvent(new Event(CHANGED));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t claim it. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [userId, busy]);

  return { total: status?.total ?? 0, claimedToday: status?.claimedToday ?? true, ready: status !== null, busy, error, claim };
}
