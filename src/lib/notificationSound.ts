/**
 * The notification sound (public/sounds/notification.mp3, "Goes without saying", chosen by
 * PHILRADS on 7 Nov 2026). Plays when a new note arrives in the bell, never in Do Not Disturb.
 * Each person can switch it off in the account menu; the choice is kept on this device.
 */
import { useSyncExternalStore } from 'react';

/** The events that give a page permission to play sound. */
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;

const KEY = 'philrads.sound.notifications';
const GAP_MS = 1500;
const SRC = '/sounds/notification.mp3';

let audio: HTMLAudioElement | null = null;
let lastPlayed = 0;
const listeners = new Set<() => void>();

const readOn = () => {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
};
let on = readOn();

const sound = (): HTMLAudioElement | null => {
  if (audio || typeof Audio === 'undefined') return audio;
  audio = new Audio(SRC);
  audio.preload = 'auto';
  audio.volume = 0.8;
  return audio;
};

export const notificationSound = {
  get on() {
    return on;
  },
  set(next: boolean) {
    on = next;
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* storage blocked: for this visit only */
    }
    for (const l of listeners) l();
    if (next) notificationSound.play(true);
  },
  /** `force`: a preview when switching it on, even right after another one. */
  play(force = false) {
    const now = Date.now();
    if (!on || (!force && now - lastPlayed < GAP_MS)) return;
    const a = sound();
    if (!a) return;
    lastPlayed = now;
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  },
};

export function useNotificationSound() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => on,
  );
}

/** Browsers only allow sound after a tap or key press: wake the audio up on the first one. */
export function startNotificationSound() {
  if (typeof window === 'undefined') return;
  // Phones only let a page play sound it was allowed to play during a tap: unlock it on the first one.
  // The end of a tap counts as permission on phones, not its start (pointerdown).
  const unlock = () => {
    const a = sound();
    if (a) {
      a.muted = true;
      void a
        .play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
        })
        .catch(() => undefined)
        .finally(() => (a.muted = false));
    }
    for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true);
  };
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, true);
}
