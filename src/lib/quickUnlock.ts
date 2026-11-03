import { biometricSetUp, forgetBiometric } from './biometric';

/**
 * Quick unlock: after signing in once, a person can set a 6-digit PIN (and fingerprint or face) on
 * this device. The portal then locks, instead of signing out, after 10 idle minutes and whenever
 * it's reopened, and unlocks with them. Five wrong PINs sign out completely.
 * Only a salted PBKDF2 hash of the PIN is kept, on this device.
 */
interface Stored {
  salt: string;
  hash: string;
  misses: number;
}
export const MAX_MISSES = 5;
const KEY = (uid: string) => `philrads.unlock.${uid}`;
const UNLOCKED = 'philrads.unlocked';

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function derive(pin: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 150_000 }, key, 256));
}
const read = (uid: string): Stored | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY(uid)) ?? 'null') as Stored | null;
  } catch {
    return null;
  }
};
const write = (uid: string, s: Stored) => {
  try {
    localStorage.setItem(KEY(uid), JSON.stringify(s));
  } catch {
    /* this device can't keep a PIN */
  }
};

export const pinSet = (uid: string) => Boolean(read(uid));
export const quickUnlockOn = (uid: string) => pinSet(uid) || biometricSetUp(uid);

export async function setPin(uid: string, pin: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  write(uid, { salt, hash: await derive(pin, salt), misses: 0 });
}

/** 'ok', 'wrong' (with tries left), or 'locked-out' after the fifth miss. */
export async function checkPin(uid: string, pin: string): Promise<{ result: 'ok' } | { result: 'wrong'; left: number } | { result: 'locked-out' }> {
  const s = read(uid);
  if (!s) return { result: 'locked-out' };
  if ((await derive(pin, s.salt)) === s.hash) {
    write(uid, { ...s, misses: 0 });
    return { result: 'ok' };
  }
  const misses = s.misses + 1;
  if (misses >= MAX_MISSES) return { result: 'locked-out' };
  write(uid, { ...s, misses });
  return { result: 'wrong', left: MAX_MISSES - misses };
}

export function clearQuickUnlock(uid: string) {
  try {
    localStorage.removeItem(KEY(uid));
  } catch {
    /* nothing kept */
  }
  forgetBiometric(uid);
}

/** This tab was unlocked (so a reload doesn't ask again; a reopened app does). */
export const markUnlocked = () => {
  try {
    sessionStorage.setItem(UNLOCKED, '1');
  } catch {
    /* asks again next time */
  }
};
export const markLocked = () => {
  try {
    sessionStorage.removeItem(UNLOCKED);
  } catch {
    /* fine */
  }
};
export const unlockedThisSession = () => {
  try {
    return sessionStorage.getItem(UNLOCKED) === '1';
  } catch {
    return false;
  }
};
