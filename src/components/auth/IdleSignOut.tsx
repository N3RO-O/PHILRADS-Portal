import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLiveSharing } from '../map/LiveSharing';
import { IDLE_LIMIT_MS, IDLE_WARN_MS, lastActive, markActive, noteIdleSignOut } from '../../lib/idle';

const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Signs a staff account out after 10 minutes without activity, warning for the last minute.
 * Activity in any tab counts (the time is kept in localStorage), and so does sharing a live
 * location, which runs hands-free. Coming back to a portal left open (or reopening the app)
 * after the limit signs out straight away. Sample-data mode has nothing to protect and skips it.
 */
export function IdleSignOut() {
  const { state, signOut } = useAuth();
  const live = useLiveSharing();
  const signedIn = state.status === 'signed-in';
  const sharing = live.status === 'live' || live.status === 'starting';
  const [left, setLeft] = useState<number | null>(null);
  // This tab's own clock, for when storage is unavailable.
  const local = useRef(Date.now());
  const written = useRef(0);
  const leaving = useRef(false);
  const leftRef = useRef(left);
  leftRef.current = left;

  useEffect(() => {
    if (!signedIn) return;
    leaving.current = false;
    if (lastActive() === null) markActive();

    const touch = () => {
      const now = Date.now();
      local.current = now;
      // pointermove fires constantly: write at most every few seconds.
      if (now - written.current > 5_000) {
        written.current = now;
        markActive(now);
      }
    };
    const check = () => {
      if (leaving.current) return;
      if (sharing) return touch();
      const idle = Date.now() - Math.max(lastActive() ?? 0, local.current);
      if (idle >= IDLE_LIMIT_MS) {
        leaving.current = true;
        setLeft(null);
        noteIdleSignOut();
        void signOut();
      } else {
        const remaining = IDLE_LIMIT_MS - idle;
        setLeft(remaining <= IDLE_WARN_MS ? Math.ceil(remaining / 1000) : null);
      }
    };

    // Reopened after the limit: the stored time is old, and nothing has touched it yet.
    local.current = lastActive() ?? Date.now();
    check();
    const onActivity = () => {
      // While the warning shows, only "Stay signed in" keeps the session: a stray mouse
      // twitch shouldn't silently cancel it.
      if (leftRef.current !== null) return;
      touch();
    };
    for (const e of ACTIVITY) window.addEventListener(e, onActivity, { passive: true, capture: true });
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, 1_000);
    return () => {
      for (const e of ACTIVITY) window.removeEventListener(e, onActivity, { capture: true });
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [signedIn, sharing, signOut]);

  const stay = () => {
    const now = Date.now();
    local.current = now;
    written.current = now;
    markActive(now);
    setLeft(null);
  };

  if (left === null) return null;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="fixed inset-0 z-[70] grid animate-fade-in place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-desc" className="card w-full max-w-sm animate-pop-in items-center gap-4 text-center shadow-2xl shadow-black/40">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-uplift/15 text-uplift">
          <Clock className="h-7 w-7" aria-hidden />
        </span>
        <div>
          <h2 id="idle-title" className="text-lg font-bold">
            Still there?
          </h2>
          <p id="idle-desc" className="mt-1 text-sm text-muted">
            For your account’s safety, the portal signs out after 10 minutes without activity.
          </p>
        </div>
        <p className="font-display text-4xl tabular-nums tracking-wide" aria-live="polite">
          {mm}:{ss}
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
          <button type="button" className="btn-primary flex-1" onClick={stay} autoFocus>
            Stay signed in
          </button>
          <button
            type="button"
            className="btn-ghost flex-1"
            onClick={() => {
              leaving.current = true;
              setLeft(null);
              void signOut();
            }}
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
