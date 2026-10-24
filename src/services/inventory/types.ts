import type { DataSource } from '../../types';
import type { ImsDonation, ImsEvent, ImsPendingRelease } from './imsSnapshot';

/** Inventory types: stock mirrored from PHILRADS IMS, shaped for the portal's views. */

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
  /** One of ITEM_CATEGORIES for portal items; free text for items mirrored from PHILRADS IMS. */
  category: string;
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
  /** IMS count corrections set a lot to a figure instead of adding or removing. */
  setTo?: number | null;
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

/** Where stock came from. Today always 'ims' (sample or live); kept as a type for cached data. */
export type InventorySource = DataSource | 'ims';

export interface InventorySnapshot {
  source: InventorySource;
  /** When the data was produced (for IMS: when the IMS built the snapshot). */
  fetchedAt: string;
  /** IMS only: when the portal received the snapshot. */
  receivedAt?: string;
  /** IMS only: where staff go to change stock. */
  imsUrl?: string;
  /** Demonstration data, never real PHILRADS stock. */
  sample?: boolean;
  /** IMS only: releases waiting for their two administrator approvals. */
  imsPendingReleases?: ImsPendingRelease[];
  /** IMS only: relief events with beneficiary targets and served counts by area. */
  imsEvents?: ImsEvent[];
  /** IMS only: donations traced to the releases that gave them out. */
  imsDonations?: ImsDonation[];
  items: InventoryItem[];
  locations: InventoryLocation[];
  batches: StockBatch[];
  /** Most recent first. */
  movements: Movement[];
}

/** Reads the stock snapshot. Stock is changed only in PHILRADS IMS. */
export interface InventoryService {
  readonly source: InventorySource;
  getSnapshot(): Promise<InventorySnapshot>;
}
