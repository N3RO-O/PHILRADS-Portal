import { PLACEHOLDER_ROLE_PERMISSIONS } from '../../config/permissions';
import { createInventorySeed } from '../../data/mockInventory';
import { demoProfile } from '../../data/mockDashboard';
import { expiryStatus, validateItem, validateMovement } from '../../lib/inventory';
import {
  InventoryRuleError,
  type InventoryItem,
  type InventoryService,
  type InventorySnapshot,
  type ItemDraft,
  type Movement,
  type MovementDraft,
  type StockBatch,
} from './types';

/**
 * Sample-data stand-in for the Supabase inventory service. It behaves like the server:
 * it re-validates every request, enforces roles, is idempotent by clientId, and is
 * unreachable while the device is offline. Changes are kept in this browser only.
 */

const STORE_KEY = 'philrads.sample.inventory.v1';
/** Reseed after a few days so relative expiry dates in the sample stay meaningful. */
const MAX_AGE_MS = 3 * 86_400_000;

const later = <T,>(value: T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

function load(): InventorySnapshot {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as InventorySnapshot;
      if (Date.now() - Date.parse(saved.fetchedAt) < MAX_AGE_MS) return saved;
    }
  } catch {
    /* corrupt or unavailable storage: start from the seed */
  }
  return createInventorySeed();
}

let db: InventorySnapshot | null = null;
const state = () => (db ??= load());
const persist = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state()));
  } catch {
    /* storage full or unavailable: changes last until reload */
  }
};

/** The demo user's current role (switchable in the account menu). */
const demoRole = () => {
  try {
    return localStorage.getItem('philrads.demo.role') ?? demoProfile.roleKey;
  } catch {
    return demoProfile.roleKey;
  }
};
const demoCan = (p: string) => (PLACEHOLDER_ROLE_PERMISSIONS[demoRole()] ?? []).includes(p as never);

function assertOnline() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch (offline)');
}

function adjustBatch(batchId: string, delta: number) {
  const b = state().batches.find((x) => x.id === batchId);
  if (!b) throw new InventoryRuleError('That lot no longer exists.');
  if (b.quantity + delta < 0) throw new InventoryRuleError(`Not enough stock: only ${b.quantity} left in this lot.`);
  b.quantity += delta;
  return b;
}

/** Move stock into the matching lot at the destination, creating it if needed. */
function receiveInto(itemId: string, locationId: string, lotNumber: string | null, expiryDate: string | null, qty: number): StockBatch {
  const s = state();
  let b = s.batches.find(
    (x) => x.itemId === itemId && x.locationId === locationId && x.lotNumber === lotNumber && x.expiryDate === expiryDate,
  );
  if (!b) {
    b = { id: `bat-${crypto.randomUUID?.() ?? Date.now()}`, itemId, locationId, lotNumber, expiryDate, quantity: 0, receivedAt: new Date().toISOString() };
    s.batches.push(b);
  }
  b.quantity += qty;
  return b;
}

const snapshotCopy = (): InventorySnapshot => structuredClone({ ...state(), fetchedAt: new Date().toISOString() });

export const mockInventoryService: InventoryService = {
  source: 'mock',

  async getSnapshot() {
    assertOnline();
    return later(snapshotCopy());
  },

  async submitMovement(draft: MovementDraft) {
    assertOnline();
    await later(null);
    const s = state();
    // Idempotent: a retry of something already recorded returns the original.
    const existing = s.movements.find((m) => m.clientId === draft.clientId);
    if (existing) return { movement: structuredClone(existing) };

    if (!demoCan('inventory.record')) throw new InventoryRuleError('Your role can view inventory but not record movements.');
    const canApprove = demoCan('inventory.approve');
    const pending = s.movements.filter((m) => m.status === 'pending_approval');
    const errors = validateMovement(draft, { ...s, pending, canAdjust: canApprove });
    const first = Object.values(errors)[0];
    if (first) throw new InventoryRuleError(first);

    const batch = draft.batchId ? s.batches.find((b) => b.id === draft.batchId) : undefined;
    const movement: Movement = {
      id: `mov-${crypto.randomUUID?.() ?? Date.now()}`,
      clientId: draft.clientId,
      type: draft.type,
      itemId: draft.itemId,
      batchId: batch?.id ?? null,
      lotNumber: draft.type === 'receipt' ? draft.lotNumber?.trim() || null : batch?.lotNumber ?? null,
      expiryDate: draft.type === 'receipt' ? draft.expiryDate || null : batch?.expiryDate ?? null,
      locationId: draft.locationId,
      toLocationId: draft.type === 'transfer' ? draft.toLocationId ?? null : null,
      quantity: draft.quantity,
      reference: draft.reference?.trim() || null,
      notes: draft.notes?.trim() || null,
      occurredAt: draft.occurredAt,
      recordedAt: new Date().toISOString(),
      recordedById: demoProfile.id,
      recordedByName: `${demoProfile.displayName} (${demoRole()})`,
      // Transfers by field staff wait for an approver; approvers' own transfers apply at once.
      status: draft.type === 'transfer' && !canApprove ? 'pending_approval' : 'applied',
      decidedByName: draft.type === 'transfer' && canApprove ? `${demoProfile.displayName} (auto-approved)` : null,
    };

    if (movement.status === 'applied') {
      if (draft.type === 'receipt') movement.batchId = receiveInto(draft.itemId, draft.locationId, movement.lotNumber, movement.expiryDate, draft.quantity).id;
      else if (draft.type === 'release') adjustBatch(movement.batchId!, -draft.quantity);
      else if (draft.type === 'adjustment') adjustBatch(movement.batchId!, draft.quantity);
      else if (draft.type === 'transfer') {
        const src = adjustBatch(movement.batchId!, -draft.quantity);
        receiveInto(src.itemId, movement.toLocationId!, src.lotNumber, src.expiryDate, draft.quantity);
      }
    }
    s.movements.unshift(movement);
    persist();
    return { movement: structuredClone(movement) };
  },

  async decideTransfer(movementId, approve, note) {
    assertOnline();
    await later(null);
    if (!demoCan('inventory.approve')) throw new InventoryRuleError('Only approvers can decide on transfers.');
    const m = state().movements.find((x) => x.id === movementId);
    if (!m || m.type !== 'transfer') throw new InventoryRuleError('That transfer no longer exists.');
    if (m.status !== 'pending_approval') throw new InventoryRuleError('Someone already decided on this transfer.');
    if (approve) {
      const lot = state().batches.find((b) => b.id === m.batchId);
      if (lot && expiryStatus(lot.expiryDate) === 'expired') throw new InventoryRuleError('This lot expired before approval. Reject the transfer instead.');
      const src = adjustBatch(m.batchId!, -m.quantity);
      receiveInto(src.itemId, m.toLocationId!, src.lotNumber, src.expiryDate, m.quantity);
    } else if (!note?.trim()) {
      throw new InventoryRuleError('Give a reason for rejecting the transfer.');
    }
    m.status = approve ? 'applied' : 'rejected';
    m.decidedByName = `${demoProfile.displayName} (${demoRole()})`;
    m.decidedAt = new Date().toISOString();
    m.decisionNote = note?.trim() || null;
    persist();
  },

  async saveItem(draft: ItemDraft) {
    assertOnline();
    await later(null);
    if (!demoCan('inventory.manage')) throw new InventoryRuleError('Only administrators can add or edit items.');
    const s = state();
    const errors = validateItem(draft, s.items);
    const first = Object.values(errors)[0];
    if (first) throw new InventoryRuleError(first);
    const item: InventoryItem = {
      id: draft.id ?? `itm-${crypto.randomUUID?.() ?? Date.now()}`,
      sku: draft.sku.trim().toUpperCase(),
      barcode: draft.barcode?.trim() || null,
      name: draft.name.trim(),
      category: draft.category,
      unit: draft.unit.trim(),
      reorderLevel: draft.reorderLevel,
      tracksExpiry: draft.tracksExpiry,
    };
    const i = s.items.findIndex((x) => x.id === item.id);
    if (i >= 0) s.items[i] = item;
    else s.items.push(item);
    persist();
    return structuredClone(item);
  },
};
