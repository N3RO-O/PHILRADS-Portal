import { openedFromPasswordLink } from './supabase';

/** Signed-in sessions end after this long without anyone using the portal (in any of its tabs). */
export const IDLE_LIMIT_MS = 10 * 60_000;
/** A warning with "Stay signed in" shows for the last minute. */
export const IDLE_WARN_MS = 60_000;

// Shared by every tab of the portal on this device, so activity in one tab keeps the others signed in too.
const LAST_ACTIVE_KEY = 'philrads.auth.last-active';
// Read once by the sign-in page to say why they were signed out.
const SIGNED_OUT_IDLE_KEY = 'philrads.auth.idle-out';

export function lastActive(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_ACTIVE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function markActive(at = Date.now()) {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(at));
  } catch {
    /* storage unavailable: this tab keeps its own clock (see IdleSignOut) */
  }
}

export function clearActive() {
  try {
    localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function noteIdleSignOut() {
  try {
    sessionStorage.setItem(SIGNED_OUT_IDLE_KEY, '1');
  } catch {
    /* the sign-in page just won't say why */
  }
}

/** True once after an inactivity sign-out. */
export function takeIdleSignOut(): boolean {
  try {
    const was = sessionStorage.getItem(SIGNED_OUT_IDLE_KEY) === '1';
    sessionStorage.removeItem(SIGNED_OUT_IDLE_KEY);
    return was;
  } catch {
    return false;
  }
}

// An invite or reset link signs someone in fresh: an old clock left on this device must not sign them straight out.
if (openedFromPasswordLink) markActive();
