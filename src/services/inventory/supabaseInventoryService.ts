import type { SupabaseClient } from '@supabase/supabase-js';
import {
  InventoryRuleError,
  type InventoryItem,
  type InventoryLocation,
  type InventoryService,
  type ItemCategory,
  type LocationKind,
  type Movement,
  type MovementType,
  type StockBatch,
} from './types';

/**
 * Live inventory data. Reads go through Row Level Security; every write goes through a
 * SECURITY DEFINER function (record_inventory_movement, decide_inventory_transfer) that
 * checks the caller's permissions and re-validates the business rules on the server
 * (supabase/migrations/20261022000000_inventory_operations.sql).
 */

type PgError = { message: string; code?: string } | null;

/** Rule violations (raised by our functions or constraints) are final; anything else is worth retrying. */
function fail(context: string, error: PgError): never {
  const code = error?.code ?? '';
  if (code && !code.startsWith('PGRST')) {
    // P0001 = our own friendly messages; 23xxx = constraint violations; 42501 = permission denied.
    const friendly =
      code === 'P0001'
        ? error!.message
        : code === '23505'
          ? 'That SKU, barcode or name is already in use.'
          : code === '42501'
            ? 'Your role does not allow this.'
            : `The server rejected this ${context}.`;
    throw new InventoryRuleError(friendly);
  }
  console.error(`[inventory] ${context}`, error);
  throw new Error(`Could not reach the server to ${context}.`);
}

const num = (v: unknown) => Number(v ?? 0);
const nameOf = (p: unknown) => (p as { display_name?: string } | null)?.display_name || 'Staff member';

export function createSupabaseInventoryService(client: SupabaseClient): InventoryService {
  return {
    source: 'supabase',

    async getSnapshot() {
      const [items, locations, batches, movements, transfers] = await Promise.all([
        client.from('inventory_items').select('id, sku, barcode, name, category, unit, reorder_level, tracks_expiry').eq('is_active', true).order('name'),
        client.from('inventory_locations').select('id, name, kind, region').eq('is_active', true).order('name'),
        client.from('inventory_batches').select('id, item_id, location_id, lot_number, expiry_date, quantity_on_hand, received_at').limit(5000),
        client
          .from('inventory_movements')
          .select(
            'id, client_id, movement_type, item_id, batch_id, location_id, quantity_change, reference, notes, occurred_at, created_at, recorded_by, inventory_batches(lot_number, expiry_date), recorder:profiles!inventory_movements_recorded_by_fkey(display_name)',
          )
          .is('transfer_id', null)
          .order('occurred_at', { ascending: false })
          .limit(500),
        client
          .from('inventory_transfers')
          .select(
            'id, client_id, item_id, batch_id, from_location_id, to_location_id, quantity, reference, notes, status, occurred_at, requested_at, requested_by, decided_at, decision_note, inventory_batches(lot_number, expiry_date), requester:profiles!inventory_transfers_requested_by_fkey(display_name), decider:profiles!inventory_transfers_decided_by_fkey(display_name)',
          )
          .order('requested_at', { ascending: false })
          .limit(300),
      ]);
      for (const [label, r] of [['load items', items], ['load locations', locations], ['load stock', batches], ['load movements', movements], ['load transfers', transfers]] as const) {
        if (r.error) fail(label, r.error);
      }

      const ledger: Movement[] = (movements.data ?? []).map((m) => {
        const batch = m.inventory_batches as unknown as { lot_number: string | null; expiry_date: string | null } | null;
        const change = num(m.quantity_change);
        const type: MovementType = m.movement_type === 'receipt' ? 'receipt' : m.movement_type === 'release' ? 'release' : 'adjustment';
        return {
          id: m.id as string,
          clientId: (m.client_id as string | null) ?? (m.id as string),
          type,
          itemId: m.item_id as string,
          batchId: (m.batch_id as string | null) ?? null,
          lotNumber: batch?.lot_number ?? null,
          expiryDate: batch?.expiry_date ?? null,
          locationId: (m.location_id as string | null) ?? '',
          toLocationId: null,
          quantity: type === 'adjustment' ? change : Math.abs(change),
          reference: (m.reference as string | null) ?? null,
          notes: (m.notes as string | null) ?? null,
          occurredAt: m.occurred_at as string,
          recordedAt: m.created_at as string,
          recordedById: (m.recorded_by as string | null) ?? '',
          recordedByName: nameOf(m.recorder),
          status: 'applied',
        };
      });
      const transferRows: Movement[] = (transfers.data ?? []).map((t) => {
        const batch = t.inventory_batches as unknown as { lot_number: string | null; expiry_date: string | null } | null;
        return {
          id: t.id as string,
          clientId: t.client_id as string,
          type: 'transfer',
          itemId: t.item_id as string,
          batchId: t.batch_id as string,
          lotNumber: batch?.lot_number ?? null,
          expiryDate: batch?.expiry_date ?? null,
          locationId: t.from_location_id as string,
          toLocationId: t.to_location_id as string,
          quantity: num(t.quantity),
          reference: (t.reference as string | null) ?? null,
          notes: (t.notes as string | null) ?? null,
          occurredAt: (t.occurred_at as string | null) ?? (t.requested_at as string),
          recordedAt: t.requested_at as string,
          recordedById: (t.requested_by as string | null) ?? '',
          recordedByName: nameOf(t.requester),
          status: t.status === 'pending' ? 'pending_approval' : t.status === 'rejected' ? 'rejected' : 'applied',
          decidedByName: t.decider ? nameOf(t.decider) : null,
          decidedAt: (t.decided_at as string | null) ?? null,
          decisionNote: (t.decision_note as string | null) ?? null,
        };
      });

      return {
        source: 'supabase',
        fetchedAt: new Date().toISOString(),
        items: (items.data ?? []).map<InventoryItem>((i) => ({
          id: i.id as string,
          sku: (i.sku as string | null) ?? '',
          barcode: (i.barcode as string | null) ?? null,
          name: i.name as string,
          category: ((i.category as string | null) ?? 'Other') as ItemCategory,
          unit: i.unit as string,
          reorderLevel: num(i.reorder_level),
          tracksExpiry: Boolean(i.tracks_expiry),
        })),
        locations: (locations.data ?? []).map<InventoryLocation>((l) => ({
          id: l.id as string,
          name: l.name as string,
          kind: l.kind as LocationKind,
          region: (l.region as string | null) ?? undefined,
        })),
        batches: (batches.data ?? []).map<StockBatch>((b) => ({
          id: b.id as string,
          itemId: b.item_id as string,
          locationId: b.location_id as string,
          lotNumber: (b.lot_number as string | null) ?? null,
          expiryDate: (b.expiry_date as string | null) ?? null,
          quantity: num(b.quantity_on_hand),
          receivedAt: b.received_at as string,
        })),
        movements: [...ledger, ...transferRows].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
      };
    },

    async submitMovement(d) {
      const { data, error } = await client.rpc('record_inventory_movement', {
        p_client_id: d.clientId,
        p_type: d.type,
        p_item_id: d.itemId,
        p_location_id: d.locationId,
        p_quantity: d.quantity,
        p_batch_id: d.batchId ?? null,
        p_to_location_id: d.toLocationId ?? null,
        p_lot_number: d.lotNumber?.trim() || null,
        p_expiry_date: d.expiryDate || null,
        p_reference: d.reference?.trim() || null,
        p_notes: d.notes?.trim() || null,
        p_occurred_at: d.occurredAt,
      });
      if (error) fail('save this movement', error);
      const r = data as { id: string; status: string };
      return {
        movement: {
          id: r.id,
          clientId: d.clientId,
          type: d.type,
          itemId: d.itemId,
          batchId: d.batchId ?? null,
          lotNumber: d.lotNumber ?? null,
          expiryDate: d.expiryDate ?? null,
          locationId: d.locationId,
          toLocationId: d.toLocationId ?? null,
          quantity: d.quantity,
          reference: d.reference ?? null,
          notes: d.notes ?? null,
          occurredAt: d.occurredAt,
          recordedAt: new Date().toISOString(),
          recordedById: '',
          recordedByName: '',
          status: r.status === 'pending' ? 'pending_approval' : 'applied',
        },
      };
    },

    async decideTransfer(id, approve, note) {
      const { error } = await client.rpc('decide_inventory_transfer', { p_transfer_id: id, p_approve: approve, p_note: note?.trim() || null });
      if (error) fail('decide on this transfer', error);
    },

    async saveItem(d) {
      const row = {
        sku: d.sku.trim().toUpperCase(),
        barcode: d.barcode?.trim() || null,
        name: d.name.trim(),
        category: d.category,
        unit: d.unit.trim(),
        reorder_level: d.reorderLevel,
        tracks_expiry: d.tracksExpiry,
      };
      const q = d.id ? client.from('inventory_items').update(row).eq('id', d.id) : client.from('inventory_items').insert(row);
      const { data, error } = await q.select('id').single();
      if (error) fail('save this item', error);
      return { id: data.id as string, ...d, sku: row.sku, barcode: row.barcode, name: row.name, unit: row.unit };
    },
  };
}
