/** Stock status and expiry rules for the portal's view of PHILRADS IMS stock. */
import type { InventoryItem, InventoryLocation, InventorySnapshot, StockBatch } from '../services/inventory/types';
import { ITEM_CATEGORIES } from '../services/inventory/types';
import { manilaDayKey } from './format';

export type StockStatus = 'in' | 'low' | 'out';
export type ExpiryStatus = 'none' | 'ok' | 'expiring' | 'expired';

/** Alert windows for perishables, in days. */
export const EXPIRY_WINDOWS = [30, 60, 90] as const;
export type ExpiryWindow = (typeof EXPIRY_WINDOWS)[number];

const DAY = 86_400_000;

/** Today's date in Manila (YYYY-MM-DD). Stock expiry is judged by the local calendar day. */
export const todayKey = () => manilaDayKey(new Date().toISOString());

export const daysUntil = (isoDate: string, today = todayKey()) =>
  Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);

export const stockStatus = (onHand: number, reorderLevel: number): StockStatus =>
  onHand <= 0 ? 'out' : onHand < reorderLevel ? 'low' : 'in';

export function expiryStatus(expiryDate: string | null, today = todayKey()): ExpiryStatus {
  if (!expiryDate) return 'none';
  const days = daysUntil(expiryDate, today);
  if (days < 0) return 'expired';
  return days <= EXPIRY_WINDOWS[EXPIRY_WINDOWS.length - 1] ? 'expiring' : 'ok';
}

/** Smallest alert window an expiry date falls in (30, 60 or 90), or null. */
export function expiryWindow(expiryDate: string | null, today = todayKey()): ExpiryWindow | null {
  if (!expiryDate) return null;
  const days = daysUntil(expiryDate, today);
  if (days < 0) return null;
  return EXPIRY_WINDOWS.find((w) => days <= w) ?? null;
}

/** One row of the stock list: an item at one location, with its lots. */
export interface StockRow {
  key: string;
  item: InventoryItem;
  location: InventoryLocation | null;
  /** Everything on the shelf, including expired lots. */
  onHand: number;
  /** On hand minus expired: what can actually be released. Stock status is based on this. */
  usable: number;
  /** Lots with stock, soonest expiry first (expired lots included, so they can be written off). */
  batches: StockBatch[];
  nearestExpiry: string | null;
  stock: StockStatus;
  expiry: ExpiryStatus;
  /** Expired quantity still on the shelf. Never available to release. */
  expiredQty: number;
  lastMovementAt: string | null;
}

export function buildStockRows(snapshot: InventorySnapshot, today = todayKey()): StockRow[] {
  const locations = new Map(snapshot.locations.map((l) => [l.id, l]));
  const lastMove = new Map<string, string>();
  for (const m of snapshot.movements) {
    if (m.status !== 'applied') continue;
    for (const loc of [m.locationId, m.toLocationId]) {
      if (!loc) continue;
      const k = `${m.itemId}:${loc}`;
      if (!lastMove.has(k) || lastMove.get(k)! < m.occurredAt) lastMove.set(k, m.occurredAt);
    }
  }
  const groups = new Map<string, StockBatch[]>();
  for (const b of snapshot.batches) {
    const k = `${b.itemId}:${b.locationId}`;
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const rows: StockRow[] = [];
  const stocked = new Set<string>();
  for (const [key, batches] of groups) {
    const item = snapshot.items.find((i) => i.id === batches[0].itemId);
    if (!item) continue;
    stocked.add(item.id);
    const withStock = batches
      .filter((b) => b.quantity > 0)
      .sort((a, b) => (a.expiryDate ?? '9999-12-31').localeCompare(b.expiryDate ?? '9999-12-31'));
    const onHand = withStock.reduce((s, b) => s + b.quantity, 0);
    const nearestExpiry = withStock.find((b) => b.expiryDate)?.expiryDate ?? null;
    const expiredQty = withStock.filter((b) => expiryStatus(b.expiryDate, today) === 'expired').reduce((s, b) => s + b.quantity, 0);
    rows.push({
      key,
      item,
      location: locations.get(batches[0].locationId) ?? null,
      onHand,
      usable: onHand - expiredQty,
      batches: withStock,
      nearestExpiry,
      stock: stockStatus(onHand - expiredQty, item.reorderLevel),
      expiry: expiryStatus(nearestExpiry, today),
      expiredQty,
      lastMovementAt: lastMove.get(key) ?? null,
    });
  }
  // Catalogue items never stocked anywhere still appear, as out of stock.
  for (const item of snapshot.items) {
    if (stocked.has(item.id)) continue;
    rows.push({
      key: `${item.id}:none`,
      item,
      location: null,
      onHand: 0,
      usable: 0,
      batches: [],
      nearestExpiry: null,
      stock: 'out',
      expiry: 'none',
      expiredQty: 0,
      lastMovementAt: null,
    });
  }
  return rows;
}

/** Categories in display order: the portal's standard list first, then any others (e.g. from IMS). */
export const categoriesOf = (items: Pick<InventoryItem, 'category'>[]) => {
  const present = new Set(items.map((i) => i.category));
  const known = ITEM_CATEGORIES.filter((c) => present.has(c));
  const extra = [...present].filter((c) => !(ITEM_CATEGORIES as readonly string[]).includes(c)).sort();
  return [...known, ...extra];
};
