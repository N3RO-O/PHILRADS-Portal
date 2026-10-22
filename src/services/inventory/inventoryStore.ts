import { useSyncExternalStore } from 'react';
import { idbDelete, idbGet, idbGetAll, idbPut } from '../../lib/idb';
import {
  InventoryRuleError,
  type InventoryItem,
  type InventoryService,
  type InventorySnapshot,
  type ItemDraft,
  type Movement,
  type MovementDraft,
} from './types';

/**
 * Offline-first state for the Inventory module.
 *
 * - Stock movements go to an IndexedDB outbox FIRST, then sync. Nothing a staff member
 *   records is lost if the network drops, the tab closes or the phone sleeps mid-request.
 * - Each entry carries a clientId the server uses for idempotency, so a retry after a
 *   timeout can never record the same release twice.
 * - The last snapshot is cached per user, so the stock list still opens offline
 *   (clearly marked with when it was last updated).
 * - Entries a business rule rejects (e.g. stock already released by someone else) stop
 *   retrying and are shown as "Sync failed" for the staff member to fix or discard.
 */

export interface OutboxEntry {
  clientId: string;
  draft: MovementDraft;
  recordedById: string;
  recordedByName: string;
  queuedAt: string;
  status: 'pending_sync' | 'sync_failed';
  error?: string;
  attempts: number;
}

export interface InventoryState {
  snapshot: InventorySnapshot | null;
  /** True when the snapshot came from this device's cache, not a fresh load. */
  fromCache: boolean;
  loading: boolean;
  loadError: string | null;
  outbox: OutboxEntry[];
  syncing: boolean;
}

export type RecordOutcome = 'saved' | 'pending_approval' | 'queued' | 'failed';

const SYNC_INTERVAL_MS = 30_000;
const isNetworkError = (e: unknown) => !(e instanceof InventoryRuleError);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createInventoryStore(service: InventoryService) {
  let user: { id: string; name: string } | null = null;
  let state: InventoryState = { snapshot: null, fromCache: false, loading: false, loadError: null, outbox: [], syncing: false };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const set = (patch: Partial<InventoryState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const cacheKey = () => `inventory:snapshot:${service.source}:${user?.id ?? 'anon'}`;

  async function readOutbox() {
    try {
      const all = await idbGetAll<OutboxEntry>('outbox');
      // Only this staff member's entries: never send one person's records under another's account.
      return all.filter((e) => e.recordedById === user?.id).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
    } catch {
      return state.outbox;
    }
  }

  async function writeEntry(entry: OutboxEntry) {
    try {
      await idbPut('outbox', entry);
    } catch {
      /* IndexedDB unavailable: the entry lives in memory until it syncs */
    }
    set({ outbox: [...state.outbox.filter((e) => e.clientId !== entry.clientId), entry] });
  }

  async function removeEntry(clientId: string) {
    try {
      await idbDelete('outbox', clientId);
    } catch {
      /* ignore */
    }
    set({ outbox: state.outbox.filter((e) => e.clientId !== clientId) });
  }

  async function refresh() {
    set({ loading: true, loadError: null });
    try {
      const snapshot = await service.getSnapshot();
      set({ snapshot, fromCache: false, loading: false });
      idbPut('kv', snapshot, cacheKey()).catch(() => undefined);
    } catch (e) {
      set({
        loading: false,
        loadError: isNetworkError(e) && !navigator.onLine ? 'You’re offline.' : 'Inventory could not be loaded.',
      });
      if (!(e instanceof TypeError)) console.error('[inventory] load', e);
    }
  }

  let syncPromise: Promise<void> | null = null;
  function sync(): Promise<void> {
    if (syncPromise) return syncPromise;
    const pending = state.outbox.filter((e) => e.status === 'pending_sync');
    if (!pending.length || !navigator.onLine) return Promise.resolve();
    const work = async () => {
      set({ syncing: true });
      let synced = 0;
      for (const entry of pending) {
        try {
          await service.submitMovement(entry.draft);
          await removeEntry(entry.clientId);
          synced++;
        } catch (e) {
          if (isNetworkError(e)) {
            // Connection dropped again: keep the entry and stop; the next trigger retries.
            await writeEntry({ ...entry, attempts: entry.attempts + 1, error: undefined });
            break;
          }
          await writeEntry({ ...entry, status: 'sync_failed', error: message(e), attempts: entry.attempts + 1 });
        }
      }
      set({ syncing: false });
      if (synced) await refresh();
    };
    // One tab syncs at a time, so two open tabs never race on the same outbox.
    const locked =
      typeof navigator !== 'undefined' && 'locks' in navigator
        ? navigator.locks.request('philrads-inventory-outbox', work)
        : work();
    syncPromise = Promise.resolve(locked).finally(() => {
      syncPromise = null;
    });
    return syncPromise;
  }

  const onOnline = () => void sync().then(refresh);
  const onVisible = () => document.visibilityState === 'visible' && void sync();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,

    /** Start for a signed-in user: show the cached snapshot at once, then load fresh data and sync. */
    async start(u: { id: string; name: string }) {
      const switched = user?.id !== u.id;
      user = u;
      if (switched) set({ snapshot: null, outbox: [], fromCache: false });
      const [cached, outbox] = await Promise.all([idbGet<InventorySnapshot>('kv', cacheKey()).catch(() => undefined), readOutbox()]);
      set({ outbox, ...(cached && !state.snapshot ? { snapshot: cached, fromCache: true } : {}) });
      window.addEventListener('online', onOnline);
      document.addEventListener('visibilitychange', onVisible);
      timer ??= setInterval(() => void sync(), SYNC_INTERVAL_MS);
      await refresh();
      await sync();
    },
    stop() {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      if (timer) clearInterval(timer);
      timer = null;
    },
    refresh,
    sync,

    /** Record a stock movement: saved to the outbox first, then sent if there is a connection. */
    async record(draft: MovementDraft): Promise<{ outcome: RecordOutcome; error?: string }> {
      if (!user) return { outcome: 'failed', error: 'You are signed out.' };
      const entry: OutboxEntry = {
        clientId: draft.clientId,
        draft,
        recordedById: user.id,
        recordedByName: user.name,
        queuedAt: new Date().toISOString(),
        status: 'pending_sync',
        attempts: 0,
      };
      await writeEntry(entry);
      if (!navigator.onLine) return { outcome: 'queued' };
      try {
        const { movement } = await service.submitMovement(draft);
        await removeEntry(draft.clientId);
        void refresh();
        return { outcome: movement.status === 'pending_approval' ? 'pending_approval' : 'saved' };
      } catch (e) {
        if (isNetworkError(e)) return { outcome: 'queued' };
        // Rejected by a rule: nothing was recorded, so don't leave it in the outbox.
        await removeEntry(draft.clientId);
        return { outcome: 'failed', error: message(e) };
      }
    },

    /** Try a failed entry again (e.g. after stock was received elsewhere). */
    async retry(clientId: string) {
      const entry = state.outbox.find((e) => e.clientId === clientId);
      if (!entry) return;
      await writeEntry({ ...entry, status: 'pending_sync', error: undefined });
      await sync();
    },
    discard: removeEntry,

    async decideTransfer(movementId: string, approve: boolean, note?: string) {
      await service.decideTransfer(movementId, approve, note);
      await refresh();
    },

    async saveItem(draft: ItemDraft): Promise<InventoryItem> {
      const item = await service.saveItem(draft);
      await refresh();
      return item;
    },
  };
}

export type InventoryStore = ReturnType<typeof createInventoryStore>;

export const useInventoryState = (store: InventoryStore) => useSyncExternalStore(store.subscribe, store.getState, store.getState);

/** Outbox entries shown alongside ledger movements in the activity log. */
export const outboxAsMovements = (outbox: OutboxEntry[], snapshot: InventorySnapshot | null): Movement[] =>
  outbox.map((e) => {
    const batch = snapshot?.batches.find((b) => b.id === e.draft.batchId);
    return {
      id: `outbox-${e.clientId}`,
      clientId: e.clientId,
      type: e.draft.type,
      itemId: e.draft.itemId,
      batchId: e.draft.batchId ?? null,
      lotNumber: e.draft.lotNumber ?? batch?.lotNumber ?? null,
      expiryDate: e.draft.expiryDate ?? batch?.expiryDate ?? null,
      locationId: e.draft.locationId,
      toLocationId: e.draft.toLocationId ?? null,
      quantity: e.draft.quantity,
      reference: e.draft.reference ?? null,
      notes: e.draft.notes ?? null,
      occurredAt: e.draft.occurredAt,
      recordedAt: e.queuedAt,
      recordedById: e.recordedById,
      recordedByName: e.recordedByName,
      status: e.status,
      decisionNote: e.error ?? null,
    };
  });
