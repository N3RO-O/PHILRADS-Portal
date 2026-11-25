/**
 * "New here": a yellow dot on a navigation item while a recent update changed that page, and a tiny
 * "!" note on hover saying what's new. It comes from the release notes (src/config/releases.json):
 * an item's `path` is where staff see it, its `guestPath` where guests do. It stays for two weeks
 * after the release, and goes away for good once this person has opened the page, or rested on the
 * hover note long enough to read it.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { RELEASES } from './whatsNew';

export type NewSide = 'staff' | 'guest';
export interface NewThing {
  key: string;
  title: string;
  /** The page, without any ?query or #hash. */
  path: string;
}

const DAYS = 14;
const KEY = 'philrads.newHere.seen.v1';

const base = (p: string) => (p.split(/[?#]/)[0].replace(/\/+$/, '') || '/');

const readSeen = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

let seen = new Set(readSeen());
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const snapshot = () => seen;

/** Everything new in the last two weeks for this side, newest first (seen or not). */
function recent(side: NewSide): (NewThing & { permission?: string })[] {
  const since = Date.now() - DAYS * 864e5;
  const out: (NewThing & { permission?: string })[] = [];
  for (const r of RELEASES) {
    if (new Date(`${r.date}T00:00:00`).getTime() < since) break;
    r.items.forEach((i, n) => {
      const p = side === 'guest' ? i.guestPath : i.path;
      if (p) out.push({ key: `${side}:${r.id}#${n}`, title: i.title, path: base(p), permission: i.permission });
    });
  }
  return out;
}
const STAFF = recent('staff');
const GUEST = recent('guest');

export function markNewSeen(keys: string[]) {
  const fresh = keys.filter((k) => !seen.has(k));
  if (!fresh.length) return;
  seen = new Set([...seen, ...fresh]);
  // Keep only keys still in the window, so storage doesn't grow forever.
  const live = new Set([...STAFF, ...GUEST].map((t) => t.key));
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen].filter((k) => live.has(k))));
  } catch {
    /* storage blocked: the dot comes back next visit */
  }
  for (const l of listeners) l();
}

/** Is `page` (where the update is) this nav item's page, or inside it? */
export const isUnder = (page: string, navPath: string) => {
  const nav = base(navPath);
  return nav === '/' ? page === '/' : page === nav || page.startsWith(`${nav}/`);
};

/**
 * The unseen new things for this person. Staff: pass `can` so updates for permissions they don't
 * have stay hidden.
 */
export function useNewHere(side: NewSide, can?: (permission: string) => boolean): NewThing[] {
  const s = useSyncExternalStore(subscribe, snapshot);
  return (side === 'guest' ? GUEST : STAFF).filter((t) => !s.has(t.key) && (!t.permission || !can || can(t.permission)));
}

/** Opening a page counts as seeing what's new on it. Use once, in the layout. */
export function useMarkNewSeenOnVisit(side: NewSide) {
  const { pathname } = useLocation();
  useEffect(() => {
    const here = base(pathname);
    markNewSeen((side === 'guest' ? GUEST : STAFF).filter((t) => t.path === here).map((t) => t.key));
  }, [side, pathname]);
}
