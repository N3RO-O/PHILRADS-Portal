import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Works offline: each guest screen's last good load is kept on the phone, and used when the next
 * load fails (no signal, or the server can't be reached). The page then says how old it is.
 * Only public guest content is kept here, never anything about the visitor.
 */
const PREFIX = 'philrads.guest.copy.v1.';

interface Copy<T> {
  at: string;
  data: T;
}

function read<T>(name: string): Copy<T> | null {
  try {
    const v = JSON.parse(localStorage.getItem(PREFIX + name) ?? 'null') as Copy<T> | null;
    return v && typeof v.at === 'string' && 'data' in v ? v : null;
  } catch {
    return null;
  }
}

function write<T>(name: string, data: T) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify({ at: new Date().toISOString(), data } satisfies Copy<T>));
  } catch {
    /* full or private browsing: the page still works online */
  }
}

// The oldest saved copy shown on this visit, for the banner.
let shownAt: string | null = null;
const listeners = new Set<() => void>();
function showing(at: string) {
  if (shownAt && shownAt <= at) return;
  shownAt = at;
  listeners.forEach((l) => l());
}

/**
 * Load with a saved copy behind it. `empty` marks a result that only means "couldn't get it"
 * (the Facebook loader answers with no posts instead of failing): offline, the copy wins.
 */
export async function kept<T>(name: string, load: () => Promise<T>, empty?: (v: T) => boolean): Promise<T> {
  try {
    const v = await load();
    if (!empty?.(v)) write(name, v);
    else if (!navigator.onLine) {
      const c = read<T>(name);
      if (c) {
        showing(c.at);
        return c.data;
      }
    }
    return v;
  } catch (e) {
    const c = read<T>(name);
    if (!c) throw e;
    showing(c.at);
    return c.data;
  }
}

/** Back online and loading afresh: the banner goes until a load falls back again. */
export function freshAgain() {
  if (shownAt === null) return;
  shownAt = null;
  listeners.forEach((l) => l());
}

/** When the oldest saved copy on screen was made; null while everything is fresh. */
export const useSavedCopyAt = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => shownAt,
  );

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}
