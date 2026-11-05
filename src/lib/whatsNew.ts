/**
 * What's new: the release notes (src/config/releases.json, newest first), which release this person
 * has seen, and whether a new version is waiting. Shared by the update popup, the bell and the
 * account menu.
 *
 * The running app can't know what a waiting update contains, so the build also publishes the notes
 * as /releases.json (vite.config.ts) and the old version reads them from there before updating.
 */
import { useSyncExternalStore } from 'react';
import data from '../config/releases.json';

export interface ReleaseItem {
  icon: string;
  title: string;
  body: string;
  /** Where to see it. */
  path?: string;
  /** Shown only to people with this permission. */
  permission?: string;
}
export interface Release {
  id: string;
  /** The portal's version number (package.json), e.g. 1.5.0. */
  version?: string;
  date: string;
  title: string;
  items: ReleaseItem[];
}

export const RELEASES = data as Release[];
/** The release this build is. */
export const CURRENT = RELEASES[0];

/** The releases after `id` (newest first). Unknown id: just the newest. */
export function releasesSince(list: Release[], id: string | null): Release[] {
  const at = id ? list.findIndex((r) => r.id === id) : -1;
  return at === -1 ? list.slice(0, 1) : list.slice(0, at);
}

const isReleaseList = (v: unknown): v is Release[] =>
  Array.isArray(v) && v.length > 0 && v.every((r) => r && typeof r.id === 'string' && typeof r.title === 'string' && Array.isArray(r.items));

const SEEN_KEY = 'philrads.whatsNew.seen';
/** Releases whose note in the bell was opened or marked read, one by one. */
const READ_KEY = 'philrads.whatsNew.read';
const readRead = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};

export type WhatsNewView = { mode: 'update'; releases: Release[] } | { mode: 'notes'; releases: Release[] } | null;

interface State {
  /** A new version is installed and waiting. */
  updateReady: boolean;
  /** What the waiting version brings (null: not known, e.g. offline). */
  incoming: Release[] | null;
  /** The last release whose notes this person saw on this device (null: never). */
  seen: string | null;
  /** Release notes read one by one in the bell. */
  read: string[];
  view: WhatsNewView;
}

let state: State = { updateReady: false, incoming: null, seen: readSeen(), read: readRead(), view: null };
let applyUpdate: (() => void) | null = null;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};

export const whatsNew = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  get: () => state,

  /** Called by the service worker when a new version is waiting. Opens the update popup once. */
  async updateFound(apply: () => void) {
    applyUpdate = apply;
    if (state.updateReady) return;
    set({ updateReady: true });
    let incoming: Release[] | null = null;
    try {
      const res = await fetch(`/releases.json?t=${Date.now()}`, { cache: 'no-store' });
      const list: unknown = res.ok ? await res.json() : null;
      if (isReleaseList(list)) incoming = releasesSince(list, CURRENT.id);
    } catch {
      /* offline or not published: the popup still offers the update, without notes */
    }
    set({ incoming, view: { mode: 'update', releases: incoming ?? [] } });
  },

  /** Install the waiting version. Its notes count as seen, so they don't pop up again after the reload. */
  update() {
    if (state.incoming?.length) whatsNew.markSeen(state.incoming[0].id);
    applyUpdate?.();
  },

  showUpdate() {
    set({ view: { mode: 'update', releases: state.incoming ?? [] } });
  },
  /** The notes since what this person last saw (or the latest ones). */
  showNotes(releases = state.seen && state.seen !== CURRENT.id ? releasesSince(RELEASES, state.seen) : RELEASES.slice(0, 2)) {
    set({ view: { mode: 'notes', releases } });
  },
  close() {
    if (state.view?.mode === 'notes') whatsNew.markSeen(CURRENT.id);
    set({ view: null });
  },
  markSeen(id: string) {
    try {
      localStorage.setItem(SEEN_KEY, id);
    } catch {
      /* storage blocked: the note shows as new again next time */
    }
    set({ seen: id });
  },
  /**
   * Has this release's note been read? Everything up to the last release seen counts as read; someone
   * new to the portal starts with only the latest one unread.
   */
  isRead(id: string) {
    if (state.read.includes(id)) return true;
    const at = RELEASES.findIndex((r) => r.id === id);
    const seenAt = state.seen ? RELEASES.findIndex((r) => r.id === state.seen) : -1;
    return seenAt === -1 ? at > 0 : at >= seenAt;
  },
  /** Mark release notes read in the bell; when none is left unread, this version counts as seen. */
  markRead(ids: string[]) {
    const read = [...new Set([...state.read, ...ids])].filter((id) => RELEASES.some((r) => r.id === id));
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(read));
    } catch {
      /* storage blocked: unread again next time */
    }
    set({ read });
    if (RELEASES.every((r) => whatsNew.isRead(r.id))) whatsNew.markSeen(CURRENT.id);
  },
  /** This version is newer than the notes last seen here: show them once, after an update. */
  get updatedSinceSeen() {
    return state.seen !== null && state.seen !== CURRENT.id && RELEASES.some((r) => r.id === state.seen);
  },
};

// Development only: lets the update popup be tried without publishing a new version.
if (import.meta.env.DEV) (window as unknown as { __whatsNew: typeof whatsNew }).__whatsNew = whatsNew;

export function useWhatsNew() {
  return useSyncExternalStore(whatsNew.subscribe, whatsNew.get);
}
