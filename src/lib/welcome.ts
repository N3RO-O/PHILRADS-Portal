/**
 * The welcome after signing in (src/components/onboarding/Welcomer.tsx).
 * Signing in with a password queues it for this tab; it shows once, on the next page drawn.
 * "Don't show this again" turns it off on this device.
 */
const PENDING = 'prism.welcome.pending';
const OFF = 'prism.welcome.off';

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
      return sessionStorage.getItem(PENDING) === '1' && localStorage.getItem(OFF) !== '1';
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
  turnOff() {
    try {
      localStorage.setItem(OFF, '1');
    } catch {
      /* this visit only */
    }
  },
};
