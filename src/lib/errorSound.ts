/**
 * The error sound: plays when something goes wrong after a person acts (a wrong password, a form
 * that can't be saved, an action that fails). Every error message in the portal is marked
 * role="alert", so one watcher covers them all. It stays quiet for notices nobody caused (page
 * loads, background refreshes, going offline) and for alerts marked data-quiet. Each person can
 * switch it off in the account menu; the choice is kept on this device.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'philrads.sound.errors';
/** Only alerts that follow something the person did, within this long. */
const AFTER_ACTION_MS = 4000;
/** Several alerts at once (a form with two errors) play once. */
const GAP_MS = 1200;

let audio: HTMLAudioElement | null = null;
let lastAction = 0;
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

export const errorSound = {
  get on() {
    return on;
  },
  set(next: boolean) {
    on = next;
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* storage blocked: on for this visit only */
    }
    for (const l of listeners) l();
  },
  play() {
    const now = Date.now();
    if (!on || !audio || now - lastPlayed < GAP_MS) return;
    lastPlayed = now;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  },
};

export function useErrorSound() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => on,
  );
}

/** The alert an added or changed node belongs to, unless it is marked quiet. */
const alertOf = (n: Node): Element | null => {
  const el = n instanceof Element ? n : n.parentElement;
  const alert = el?.closest('[role="alert"]') ?? (el instanceof Element ? el.querySelector('[role="alert"]') : null);
  return alert && !alert.closest('[data-quiet]') && alert.textContent?.trim() ? alert : null;
};

/** Start listening (once, at startup). */
export function startErrorSound() {
  if (audio || typeof window === 'undefined') return;
  audio = new Audio('/sounds/error.mp3');
  audio.preload = 'auto';
  audio.volume = 0.7;

  const acted = () => {
    lastAction = Date.now();
  };
  // Phones only let a page play sound it was allowed to play during a tap: unlock it on the first one.
  const unlock = () => {
    if (!audio) return;
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio!.pause();
        audio!.currentTime = 0;
      })
      .catch(() => undefined)
      .finally(() => (audio!.muted = false));
    window.removeEventListener('pointerdown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  for (const type of ['pointerdown', 'keydown', 'submit']) window.addEventListener(type, acted, true);

  new MutationObserver((mutations) => {
    if (Date.now() - lastAction > AFTER_ACTION_MS) return;
    for (const m of mutations) {
      const nodes = m.type === 'childList' ? [...m.addedNodes] : [m.target];
      if (nodes.some((n) => alertOf(n))) {
        errorSound.play();
        return;
      }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
