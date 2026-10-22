import { z } from 'zod';
import type { InventoryItem, InventoryLocation, InventorySnapshot, Movement, StockBatch } from './types';

/**
 * The stock snapshot PHILRADS IMS pushes to the portal (prds-ims: app/Models/PortalSync.php).
 * Validated on arrival by api/ims-sync.ts and mapped to the portal's inventory types for display.
 * Limits keep a malformed or hostile payload from bloating the database.
 */
const id = z.string().min(1).max(40);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoTime = z.string().min(10).max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid timestamp');
const text = (max: number) => z.string().max(max);

export const imsSnapshotSchema = z.object({
  version: z.literal(1),
  generated_at: isoTime,
  ims_url: text(300),
  items: z
    .array(
      z.object({
        id,
        code: text(40),
        name: text(255),
        category: text(60),
        unit: text(50),
        low_stock_threshold: z.number().nonnegative().max(1e9),
        requires_expiry: z.boolean(),
      }),
    )
    .max(10_000),
  batches: z
    .array(
      z.object({
        id,
        code: text(40),
        item_id: id,
        qty: z.number().nonnegative().max(1e9),
        expiry_date: isoDate.nullable(),
        location: text(100),
        received_at: isoTime.nullable(),
      }),
    )
    .max(50_000),
  movements: z
    .array(
      z.object({
        id,
        kind: z.enum(['receipt', 'release', 'adjustment']),
        item_id: id,
        batch_id: id.nullable(),
        qty: z.number().min(-1e9).max(1e9),
        set_to: z.number().nonnegative().max(1e9).nullable(),
        location: text(100),
        reference: text(400).nullable(),
        notes: text(400).nullable(),
        status: z.enum(['applied', 'pending_approval', 'rejected']),
        occurred_at: isoTime.nullable(),
        recorded_at: isoTime.nullable(),
        recorded_by: text(200),
      }),
    )
    .max(2_000),
  // Added 2026-10-23; optional so older IMS versions still sync.
  pending_releases: z
    .array(
      z.object({
        id,
        code: text(40),
        status: z.enum(['pending', 'partially_approved']),
        purpose: text(255).nullable(),
        recipient_org: text(255).nullable(),
        event_name: text(255).nullable(),
        requested_by: text(200),
        requested_at: isoTime.nullable(),
        lines: z.array(z.object({ item_id: id, name: text(255), qty: z.number().min(0).max(1e9), unit: text(50) })).max(200),
        approvals: z.array(z.object({ by: text(200), decision: z.enum(['approved', 'rejected']), at: isoTime.nullable() })).max(10),
      }),
    )
    .max(500)
    .optional(),
  events: z
    .array(
      z.object({
        id,
        name: text(255),
        type: text(40),
        location: text(255).nullable(),
        target: z.number().int().nonnegative().max(1e9),
        served: z.number().int().nonnegative().max(1e9),
        status: z.enum(['planned', 'upcoming', 'active', 'completed', 'cancelled']),
        start_date: isoDate.nullable(),
        end_date: isoDate.nullable(),
        areas: z.array(z.object({ area: text(150), served: z.number().int().nonnegative(), last_at: isoTime.nullable() })).max(500),
        updates: z
          .array(z.object({ area: text(150), served: z.number().int().positive(), note: text(255).nullable(), by: text(200), at: isoTime.nullable() }))
          .max(100),
      }),
    )
    .max(200)
    .optional(),
});

export type ImsSnapshot = z.infer<typeof imsSnapshotSchema>;
export type ImsPendingRelease = NonNullable<ImsSnapshot['pending_releases']>[number];
export type ImsEvent = NonNullable<ImsSnapshot['events']>[number];

/** IMS keeps one storage location per batch as free text; each distinct name becomes a portal location. */
const locationId = (name: string) => `ims-loc:${name.trim().toLowerCase()}`;

export function mapImsSnapshot(s: ImsSnapshot, receivedAt?: string): InventorySnapshot {
  const names = new Set<string>([...s.batches.map((b) => b.location), ...s.movements.map((m) => m.location)].map((n) => n.trim() || 'Stockroom'));
  const locations: InventoryLocation[] = [...names].sort().map((name) => ({ id: locationId(name), name, kind: 'warehouse' }));

  const items: InventoryItem[] = s.items.map((i) => ({
    id: i.id,
    sku: i.code,
    barcode: null,
    name: i.name,
    category: i.category,
    unit: i.unit,
    reorderLevel: i.low_stock_threshold,
    tracksExpiry: i.requires_expiry,
  }));

  const batches: StockBatch[] = s.batches.map((b) => ({
    id: b.id,
    itemId: b.item_id,
    locationId: locationId(b.location || 'Stockroom'),
    lotNumber: b.code,
    expiryDate: b.expiry_date,
    quantity: b.qty,
    receivedAt: b.received_at ?? s.generated_at,
  }));
  const lotCode = new Map(s.batches.map((b) => [b.id, b]));

  const movements: Movement[] = s.movements.map((m) => {
    const at = m.occurred_at ?? m.recorded_at ?? s.generated_at;
    const lot = m.batch_id ? lotCode.get(m.batch_id) : undefined;
    return {
      id: `ims-${m.id}`,
      clientId: `ims-${m.id}`,
      type: m.kind,
      itemId: m.item_id,
      batchId: m.batch_id,
      lotNumber: lot?.code ?? null,
      expiryDate: lot?.expiry_date ?? null,
      locationId: locationId(m.location || 'Stockroom'),
      toLocationId: null,
      quantity: m.kind === 'adjustment' ? m.qty : Math.abs(m.qty),
      setTo: m.set_to,
      reference: m.reference,
      notes: m.notes,
      occurredAt: at,
      recordedAt: m.recorded_at ?? at,
      recordedById: '',
      recordedByName: m.recorded_by,
      status: m.status,
    };
  });

  return {
    source: 'ims',
    fetchedAt: s.generated_at,
    receivedAt,
    items,
    locations,
    batches,
    movements: movements.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    imsUrl: s.ims_url || undefined,
    imsPendingReleases: s.pending_releases ?? [],
    imsEvents: s.events ?? [],
  };
}
