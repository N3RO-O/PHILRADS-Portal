/**
 * The sign-in theme (public/sounds/prism-signin.mp3, about four minutes, looping) on the sign-in
 * screen: fades in softly whenever the screen opens and fades out when the person signs in or
 * leaves. Never for data saving; the speaker button turns it off on this device.
 *
 * Browsers don't let any page play sound before the person has tapped or pressed a key. So it tries
 * straight away (installed apps and sites people use often may be allowed), and otherwise starts on
 * the first tap, with the speaker button saying "Tap for music" meanwhile. Phones only count the end
 * of a tap (pointerup, touchend, click) as permission, not its start, and iPhones want play() called
 * inside that tap, so both happen there. Volume goes through Web Audio, because iPhones ignore
 * <audio>.volume.
 */
import { useSyncExternalStore } from 'react';

const SRC = '/sounds/prism-signin.mp3';
/** Background music under the sign-in form: clearly audible, still under the screen (0.2 was too quiet). */
const VOLUME = 0.5;
const MUTE_KEY = 'philrads.sound.launch';
/** The events that give a page permission to play sound. */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

export type LaunchState = 'off' | 'waiting' | 'playing';

let audio: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let listening = false;
let fadeTimer = 0;
let state: LaunchState = 'off';
const listeners = new Set<() => void>();

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
};

let muted = typeof window !== 'undefined' && read(MUTE_KEY) === '0';

const notify = () => {
  for (const l of listeners) l();
};
const setState = (next: LaunchState) => {
  if (state === next) return;
  state = next;
  notify();
};

const saveData = () => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

function setup() {
  if (audio) return;
  audio = new Audio(SRC);
  audio.preload = 'auto';
  // Loops for as long as the sign-in screen stays open.
  audio.loop = true;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AC) {
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
  } else {
    audio.volume = 0;
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

/**
 * Starts it. resume() and play() are called right here, synchronously, so that inside a tap they
 * count as part of it. Resolves true once it's audibly playing.
 */
function attempt(): Promise<boolean> {
  if (!audio) return Promise.resolve(false);
  const a = audio;
  const resumed = ctx && ctx.state !== 'running' ? ctx.resume() : Promise.resolve();
  const played = a.play();
  const settled = Promise.all([resumed, played]).then(
    () => true,
    () => false,
  );
  // resume() stays pending until the browser allows sound: don't wait on it for long.
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), 400));
  return Promise.race([settled, timeout]).then((ok) => {
    const audible = ok && !a.paused && (!ctx || ctx.state === 'running');
    if (!audible) {
      a.pause();
      return false;
    }
    if (muted || state === 'off') {
      // Switched off, or the screen closed, while it was starting.
      a.pause();
      return false;
    }
    window.clearTimeout(fadeTimer);
    fade(VOLUME, 2.5);
    setState('playing');
    stopListening();
    return true;
  });
}

const onGesture = (e: Event) => {
  // The speaker button handles its own tap.
  if (e.target instanceof Element && e.target.closest('[data-launch-toggle]')) return;
  if (!muted && state === 'waiting') void attempt();
};
function listen() {
  if (listening) return;
  listening = true;
  for (const type of GESTURES) window.addEventListener(type, onGesture, true);
}
function stopListening() {
  if (!listening) return;
  listening = false;
  for (const type of GESTURES) window.removeEventListener(type, onGesture, true);
}

export const launchSound = {
  /** The sign-in screen opened. */
  start() {
    if (typeof window === 'undefined' || muted || saveData()) return;
    setup();
    window.clearTimeout(fadeTimer);
    if (state === 'playing') return;
    setState('waiting');
    listen();
    void attempt();
  },
  /** Signed in, or left the screen: fade out. */
  stop() {
    stopListening();
    const wasPlaying = state === 'playing';
    setState('off');
    if (!audio || !wasPlaying) return;
    fade(0, 0.9);
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(() => {
      audio?.pause();
      if (audio) audio.currentTime = 0;
    }, 1000);
  },
  /** The speaker button: start it if it's waiting for a tap, otherwise switch it off or on. */
  toggle() {
    if (!muted && state === 'waiting') {
      void attempt();
      return;
    }
    launchSound.setMuted(!muted);
  },
  get muted() {
    return muted;
  },
  setMuted(next: boolean) {
    muted = next;
    write(MUTE_KEY, next ? '0' : '1');
    notify();
    if (next) launchSound.stop();
    else {
      // Switched on by a tap on the button: that tap counts, so start() plays now.
      launchSound.start();
    }
  },
};

const snapshot = () => (muted ? 'off' : state);

/** 'off' (switched off or not on this screen), 'waiting' (needs a tap) or 'playing'. */
export function useLaunchSound(): { muted: boolean; state: LaunchState } {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => `${muted ? 1 : 0}${snapshot()}`,
    () => '0off',
  );
  return { muted: s[0] === '1', state: s.slice(1) as LaunchState };
}
