/**
 * The welcome after signing in (src/components/onboarding/Welcomer.tsx).
 * Every sign-in (password or email code) queues it for this tab; it shows once, on the next page
 * drawn. It always shows: the old "Don't show this again" choice is no longer offered or honoured.
 */
const PENDING = 'prism.welcome.pending';

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
  },
};
