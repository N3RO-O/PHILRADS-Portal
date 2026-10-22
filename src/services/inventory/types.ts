import type { DataSource } from '../../types';

/** Inventory domain types shared by the UI, the offline outbox and every data source. */

export const ITEM_CATEGORIES = ['Food', 'Water and sanitation', 'Hygiene', 'Shelter', 'Medical', 'Household', 'Other'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export type LocationKind = 'warehouse' | 'hub' | 'field';

export interface InventoryLocation {
  id: string;
  name: string;
  kind: LocationKind;
  region?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  /** Printed barcode or QR payload, if the item has one. */
  barcode: string | null;
  name: string;
  category: ItemCategory;
  unit: string;
  /** Per location: below this, the location needs restocking. */
  reorderLevel: number;
  /** Perishables (food, water, medicine) must be received with an expiry date. */
  tracksExpiry: boolean;
}

/** One lot of an item at one location. Stock is always held in batches. */
export interface StockBatch {
  id: string;
  itemId: string;
  locationId: string;
  lotNumber: string | null;
  /** YYYY-MM-DD or null when the goods do not expire. */
  expiryDate: string | null;
  quantity: number;
  receivedAt: string;
}

export type MovementType = 'receipt' | 'release' | 'transfer' | 'adjustment';

/**
 * applied: in the ledger. pending_approval: a transfer waiting for an approver.
 * rejected: a transfer an approver declined. pending_sync / sync_failed: only on this device (offline outbox).
 */
export type MovementStatus = 'applied' | 'pending_approval' | 'rejected' | 'pending_sync' | 'sync_failed';

export interface Movement {
  id: string;
  /** Generated on the device that recorded it; makes retries safe (never recorded twice). */
  clientId: string;
  type: MovementType;
  itemId: string;
  batchId: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  /** Where stock came from (release, transfer, adjustment) or arrived (receipt). */
  locationId: string;
  /** Transfer destination. */
  toLocationId: string | null;
  /** Positive, except adjustments, which are signed. */
  quantity: number;
  reference: string | null;
  notes: string | null;
  occurredAt: string;
  recordedAt: string;
  recordedById: string;
  recordedByName: string;
  status: MovementStatus;
  decidedByName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
}

/** What a staff member submits. Validated on the device and again by the data source. */
export interface MovementDraft {
  clientId: string;
  type: MovementType;
  itemId: string;
  locationId: string;
  toLocationId?: string | null;
  batchId?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
  quantity: number;
  reference?: string | null;
  notes?: string | null;
  occurredAt: string;
}

export interface ItemDraft {
  id?: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: ItemCategory;
  unit: string;
  reorderLevel: number;
  tracksExpiry: boolean;
}

export interface InventorySnapshot {
  source: DataSource;
  fetchedAt: string;
  items: InventoryItem[];
  locations: InventoryLocation[];
  batches: StockBatch[];
  /** Most recent first. */
  movements: Movement[];
}

export interface SubmitResult {
  movement: Movement;
}

/**
 * A business rule rejected the request (e.g. not enough stock, expired lot).
 * Retrying will not help, so the outbox marks the entry as failed instead of retrying.
 */
export class InventoryRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryRuleError';
  }
}

export interface InventoryService {
  readonly source: DataSource;
  getSnapshot(): Promise<InventorySnapshot>;
  /** Idempotent by draft.clientId: sending the same draft twice records it once. */
  submitMovement(draft: MovementDraft): Promise<SubmitResult>;
  decideTransfer(movementId: string, approve: boolean, note?: string): Promise<void>;
  saveItem(draft: ItemDraft): Promise<InventoryItem>;
}
