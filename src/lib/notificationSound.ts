/**
 * The notification "ting": a short bell, made in the browser with Web Audio (no sound file to
 * download). Plays when a new note arrives in the bell, never in Do Not Disturb. Each person can
 * switch it off in the account menu; the choice is kept on this device.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'philrads.sound.notifications';
const GAP_MS = 1500;

type Ctx = AudioContext;
let ctx: Ctx | null = null;
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

const context = (): Ctx | null => {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
};

/** One bell partial: a sine that strikes at once and rings away. */
function partial(c: Ctx, out: AudioNode, at: number, freq: number, gain: number, decay: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

/** "Ti-ting": two light strikes a fifth apart (E6, then B6), with a soft overtone each. */
function ting(c: Ctx) {
  const out = c.createGain();
  out.gain.value = 0.32;
  out.connect(c.destination);
  const t = c.currentTime + 0.01;
  partial(c, out, t, 1318.5, 0.5, 0.9);
  partial(c, out, t, 3955.5, 0.08, 0.35);
  partial(c, out, t + 0.11, 1975.5, 0.42, 1.2);
  partial(c, out, t + 0.11, 5926.5, 0.06, 0.4);
}

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
  /** `force`: a preview when switching it on, even right after another ting. */
  play(force = false) {
    const now = Date.now();
    if (!on || (!force && now - lastPlayed < GAP_MS)) return;
    const c = context();
    if (!c) return;
    lastPlayed = now;
    if (c.state === 'suspended') void c.resume().then(() => ting(c)).catch(() => undefined);
    else ting(c);
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
  const unlock = () => {
    void context()?.resume().catch(() => undefined);
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}
