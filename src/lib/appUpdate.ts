/// <reference types="vite-plugin-pwa/client" />
/**
 * Keeps every device on the latest PRISM. The service worker is registered as soon as the app
 * starts (sign-in screen included), and looks for a new version every 15 minutes, whenever the app
 * comes back to the front, and when the connection returns.
 *
 * A new version installs on its own whenever nothing can be lost:
 * - nobody is inside the portal (sign-in, guest and set-password screens) and nothing has been
 *   typed for a minute (so a half-typed email or volunteer code isn't lost),
 * - the app has only just opened and nothing has been typed yet,
 * - the app is back after 10 minutes or more away.
 * Otherwise, in the middle of work, the What's new popup asks first ("Update now" or "Later"),
 * so a half-filled task or form is never lost (UpdatePrompt).
 */
import { registerSW } from 'virtual:pwa-register';
import { whatsNew } from './whatsNew';

const CHECK_EVERY_MS = 15 * 60_000;
/** Opened this recently, with nothing typed: still safe to switch versions. */
const FRESH_MS = 20_000;
/** Back after at least this long away: whatever was open has been left. */
const AWAY_MS = 10 * 60_000;
/** A version found this soon after coming back still counts as "on return". */
const RETURN_WINDOW_MS = 30_000;
/** Outside the portal: wait this long after the last key press. */
const QUIET_MS = 60_000;
/** Checks on return at most this often. */
const MIN_CHECK_GAP_MS = 60_000;

const startedAt = Date.now();
let lastInputAt = 0;
let retry = 0;
let hiddenAt: number | null = null;
let returnedAt = 0;
let lastCheck = 0;
/** The signed-in portal is on screen (set by UpdatePrompt). */
let inPortal = false;
let pending = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;

const safeNow = () => {
  const now = Date.now();
  if (!inPortal) return lastInputAt === 0 || now - lastInputAt >= QUIET_MS;
  if (lastInputAt === 0 && now - startedAt < FRESH_MS) return true;
  return returnedAt > 0 && now - returnedAt < RETURN_WINDOW_MS;
};

function decide() {
  if (!pending || !apply) return;
  window.clearTimeout(retry);
  if (safeNow()) {
    pending = false;
    void apply(true);
  } else if (!inPortal) {
    // Typing on the sign-in screen: try again once it's quiet.
    retry = window.setTimeout(decide, QUIET_MS);
  } else {
    const install = apply;
    void whatsNew.updateFound(() => void install(true));
  }
}

const check = () => {
  if (!registration || !navigator.onLine) return;
  lastCheck = Date.now();
  void registration.update().catch(() => undefined);
};

export const appUpdate = {
  /** The signed-in portal opened (true) or closed (false). Leaving it installs a waiting version. */
  setInPortal(next: boolean) {
    inPortal = next;
    if (!next) decide();
  },
};

/** Called once, at startup (main.tsx). */
export function startAppUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  apply = registerSW({
    immediate: true,
    onNeedRefresh() {
      pending = true;
      decide();
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
      if (!reg) return;
      setInterval(check, CHECK_EVERY_MS);
    },
    onRegisterError(error) {
      console.error('[pwa] service worker registration failed', error);
    },
  });

  const markTyped = () => {
    lastInputAt = Date.now();
  };
  window.addEventListener('keydown', markTyped, true);
  window.addEventListener('input', markTyped, true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (away >= AWAY_MS) {
      returnedAt = Date.now();
      // A version found while away installs now.
      decide();
    }
    if (Date.now() - lastCheck > MIN_CHECK_GAP_MS) check();
  });
  window.addEventListener('online', check);
}
