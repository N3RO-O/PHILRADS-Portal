import { useSyncExternalStore } from 'react';
import { idbGet, idbPut } from '../../lib/idb';
import type { InventoryService, InventorySnapshot } from './types';

/**
 * State for the Inventory and Response pages: the latest stock snapshot from PHILRADS IMS.
 *
 * The portal only views IMS data (receiving and releasing happen in the IMS), so there is
 * nothing to queue. The last snapshot is cached per user, so the pages still open offline,
 * clearly saying how old the numbers are.
 */
export interface InventoryState {
  snapshot: InventorySnapshot | null;
  /** True when the snapshot came from this device's cache, not a fresh load. */
  fromCache: boolean;
  loading: boolean;
  loadError: string | null;
}

export function createInventoryStore(service: InventoryService) {
  let user: { id: string; name: string } | null = null;
  let state: InventoryState = { snapshot: null, fromCache: false, loading: false, loadError: null };
  const listeners = new Set<() => void>();
  let users = 0;

  const set = (patch: Partial<InventoryState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const cacheKey = () => `inventory:snapshot:${service.source}:${user?.id ?? 'anon'}`;

  async function refresh() {
    set({ loading: true, loadError: null });
    try {
      const snapshot = await service.getSnapshot();
      set({ snapshot, fromCache: false, loading: false });
      idbPut('kv', snapshot, cacheKey()).catch(() => undefined);
    } catch (e) {
      set({ loading: false, loadError: !navigator.onLine ? 'You’re offline.' : e instanceof Error && e.message ? e.message : 'Stock could not be loaded.' });
      if (navigator.onLine) console.error('[inventory] load', e);
    }
  }

  const onOnline = () => void refresh();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,

    /** Start for a signed-in user: show the cached snapshot at once, then load fresh data. */
    async start(u: { id: string; name: string }) {
      if (users++ === 0) window.addEventListener('online', onOnline);
      const switched = user?.id !== u.id;
      user = u;
      if (switched) set({ snapshot: null, fromCache: false });
      const cached = await idbGet<InventorySnapshot>('kv', cacheKey()).catch(() => undefined);
      if (cached && !state.snapshot) set({ snapshot: cached, fromCache: true });
      await refresh();
    },
    stop() {
      if (--users <= 0) {
        users = 0;
        window.removeEventListener('online', onOnline);
      }
    },
    refresh,
  };
}

export type InventoryStore = ReturnType<typeof createInventoryStore>;

export const useInventoryState = (store: InventoryStore) => useSyncExternalStore(store.subscribe, store.getState, store.getState);
