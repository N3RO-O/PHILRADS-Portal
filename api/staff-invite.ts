/**
 * POST /api/staff-invite: an administrator invites someone to the portal by email (Staff page).
 *
 * Supabase sends the invitation email (custom SMTP). The link opens the portal, which asks the
 * person to choose a password. The account is switched on straight away with the chosen role,
 * so they can work as soon as they have a password. Inviting someone whose invitation is still
 * pending sends it again.
 *
 * The caller must send their own session token (Authorization: Bearer <access token>) and have
 * staff.manage; this is checked here, server-side, because inviting needs the service key.
 *
 * Server-only environment variables (Vercel → Settings → Environment Variables, never VITE_*):
 *   SUPABASE_URL               falls back to VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  used only on the server
 *
 * GET returns a health check that reveals no secrets.
 */
import { z } from 'zod';

const ROLE_LABELS = { admin: 'Administrator', coordinator: 'Coordinator', staff: 'Staff', volunteer: 'Volunteer', viewer: 'Viewer' } as const;

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  fullName: z.string().trim().max(120).optional().default(''),
  roleKey: z.enum(['admin', 'coordinator', 'staff', 'volunteer', 'viewer']),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function config() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, ''),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  };
}
type Config = ReturnType<typeof config>;

const serviceHeaders = (c: Config) => ({ 'Content-Type': 'application/json', apikey: c.serviceKey, Authorization: `Bearer ${c.serviceKey}` });

export function GET() {
  const c = config();
  return json(200, { ok: true, service: 'staff-invite', configured: Boolean(c.supabaseUrl && c.serviceKey) });
}

/** The signed-in caller's user id, or null if the token is missing, expired or forged. */
async function callerId(c: Config, token: string): Promise<string | null> {
  const res = await fetch(`${c.supabaseUrl}/auth/v1/user`, { headers: { apikey: c.serviceKey, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = (await res.json().catch(() => null)) as { id?: string } | null;
  return user?.id ?? null;
}

/** Same rule as has_permission('staff.manage'): an active profile whose role grants it. */
async function canManageStaff(c: Config, uid: string): Promise<boolean> {
  const profile = await fetch(`${c.supabaseUrl}/rest/v1/profiles?id=eq.${uid}&select=role_key,is_active`, { headers: serviceHeaders(c) });
  const [p] = profile.ok ? ((await profile.json()) as { role_key: string; is_active: boolean }[]) : [];
  if (!p?.is_active) return false;
  const grant = await fetch(
    `${c.supabaseUrl}/rest/v1/role_permissions?role_key=eq.${encodeURIComponent(p.role_key)}&permission_key=eq.staff.manage&select=role_key`,
    { headers: serviceHeaders(c) },
  );
  return grant.ok && ((await grant.json()) as unknown[]).length > 0;
}

export async function POST(request: Request) {
  const c = config();
  if (!c.supabaseUrl || !c.serviceKey) return json(503, { ok: false, error: 'Inviting is not configured on the portal.' });

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const uid = token ? await callerId(c, token) : null;
  if (!uid) return json(401, { ok: false, error: 'Sign in again, then try once more.' });
  if (!(await canManageStaff(c, uid))) return json(403, { ok: false, error: 'Only administrators can invite staff.' });

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return json(400, { ok: false, error: 'Body is not JSON.' });
  }
  if (!parsed.success) return json(422, { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the details.' });
  const { email, fullName, roleKey } = parsed.data;

  // The invitation link returns to the portal the administrator is using.
  const redirectTo = new URL(request.url).origin;
  const invite = await fetch(`${c.supabaseUrl}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    headers: serviceHeaders(c),
    body: JSON.stringify({ email, data: fullName ? { full_name: fullName } : {} }),
  });
  if (!invite.ok) {
    const detail = (await invite.json().catch(() => ({}))) as { error_code?: string; msg?: string; message?: string };
    if (invite.status === 422 || detail.error_code === 'email_exists') {
      return json(409, { ok: false, error: `${email} already has a portal account. Find them in the list to change their role.` });
    }
    console.error('[staff-invite] invite failed', invite.status, detail);
    return json(502, { ok: false, error: 'The invitation email could not be sent. Try again in a few minutes.' });
  }
  const user = (await invite.json()) as { id: string };

  // Switch the account on with the chosen role (the service key passes guard_profile_privileges).
  const patch = await fetch(`${c.supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'PATCH',
    headers: { ...serviceHeaders(c), Prefer: 'return=minimal' },
    body: JSON.stringify({ role_key: roleKey, is_active: true, ...(fullName ? { full_name: fullName } : {}) }),
  });
  if (!patch.ok) {
    console.error('[staff-invite] activate failed', patch.status, await patch.text().catch(() => ''));
    return json(502, { ok: false, error: 'The invitation was sent, but the role could not be set. Set it in the list.' });
  }

  await fetch(`${c.supabaseUrl}/rest/v1/activity_logs`, {
    method: 'POST',
    headers: { ...serviceHeaders(c), Prefer: 'return=minimal' },
    body: JSON.stringify({
      actor_id: uid,
      module: 'system',
      action: 'staff.invited',
      entity_type: 'profile',
      entity_id: user.id,
      summary: `Invited ${fullName || email} as ${ROLE_LABELS[roleKey]}`,
      metadata: { email, role: roleKey },
    }),
  }).catch((e) => console.error('[staff-invite] log failed', e));

  return json(200, { ok: true, id: user.id, email, roleKey });
}
