import { useEffect, useState } from 'react';

/**
 * The welcome after signing in (src/components/onboarding/Welcomer.tsx).
 * Every sign-in (password or email code) queues it for this tab; it shows once, on the next page
 * drawn. It always shows: the old "Don't show this again" choice is no longer offered or honoured.
 */
const PENDING = 'prism.welcome.pending';
/** Fired when the welcome closes, so what waits behind it (the first-run question) can open. */
const DONE_EVENT = 'prism:welcome-done';

export const welcome = {
  queue() {
    try {
      sessionStorage.setItem(PENDING, '1');
    } catch {
      /* storage blocked: no welcome, nothing else changes */
    }
  },
  pending(): boolean {
    try {
      return sessionStorage.getItem(PENDING) === '1';
    } catch {
      return false;
    }
  },
  done() {
    try {
      sessionStorage.removeItem(PENDING);
    } catch {
      /* nothing to clear */
    }
    window.dispatchEvent(new Event(DONE_EVENT));
  },
};

/** True while the welcome is still to show or showing; false once it has closed. */
export function useWelcomePending(): boolean {
  const [pending, setPending] = useState(welcome.pending);
  useEffect(() => {
    if (!pending) return;
    const off = () => setPending(false);
    window.addEventListener(DONE_EVENT, off);
    return () => window.removeEventListener(DONE_EVENT, off);
  }, [pending]);
  return pending;
}
