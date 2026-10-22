import type { SupabaseClient } from '@supabase/supabase-js';
import { createInventorySeed } from '../../data/mockInventory';
import { imsSnapshotSchema, mapImsSnapshot, type ImsSnapshot } from './imsSnapshot';
import { InventoryRuleError, type InventoryService } from './types';

/**
 * Read-only inventory mirrored from PHILRADS IMS. The IMS pushes a snapshot after every
 * stock change (api/ims-sync.ts stores it); the portal only displays it. Receiving,
 * releasing and approvals happen in the IMS, so every write method refuses.
 */
const readOnly = (): never => {
  throw new InventoryRuleError('Stock is managed in PHILRADS IMS. Open the IMS to make changes.');
};

export function createImsInventoryService(client: SupabaseClient): InventoryService {
  return {
    source: 'ims',
    readOnly: true,
    async getSnapshot() {
      const { data, error } = await client.from('ims_inventory_snapshot').select('payload, received_at').eq('id', 1).maybeSingle();
      if (error) {
        console.error('[inventory] IMS snapshot', error);
        throw new Error('Could not load stock from PHILRADS IMS.');
      }
      if (!data) throw new InventoryRuleError('PHILRADS IMS has not sent any stock data yet.');
      const parsed = imsSnapshotSchema.safeParse(data.payload);
      if (!parsed.success) throw new InventoryRuleError('The stock data from PHILRADS IMS is in an unexpected format.');
      return mapImsSnapshot(parsed.data, data.received_at as string);
    },
    submitMovement: readOnly,
    decideTransfer: readOnly,
    saveItem: readOnly,
  };
}

/** Sample-data stand-in: the demo inventory, shaped exactly like an IMS push. */
export function createSampleImsService(imsUrl: string): InventoryService {
  return {
    source: 'ims',
    readOnly: true,
    async getSnapshot() {
      if (!navigator.onLine) throw new TypeError('Failed to fetch (offline)');
      await new Promise((r) => setTimeout(r, 250));
      const snapshot = mapImsSnapshot(imsSnapshotSchema.parse(sampleImsPayload(imsUrl)), new Date().toISOString());
      // Sample data is never presented as live IMS data.
      return { ...snapshot, source: 'ims', sample: true };
    },
    submitMovement: readOnly,
    decideTransfer: readOnly,
    saveItem: readOnly,
  };
}

function sampleImsPayload(imsUrl: string): ImsSnapshot {
  const seed = createInventorySeed(Date.now() - 4 * 60_000);
  const locName = new Map(seed.locations.map((l) => [l.id, l.name]));
  return {
    version: 1,
    generated_at: seed.fetchedAt,
    ims_url: imsUrl,
    items: seed.items.map((i) => ({
      id: i.id,
      code: i.sku,
      name: i.name,
      category: i.category,
      unit: i.unit,
      low_stock_threshold: i.reorderLevel,
      requires_expiry: i.tracksExpiry,
    })),
    batches: seed.batches
      .filter((b) => b.quantity > 0)
      .map((b) => ({
        id: b.id,
        code: b.lotNumber ?? b.id.toUpperCase(),
        item_id: b.itemId,
        qty: b.quantity,
        expiry_date: b.expiryDate,
        location: locName.get(b.locationId) ?? 'Stockroom',
        received_at: b.receivedAt,
      })),
    movements: seed.movements.slice(0, 400).map((m) => ({
      id: m.id,
      // The IMS has no transfers; show pending ones as releases awaiting its two-admin approval.
      kind: m.type === 'transfer' ? 'release' : m.type,
      item_id: m.itemId,
      batch_id: m.batchId,
      qty: m.quantity,
      set_to: null,
      location: locName.get(m.locationId) ?? 'Stockroom',
      reference: m.reference,
      notes: m.notes,
      status: m.status === 'pending_approval' ? 'pending_approval' : m.status === 'rejected' ? 'rejected' : 'applied',
      occurred_at: m.occurredAt,
      recorded_at: m.recordedAt,
      recorded_by: m.recordedByName,
    })),
    pending_releases: seed.movements
      .filter((m) => m.status === 'pending_approval')
      .map((m, i) => ({
        id: `sample-rel-${i + 1}`,
        code: `RLS-0${(i + 41).toString().padStart(4, '0')}`,
        status: i === 0 ? 'partially_approved' : 'pending',
        purpose: m.reference,
        recipient_org: i === 0 ? 'Tacloban City DSWD (sample)' : 'Legazpi CDRRMO (sample)',
        event_name: i === 0 ? 'Typhoon response: Eastern Visayas (sample)' : null,
        requested_by: m.recordedByName,
        requested_at: m.occurredAt,
        lines: [{ item_id: m.itemId, name: seed.items.find((it) => it.id === m.itemId)?.name ?? 'Item', qty: m.quantity, unit: seed.items.find((it) => it.id === m.itemId)?.unit ?? 'pcs' }],
        approvals: i === 0 ? [{ by: 'Grace Villanueva (sample admin)', decision: 'approved' as const, at: m.occurredAt }] : [],
      })),
    events: SAMPLE_EVENTS(),
  };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const dayOffset = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

/** Sample relief events with served counts building up by area (invented, not real figures). */
const SAMPLE_EVENTS = () => [
  {
    id: 'sample-ev-1',
    name: 'Typhoon response: Eastern Visayas (sample)',
    type: 'disaster_relief',
    location: 'Tacloban and Palo, Leyte',
    target: 1200,
    served: 845,
    status: 'active' as const,
    start_date: dayOffset(-6),
    end_date: dayOffset(8),
    areas: [
      { area: 'Brgy. 62 Sagkahan, Tacloban', served: 320, last_at: hoursAgo(2) },
      { area: 'Brgy. San Jose, Tacloban', served: 285, last_at: hoursAgo(20) },
      { area: 'Brgy. Candahug, Palo', served: 240, last_at: hoursAgo(5) },
    ],
    updates: [
      { area: 'Brgy. 62 Sagkahan, Tacloban', served: 120, note: 'Second distribution day', by: 'Maria Santos (sample)', at: hoursAgo(2) },
      { area: 'Brgy. Candahug, Palo', served: 240, note: null, by: 'Jun Dela Cruz (sample)', at: hoursAgo(5) },
      { area: 'Brgy. San Jose, Tacloban', served: 285, note: 'Evacuation center', by: 'Maria Santos (sample)', at: hoursAgo(20) },
      { area: 'Brgy. 62 Sagkahan, Tacloban', served: 200, note: null, by: 'Maria Santos (sample)', at: hoursAgo(30) },
    ],
  },
  {
    id: 'sample-ev-2',
    name: 'Feeding program: Manila North (sample)',
    type: 'feeding',
    location: 'Tondo, Manila',
    target: 300,
    served: 300,
    status: 'active' as const,
    start_date: dayOffset(-20),
    end_date: dayOffset(1),
    areas: [
      { area: 'Brgy. 105, Tondo', served: 180, last_at: hoursAgo(26) },
      { area: 'Brgy. 128, Tondo', served: 120, last_at: hoursAgo(50) },
    ],
    updates: [
      { area: 'Brgy. 105, Tondo', served: 180, note: null, by: 'Ana Reyes (sample)', at: hoursAgo(26) },
      { area: 'Brgy. 128, Tondo', served: 120, note: null, by: 'Ana Reyes (sample)', at: hoursAgo(50) },
    ],
  },
  {
    id: 'sample-ev-3',
    name: 'Medical mission: Albay (sample)',
    type: 'medical_mission',
    location: 'Daraga, Albay',
    target: 500,
    served: 0,
    status: 'upcoming' as const,
    start_date: dayOffset(5),
    end_date: dayOffset(6),
    areas: [],
    updates: [],
  },
];
