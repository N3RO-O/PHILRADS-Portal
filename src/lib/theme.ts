import { useSyncExternalStore } from 'react';

/**
 * Light or dark: chosen in Profile, kept on this device. "system" follows the phone or computer.
 * index.html applies the saved choice before the page draws, so there is no flash.
 */
export type ThemeChoice = 'dark' | 'light' | 'system';

const KEY = 'philrads.theme';
const light = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
const listeners = new Set<() => void>();

const read = (): ThemeChoice => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
};
let choice = read();

function apply() {
  const isLight = choice === 'light' || (choice === 'system' && light());
  const root = document.documentElement;
  if (isLight) root.dataset.theme = 'light';
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isLight ? '#f1f5f9' : '#1c1d21');
}

export function setTheme(next: ThemeChoice) {
  choice = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage blocked: this visit only */
  }
  // A short cross-fade instead of a jump (skipped for reduced motion).
  const root = document.documentElement;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-fade');
    window.setTimeout(() => root.classList.remove('theme-fade'), 400);
  }
  apply();
  listeners.forEach((l) => l());
}

/** Follows the device while "system" is chosen. Called once at start-up. */
export function startTheme() {
  apply();
  matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (choice === 'system') {
      apply();
      listeners.forEach((l) => l());
    }
  });
}

export const useTheme = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => choice,
  );
