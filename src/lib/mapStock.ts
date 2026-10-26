import { expiryStatus, todayKey } from './inventory';
import type { ImsEvent } from '../services/inventory/imsSnapshot';
import type { InventorySnapshot } from '../services/inventory/types';

export interface PlaceStock {
  locationId: string;
  items: number;
  units: number;
  low: number;
  expiring: number;
  expired: number;
  top: { name: string; qty: number; unit: string }[];
}

/** Live stock at a PHILRADS IMS storage location (matched by name, as the IMS writes it). */
export function stockAt(snapshot: InventorySnapshot | null, imsLocation: string | null): PlaceStock | null {
  if (!snapshot || !imsLocation) return null;
  const loc = snapshot.locations.find((l) => l.name.trim().toLowerCase() === imsLocation.trim().toLowerCase());
  if (!loc) return null;
  const today = todayKey();
  const items = new Map(snapshot.items.map((i) => [i.id, i]));
  const perItem = new Map<string, number>();
  let expiring = 0;
  let expired = 0;
  for (const b of snapshot.batches) {
    if (b.locationId !== loc.id || b.quantity <= 0) continue;
    perItem.set(b.itemId, (perItem.get(b.itemId) ?? 0) + b.quantity);
    const s = expiryStatus(b.expiryDate, today);
    if (s === 'expiring') expiring++;
    if (s === 'expired') expired++;
  }
  let low = 0;
  let units = 0;
  for (const [id, qty] of perItem) {
    units += qty;
    const item = items.get(id);
    if (item && qty < item.reorderLevel) low++;
  }
  const top = [...perItem]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, qty]) => ({ name: items.get(id)?.name ?? 'Item', qty, unit: items.get(id)?.unit ?? '' }));
  return { locationId: loc.id, items: perItem.size, units, low, expiring, expired, top };
}

/** The PHILRADS IMS relief event linked to a place. */
export const eventAt = (snapshot: InventorySnapshot | null, imsEventId: string | null): ImsEvent | null =>
  (imsEventId && snapshot?.imsEvents?.find((e) => e.id === imsEventId)) || null;
