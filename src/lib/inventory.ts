/**
 * Inventory rules shared by the UI, the offline outbox and the sample data source.
 * The Supabase database enforces the same rules again (supabase/migrations/*_inventory_operations.sql),
 * so a modified client cannot bypass them.
 */
import type {
  InventoryItem,
  InventoryLocation,
  InventorySnapshot,
  ItemDraft,
  Movement,
  MovementDraft,
  StockBatch,
} from '../services/inventory/types';
import { ITEM_CATEGORIES } from '../services/inventory/types';
import { manilaDayKey } from './format';

export type StockStatus = 'in' | 'low' | 'out';
export type ExpiryStatus = 'none' | 'ok' | 'expiring' | 'expired';

/** Alert windows for perishables, in days. */
export const EXPIRY_WINDOWS = [30, 60, 90] as const;
export type ExpiryWindow = (typeof EXPIRY_WINDOWS)[number];

const DAY = 86_400_000;
export const MAX_QUANTITY = 1_000_000;

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

/** First-expiry, first-out: usable lots in the order they should leave the shelf. */
export function fefo(batches: StockBatch[], today = todayKey()): StockBatch[] {
  return batches
    .filter((b) => b.quantity > 0 && expiryStatus(b.expiryDate, today) !== 'expired')
    .sort(
      (a, b) =>
        (a.expiryDate ?? '9999-12-31').localeCompare(b.expiryDate ?? '9999-12-31') || a.receivedAt.localeCompare(b.receivedAt),
    );
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

/** Quantity of a lot already promised by moves on this device or awaiting approval. */
export function reservedFromBatch(batchId: string, pending: Pick<Movement, 'batchId' | 'type' | 'quantity' | 'status'>[]) {
  return pending
    .filter((m) => m.batchId === batchId && (m.status === 'pending_sync' || m.status === 'pending_approval'))
    .reduce((s, m) => s + (m.type === 'adjustment' ? Math.max(0, -m.quantity) : m.type === 'receipt' ? 0 : m.quantity), 0);
}

export type FieldErrors = Partial<Record<keyof MovementDraft | keyof ItemDraft | 'form', string>>;

export interface MovementContext {
  items: InventoryItem[];
  locations: InventoryLocation[];
  batches: StockBatch[];
  /** Moves not yet in the ledger (outbox and transfers awaiting approval). */
  pending: Pick<Movement, 'batchId' | 'type' | 'quantity' | 'status'>[];
  canAdjust: boolean;
  today?: string;
  now?: number;
}

const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const clean = (v: string | null | undefined) => (v ?? '').trim();

/**
 * Every rule a stock movement must pass. Returns field-level messages (empty when valid),
 * so forms can show errors inline before anything is saved.
 */
export function validateMovement(d: MovementDraft, ctx: MovementContext): FieldErrors {
  const e: FieldErrors = {};
  const today = ctx.today ?? todayKey();
  const now = ctx.now ?? Date.now();
  const item = ctx.items.find((i) => i.id === d.itemId);
  if (!item) e.itemId = 'Choose an item.';
  if (!ctx.locations.some((l) => l.id === d.locationId)) e.locationId = d.type === 'receipt' ? 'Choose where the goods arrived.' : 'Choose the location.';

  if (!Number.isFinite(d.quantity) || !Number.isInteger(d.quantity)) e.quantity = 'Enter a whole number.';
  else if (d.type === 'adjustment' ? d.quantity === 0 : d.quantity <= 0)
    e.quantity = d.type === 'adjustment' ? 'An adjustment cannot be zero.' : 'Quantity must be at least 1.';
  else if (Math.abs(d.quantity) > MAX_QUANTITY) e.quantity = `Quantity cannot exceed ${MAX_QUANTITY.toLocaleString('en-PH')}.`;

  const occurred = Date.parse(d.occurredAt);
  if (Number.isNaN(occurred)) e.occurredAt = 'Enter when this happened.';
  else if (occurred > now + 5 * 60_000) e.occurredAt = 'This cannot be in the future.';
  else if (occurred < now - 60 * 86_400_000) e.occurredAt = 'Older than 60 days: ask an administrator to record it.';

  if (clean(d.reference).length > 80) e.reference = 'Keep this under 80 characters.';
  if (clean(d.notes).length > 500) e.notes = 'Keep notes under 500 characters.';

  if (d.type === 'receipt') {
    const lot = clean(d.lotNumber);
    if (lot.length > 40) e.lotNumber = 'Keep the lot number under 40 characters.';
    if (item?.tracksExpiry && !d.expiryDate) e.expiryDate = 'Perishable: enter the expiry date printed on the goods.';
    if (d.expiryDate) {
      if (!isIsoDate(d.expiryDate)) e.expiryDate = 'Enter a valid date.';
      else if (daysUntil(d.expiryDate, today) < 0) e.expiryDate = 'These goods have expired. Do not receive them into stock.';
    }
    return e;
  }

  // Release, transfer and adjustment all draw on one lot.
  const batch = ctx.batches.find((b) => b.id === d.batchId);
  if (!batch || batch.itemId !== d.itemId || batch.locationId !== d.locationId) {
    e.batchId = 'Choose the lot the goods come from.';
    return e;
  }
  const available = batch.quantity - reservedFromBatch(batch.id, ctx.pending);
  const expired = expiryStatus(batch.expiryDate, today) === 'expired';

  if (d.type === 'release' || d.type === 'transfer') {
    if (expired) e.batchId = 'This lot has expired and cannot be released or transferred. An approver can write it off.';
    else if (!e.quantity && d.quantity > available)
      e.quantity = available <= 0 ? 'Nothing left in this lot.' : `Only ${available.toLocaleString('en-PH')} available in this lot.`;
  }
  if (d.type === 'release' && !clean(d.reference)) e.reference = 'Say who received the goods or give the DR/RIS number.';
  if (d.type === 'transfer') {
    if (!ctx.locations.some((l) => l.id === d.toLocationId)) e.toLocationId = 'Choose the destination.';
    else if (d.toLocationId === d.locationId) e.toLocationId = 'Destination must differ from the source.';
  }
  if (d.type === 'adjustment') {
    if (!ctx.canAdjust) e.form = 'Only approvers can adjust stock. Ask an administrator.';
    if (!clean(d.notes)) e.notes = 'Give the reason (count discrepancy, damage, expired write-off…).';
    if (!e.quantity && d.quantity < 0 && -d.quantity > available)
      e.quantity = `Cannot remove more than the ${available.toLocaleString('en-PH')} in this lot.`;
  }
  return e;
}

export function validateItem(d: ItemDraft, items: InventoryItem[]): FieldErrors {
  const e: FieldErrors = {};
  const others = items.filter((i) => i.id !== d.id);
  const name = d.name.trim();
  if (!name) e.name = 'Enter the item name.';
  else if (name.length > 80) e.name = 'Keep the name under 80 characters.';
  else if (others.some((i) => i.name.trim().toLowerCase() === name.toLowerCase())) e.name = 'An item with this name already exists.';

  const sku = d.sku.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(sku)) e.sku = '3–24 letters, numbers or dashes.';
  else if (others.some((i) => i.sku.toUpperCase() === sku)) e.sku = 'This SKU is already used by another item.';

  const code = clean(d.barcode);
  if (code) {
    if (code.length > 64 || /\s/.test(code)) e.barcode = 'Barcodes have no spaces and at most 64 characters.';
    else if (others.some((i) => i.barcode === code)) e.barcode = 'This barcode is already linked to another item.';
  }
  if (!ITEM_CATEGORIES.includes(d.category)) e.category = 'Choose a category.';
  if (!d.unit.trim()) e.unit = 'Enter the unit (e.g. packs, kits, pcs).';
  else if (d.unit.trim().length > 16) e.unit = 'Keep the unit under 16 characters.';
  if (!Number.isInteger(d.reorderLevel) || d.reorderLevel < 0) e.reorderLevel = 'Enter a whole number, 0 or more.';
  else if (d.reorderLevel > MAX_QUANTITY) e.reorderLevel = 'That reorder level is too high.';
  return e;
}

/** Find an item by scanned or typed code: barcode first, then SKU (case-insensitive). */
export function findItemByCode(items: InventoryItem[], code: string) {
  const c = code.trim();
  if (!c) return undefined;
  return items.find((i) => i.barcode === c) ?? items.find((i) => i.sku.toUpperCase() === c.toUpperCase());
}

export const newClientId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Signed change a movement makes to its source location. */
export const quantityChange = (m: Pick<Movement, 'type' | 'quantity'>) =>
  m.type === 'receipt' ? m.quantity : m.type === 'adjustment' ? m.quantity : -m.quantity;
