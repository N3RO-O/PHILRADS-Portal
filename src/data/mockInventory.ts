/**
 * DEVELOPMENT-ONLY SAMPLE DATA for the Inventory module.
 * Invented items, lots, people and quantities. Not real PHILRADS stock.
 * Barcodes use the GS1 "in-store" 200 prefix so they never match real retail products.
 * Dates are relative to "now" so expiry alerts always have something to show.
 */
import { manilaDayKey } from '../lib/format';
import type {
  InventoryItem,
  InventoryLocation,
  InventorySnapshot,
  ItemCategory,
  Movement,
  StockBatch,
} from '../services/inventory/types';

const DAY = 86_400_000;

/** Deterministic random numbers, so the sample data is the same on every load. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** EAN-13 with a valid check digit. */
export function ean13(body12: string) {
  const sum = body12.split('').reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return body12 + ((10 - (sum % 10)) % 10);
}

export const mockLocations: InventoryLocation[] = [
  { id: 'loc-mnl', name: 'Main Manila Warehouse', kind: 'warehouse', region: 'NCR' },
  { id: 'loc-ceb', name: 'Cebu Hub', kind: 'hub', region: 'Central Visayas' },
  { id: 'loc-tac', name: 'Tacloban Field Hub', kind: 'hub', region: 'Eastern Visayas' },
  { id: 'loc-bcl', name: 'Legazpi Field Drop-off Point', kind: 'field', region: 'Bicol' },
];

type Seed = [name: string, category: ItemCategory, unit: string, reorder: number, perishable: boolean];

const ITEM_SEEDS: Seed[] = [
  ['Rice, 25 kg sack', 'Food', 'sacks', 80, true],
  ['Rice, 5 kg pack', 'Food', 'packs', 200, true],
  ['Family food pack', 'Food', 'packs', 300, true],
  ['Canned sardines, 155 g', 'Food', 'cans', 500, true],
  ['Canned corned beef, 150 g', 'Food', 'cans', 300, true],
  ['Instant noodles, 55 g', 'Food', 'packs', 600, true],
  ['Ready-to-use therapeutic food', 'Food', 'sachets', 400, true],
  ['High-energy biscuits', 'Food', 'packs', 300, true],
  ['Bottled water, 500 mL', 'Water and sanitation', 'bottles', 1000, true],
  ['Bottled water, 6 L', 'Water and sanitation', 'bottles', 150, true],
  ['Water purification tablets', 'Water and sanitation', 'strips', 200, true],
  ['Collapsible jerry can, 20 L', 'Water and sanitation', 'pcs', 100, false],
  ['Water filter (household)', 'Water and sanitation', 'units', 40, false],
  ['Hygiene kit (family)', 'Hygiene', 'kits', 150, false],
  ['Dignity kit (women)', 'Hygiene', 'kits', 100, false],
  ['Bath soap, 90 g', 'Hygiene', 'bars', 400, true],
  ['Sanitary pads, 8s', 'Hygiene', 'packs', 300, false],
  ['Diapers (baby), 20s', 'Hygiene', 'packs', 120, false],
  ['Toothpaste, 50 mL', 'Hygiene', 'tubes', 300, true],
  ['Tarpaulin, 4 × 6 m', 'Shelter', 'pcs', 200, false],
  ['Shelter repair kit', 'Shelter', 'kits', 60, false],
  ['Sleeping mat', 'Shelter', 'pcs', 100, false],
  ['Blanket (fleece)', 'Shelter', 'pcs', 150, false],
  ['Mosquito net (LLIN)', 'Shelter', 'pcs', 120, false],
  ['Nylon rope, 30 m', 'Shelter', 'rolls', 50, false],
  ['Oral rehydration salts', 'Medical', 'sachets', 500, true],
  ['Paracetamol 500 mg, 100s', 'Medical', 'boxes', 60, true],
  ['Amoxicillin 500 mg, 100s', 'Medical', 'boxes', 30, true],
  ['First aid kit', 'Medical', 'kits', 40, true],
  ['Face masks, 50s', 'Medical', 'boxes', 100, true],
  ['Zinc tablets, 20 mg', 'Medical', 'boxes', 50, true],
  ['Solar lamp', 'Household', 'pcs', 50, false],
  ['Kitchen set', 'Household', 'sets', 60, false],
  ['Cooking pot, 8 L', 'Household', 'pcs', 60, false],
  ['Flashlight with batteries', 'Household', 'pcs', 80, false],
  ['Plastic basin', 'Household', 'pcs', 80, false],
];

const SKU_PREFIX: Record<ItemCategory, string> = {
  Food: 'FD',
  'Water and sanitation': 'WS',
  Hygiene: 'HY',
  Shelter: 'SH',
  Medical: 'MD',
  Household: 'HH',
  Other: 'OT',
};

export const ACTORS = [
  { id: 'u-maria', name: 'Maria Santos (sample)' },
  { id: 'u-jun', name: 'Jun Dela Cruz (sample)' },
  { id: 'u-ana', name: 'Ana Reyes (sample)' },
  { id: 'u-paolo', name: 'Paolo Garcia (sample)' },
  { id: 'u-liza', name: 'Liza Mendoza (sample)' },
];
const APPROVER = { id: 'u-admin', name: 'Grace Villanueva (sample admin)' };
const RECIPIENTS = [
  'Brgy. San Roque evacuation center',
  'Brgy. 62 Sagkahan, Tacloban',
  'Daraga Central School (ECs)',
  'Talisay City DSWD office',
  'Brgy. Bagong Silangan',
  'Municipal Hall, Guinobatan',
];

export function createInventorySeed(now = Date.now()): InventorySnapshot {
  const rand = mulberry32(20261022);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const day = (offset: number) => manilaDayKey(new Date(now + offset * DAY).toISOString());
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  const counters: Partial<Record<ItemCategory, number>> = {};
  const items: InventoryItem[] = ITEM_SEEDS.map(([name, category, unit, reorderLevel, tracksExpiry], i) => {
    counters[category] = (counters[category] ?? 0) + 1;
    return {
      id: `itm-${i + 1}`,
      sku: `${SKU_PREFIX[category]}-${String(counters[category]).padStart(3, '0')}`,
      barcode: i % 7 === 6 ? null : ean13(`2004810${String(i + 1).padStart(5, '0')}`),
      name,
      category,
      unit,
      reorderLevel,
      tracksExpiry,
    };
  });

  const batches: StockBatch[] = [];
  const movements: Movement[] = [];
  let seq = 0;

  items.forEach((item, i) => {
    // Every item is at the main warehouse, most at one or more hubs.
    const locs = mockLocations.filter((_, li) => li === 0 || rand() < 0.62 - li * 0.08);
    for (const loc of locs) {
      const lots = item.tracksExpiry ? 1 + Math.floor(rand() * 3) : 1;
      for (let lot = 0; lot < lots; lot++) {
        const scale = loc.kind === 'warehouse' ? 4 : 1.1;
        const roll = rand();
        // A spread of healthy, low and empty locations.
        let qty = Math.round(item.reorderLevel * scale * (roll < 0.12 ? 0 : roll < 0.35 ? 0.3 + rand() * 0.5 : 0.9 + rand() * 1.6));
        if (lot > 0) qty = Math.round(qty * 0.4);
        // Expiry: mostly months away, some inside the 30/60/90 day windows, a few already expired.
        let expiryDate: string | null = null;
        if (item.tracksExpiry) {
          const e = rand();
          const offset = e < 0.06 ? -Math.ceil(rand() * 20) : e < 0.16 ? 3 + Math.floor(rand() * 26) : e < 0.26 ? 31 + Math.floor(rand() * 29) : e < 0.36 ? 61 + Math.floor(rand() * 29) : 120 + Math.floor(rand() * 500);
          expiryDate = day(offset);
        }
        const receivedAgo = (15 + Math.floor(rand() * 120)) * DAY;
        const lotNumber = item.tracksExpiry || rand() < 0.5 ? `L${(24 + Math.floor(rand() * 3)).toString()}${String(100 + ((i * 7 + lot * 13) % 900))}` : null;
        const batch: StockBatch = {
          id: `bat-${++seq}`,
          itemId: item.id,
          locationId: loc.id,
          lotNumber,
          expiryDate,
          quantity: qty,
          receivedAt: iso(receivedAgo),
        };
        batches.push(batch);
        // History that explains the quantity on hand: a receipt, then releases.
        const received = qty + Math.round(item.reorderLevel * rand() * 1.5);
        const actor = pick(ACTORS);
        movements.push({
          id: `mov-${movements.length + 1}`,
          clientId: `seed-${movements.length + 1}`,
          type: 'receipt',
          itemId: item.id,
          batchId: batch.id,
          lotNumber,
          expiryDate,
          locationId: loc.id,
          toLocationId: null,
          quantity: Math.max(received, 1),
          reference: rand() < 0.5 ? `Donation DN-${2600 + Math.floor(rand() * 400)}` : `PO-26-${String(Math.floor(rand() * 900) + 100)}`,
          notes: null,
          occurredAt: iso(receivedAgo),
          recordedAt: iso(receivedAgo - 60_000),
          recordedById: actor.id,
          recordedByName: actor.name,
          status: 'applied',
        });
        let remaining = Math.max(received, 1) - qty;
        let ago = receivedAgo;
        while (remaining > 0) {
          const out = Math.min(remaining, Math.max(1, Math.round(remaining * (0.3 + rand() * 0.7))));
          remaining -= out;
          ago = Math.max(30 * 60_000, ago - (1 + rand() * 12) * DAY);
          const a = pick(ACTORS);
          movements.push({
            id: `mov-${movements.length + 1}`,
            clientId: `seed-${movements.length + 1}`,
            type: 'release',
            itemId: item.id,
            batchId: batch.id,
            lotNumber,
            expiryDate,
            locationId: loc.id,
            toLocationId: null,
            quantity: out,
            reference: pick(RECIPIENTS),
            notes: null,
            occurredAt: iso(ago),
            recordedAt: iso(ago - 120_000),
            recordedById: a.id,
            recordedByName: a.name,
            status: 'applied',
          });
        }
      }
    }
  });

  // Two transfers waiting for an approver.
  const pendingFrom = batches.filter((b) => b.locationId === 'loc-mnl' && b.quantity > 50 && (!b.expiryDate || b.expiryDate > day(30)));
  [pendingFrom[2], pendingFrom[9]].filter(Boolean).forEach((b, i) => {
    const a = ACTORS[i + 1];
    movements.push({
      id: `mov-${movements.length + 1}`,
      clientId: `seed-${movements.length + 1}`,
      type: 'transfer',
      itemId: b.itemId,
      batchId: b.id,
      lotNumber: b.lotNumber,
      expiryDate: b.expiryDate,
      locationId: b.locationId,
      toLocationId: i === 0 ? 'loc-tac' : 'loc-bcl',
      quantity: Math.round(b.quantity * 0.25),
      reference: i === 0 ? 'Typhoon response, wave 2' : 'Pre-positioning for monsoon season',
      notes: null,
      occurredAt: iso((i + 1) * 3 * 3_600_000),
      recordedAt: iso((i + 1) * 3 * 3_600_000),
      recordedById: a.id,
      recordedByName: a.name,
      status: 'pending_approval',
    });
  });

  // One write-off by an approver, so the audit trail shows adjustments.
  const expired = batches.find((b) => b.expiryDate && b.expiryDate < day(0) && b.quantity > 10);
  if (expired) {
    const off = Math.round(expired.quantity / 2);
    expired.quantity -= off;
    movements.push({
      id: `mov-${movements.length + 1}`,
      clientId: `seed-${movements.length + 1}`,
      type: 'adjustment',
      itemId: expired.itemId,
      batchId: expired.id,
      lotNumber: expired.lotNumber,
      expiryDate: expired.expiryDate,
      locationId: expired.locationId,
      toLocationId: null,
      quantity: -off,
      reference: 'Write-off WO-26-014',
      notes: 'Expired stock removed for disposal; remainder awaiting DSWD inspection.',
      occurredAt: iso(5 * 3_600_000),
      recordedAt: iso(5 * 3_600_000),
      recordedById: APPROVER.id,
      recordedByName: APPROVER.name,
      status: 'applied',
      decidedByName: APPROVER.name,
    });
  }

  movements.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return { source: 'mock', fetchedAt: new Date(now).toISOString(), items, locations: mockLocations, batches, movements };
}
