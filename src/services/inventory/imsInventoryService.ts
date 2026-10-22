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
  };
}
