/**
 * POST /api/ims-sync: receives the stock snapshot PHILRADS IMS pushes after every stock change
 * (prds-ims: app/Models/PortalSync.php) and stores it for the Inventory page.
 *
 * The IMS runs on InfinityFree, which only serves real browsers, so the portal can't fetch from it;
 * the IMS pushes instead. Requests are signed: X-IMS-Signature = sha256 HMAC of "<timestamp>.<body>"
 * with the shared IMS_SYNC_KEY, and X-IMS-Timestamp must be within 5 minutes (stops replays).
 *
 * Server-only environment variables (Vercel → Settings → Environment Variables, never VITE_*):
 *   IMS_SYNC_KEY               shared secret, same as PORTAL_SYNC_KEY in the IMS config.php
 *   SUPABASE_URL               falls back to VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  used only here, to call store_ims_snapshot()
 *
 * GET returns a health check that reveals no secrets.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { imsSnapshotSchema } from '../src/services/inventory/imsSnapshot.js';

const MAX_BODY_BYTES = 4_000_000;
const MAX_CLOCK_SKEW_SECONDS = 300;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function config() {
  return {
    key: process.env.IMS_SYNC_KEY ?? '',
    supabaseUrl: (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, ''),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  };
}

export function GET() {
  const c = config();
  return json(200, { ok: true, service: 'ims-sync', configured: Boolean(c.key && c.supabaseUrl && c.serviceKey) });
}

/** Constant-time check of the HMAC signature. */
export function signatureValid(key: string, timestamp: string, body: string, header: string) {
  const expected = createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex');
  const given = header.replace(/^sha256=/, '');
  if (!/^[0-9a-f]{64}$/.test(given)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given, 'hex'));
}

export async function POST(request: Request) {
  const c = config();
  if (!c.key || !c.supabaseUrl || !c.serviceKey) return json(503, { ok: false, error: 'IMS sync is not configured on the portal.' });

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Snapshot too large.' });
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Snapshot too large.' });

  const timestamp = request.headers.get('x-ims-timestamp') ?? '';
  const signature = request.headers.get('x-ims-signature') ?? '';
  const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!/^\d{9,11}$/.test(timestamp) || !(skew <= MAX_CLOCK_SKEW_SECONDS)) return json(401, { ok: false, error: 'Stale or missing timestamp.' });
  if (!signatureValid(c.key, timestamp, body, signature)) return json(401, { ok: false, error: 'Bad signature.' });

  let parsed;
  try {
    parsed = imsSnapshotSchema.safeParse(JSON.parse(body));
  } catch {
    return json(400, { ok: false, error: 'Body is not JSON.' });
  }
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return json(422, { ok: false, error: `Invalid snapshot at ${issue.path.join('.')}: ${issue.message}` });
  }

  const res = await fetch(`${c.supabaseUrl}/rest/v1/rpc/store_ims_snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: c.serviceKey, Authorization: `Bearer ${c.serviceKey}` },
    body: JSON.stringify({ p_generated_at: parsed.data.generated_at, p_payload: parsed.data }),
  });
  if (!res.ok) {
    console.error('[ims-sync] store failed', res.status, await res.text().catch(() => ''));
    return json(502, { ok: false, error: 'Could not store the snapshot.' });
  }
  // false when a newer snapshot was already stored (e.g. two pushes arrived out of order).
  const stored = (await res.json().catch(() => true)) !== false;
  return json(200, {
    ok: true,
    stored,
    items: parsed.data.items.length,
    batches: parsed.data.batches.length,
    movements: parsed.data.movements.length,
  });
}
