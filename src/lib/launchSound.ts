/**
 * The PRISM launch theme (public/sounds/prism-launch.mp3, about a minute) on the sign-in screen:
 * fades in softly when the screen opens, fades out when the person signs in or leaves. Plays once
 * per visit (browser tab), never for data saving, and the speaker button turns it off on this
 * device. Browsers only allow sound after a tap or key press, so when it can't start straight away
 * it starts on the first one. Volume goes through Web Audio, because phones (iPhone) ignore
 * <audio>.volume.
 */
import { useSyncExternalStore } from 'react';

const SRC = '/sounds/prism-launch.mp3';
/** Quiet: background music under the sign-in form. */
const VOLUME = 0.2;
const MUTE_KEY = 'philrads.sound.launch';
const PLAYED_KEY = 'philrads.sound.launch-played';

let audio: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let waiting: (() => void) | null = null;
let fadeTimer = 0;
const listeners = new Set<() => void>();

const read = (store: Storage | undefined, key: string) => {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
};
const write = (store: Storage | undefined, key: string, value: string) => {
  try {
    store?.setItem(key, value);
  } catch {
    /* storage blocked */
  }
};

let muted = typeof window !== 'undefined' && read(window.localStorage, MUTE_KEY) === '0';

const saveData = () => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

function setup() {
  if (audio) return;
  audio = new Audio(SRC);
  audio.preload = 'auto';
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AC) {
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
  } else {
    audio.volume = VOLUME;
  }
}

/** Ramps to `to` over `seconds`. */
function fade(to: number, seconds: number) {
  if (ctx && gain) {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + seconds);
  } else if (audio) {
    audio.volume = Math.min(1, Math.max(0, to));
  }
}

const stopWaiting = () => {
  if (!waiting) return;
  window.removeEventListener('pointerdown', waiting, true);
  window.removeEventListener('keydown', waiting, true);
  waiting = null;
};

/** Tries to start now; true once it's actually playing aloud. */
async function attempt(): Promise<boolean> {
  if (!audio) return false;
  if (ctx && ctx.state !== 'running') {
    // resume() stays pending until the browser allows sound: don't wait on it.
    await Promise.race([ctx.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 250))]);
    if ((ctx.state as AudioContextState) !== 'running') return false;
  }
  try {
    await audio.play();
  } catch {
    return false;
  }
  write(window.sessionStorage, PLAYED_KEY, '1');
  fade(VOLUME, 2.5);
  return true;
}

export const launchSound = {
  /** The sign-in screen opened. */
  start() {
    if (typeof window === 'undefined' || muted || saveData() || read(window.sessionStorage, PLAYED_KEY) === '1') return;
    setup();
    window.clearTimeout(fadeTimer);
    void attempt().then((ok) => {
      if (ok || waiting) return;
      waiting = () => {
        stopWaiting();
        if (!muted) void attempt();
      };
      window.addEventListener('pointerdown', waiting, true);
      window.addEventListener('keydown', waiting, true);
    });
  },
  /** Signed in, or left the screen: fade out. */
  stop() {
    stopWaiting();
    if (!audio || audio.paused) return;
    fade(0, 0.9);
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(() => audio?.pause(), 1000);
  },
  get muted() {
    return muted;
  },
  setMuted(next: boolean) {
    muted = next;
    write(window.localStorage, MUTE_KEY, next ? '0' : '1');
    for (const l of listeners) l();
    if (next) launchSound.stop();
    else {
      // Turned back on by a tap: play from where it was (or the start).
      try {
        window.sessionStorage.removeItem(PLAYED_KEY);
      } catch {
        /* storage blocked */
      }
      launchSound.start();
    }
  },
};

export function useLaunchSoundMuted() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => muted,
    () => false,
  );
}
