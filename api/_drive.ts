/**
 * Shared server code for the Documentation module's Google Drive endpoints (/api/drive/*).
 * Files starting with "_" in /api are not deployed as endpoints.
 *
 * How it works:
 * - An administrator connects once: they sign in with the Google account that has Editor access to
 *   the PHILRADS Documentation folder. Google gives a refresh token, which is stored encrypted in
 *   public.drive_connection (server-only table). Nothing secret ever reaches a browser.
 * - Uploads: the server opens a Drive "resumable upload" in <folder>/<uploader>/<category>; the
 *   browser sends the bytes straight to Google (so big videos don't pass through Vercel), then the
 *   server checks the file arrived and writes the documents record.
 * - Previews and downloads go through /api/drive/file with short-lived signed links, so files are
 *   never made public in Drive.
 *
 * Server-only environment variables (Vercel → Settings → Environment Variables, never VITE_*):
 *   SUPABASE_URL (falls back to VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (an OAuth "Web application" client),
 *   GOOGLE_REDIRECT_URI (optional; default <site>/api/drive/callback).
 * The encryption and signing keys are derived from SUPABASE_SERVICE_ROLE_KEY: no extra secret to manage.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function config() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, ''),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
  };
}
export type Config = ReturnType<typeof config>;

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

export const serviceHeaders = (c: Config) => ({ 'Content-Type': 'application/json', apikey: c.serviceKey, Authorization: `Bearer ${c.serviceKey}` });

/** PostgREST call with the service key (server only). */
export async function rest<T = unknown>(c: Config, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${c.supabaseUrl}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders(c), ...(init.headers as Record<string, string>) } });
  if (!res.ok) throw new Error(`Database ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ───────────────────────── Who is calling ─────────────────────────

export interface Caller {
  id: string;
  name: string;
  /** Full name (falls back to the display name): used for their Drive folder. */
  fullName: string;
  roleKey: string;
}

/** The signed-in, active staff member behind the request's bearer token, or null. */
export async function caller(c: Config, request: Request): Promise<Caller | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return null;
  const res = await fetch(`${c.supabaseUrl}/auth/v1/user`, { headers: { apikey: c.serviceKey, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = (await res.json().catch(() => null)) as { id?: string } | null;
  if (!user?.id || !/^[0-9a-f-]{36}$/i.test(user.id)) return null;
  const [p] = await rest<{ role_key: string; is_active: boolean; display_name: string | null; full_name: string | null; archived_at: string | null }[]>(
    c,
    `profiles?id=eq.${user.id}&select=role_key,is_active,display_name,full_name,archived_at`,
  );
  if (!p?.is_active || p.archived_at) return null;
  const name = (p.display_name ?? '').trim() || 'Staff member';
  return { id: user.id, name, fullName: (p.full_name ?? '').trim() || name, roleKey: p.role_key };
}

/** Same rule as has_permission(key) in the database. */
export async function can(c: Config, who: Caller, key: string): Promise<boolean> {
  const rows = await rest<unknown[]>(c, `role_permissions?role_key=eq.${encodeURIComponent(who.roleKey)}&permission_key=eq.${encodeURIComponent(key)}&select=role_key`);
  return rows.length > 0;
}

/** A line in the admin log (the service key may write it; browsers can't). */
export async function log(c: Config, entry: { actor: string | null; action: string; summary: string; metadata?: Record<string, unknown>; audience?: 'everyone' | 'admins' }) {
  await rest(c, 'activity_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ actor_id: entry.actor, module: 'documentation', action: entry.action, summary: entry.summary.slice(0, 300), metadata: entry.metadata ?? {}, audience: entry.audience ?? 'admins' }),
  }).catch(() => undefined);
}

// ───────────────────────── Keys, encryption, signatures ─────────────────────────

const keyFor = (c: Config, purpose: string) => createHmac('sha256', c.serviceKey).update(`philrads-drive-v1:${purpose}`).digest();

export function encrypt(c: Config, text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(c, 'token'), iv);
  const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(c: Config, sealed: string): string {
  const [iv, tag, body] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', keyFor(c, 'token'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

export const sign = (c: Config, payload: string) => createHmac('sha256', keyFor(c, 'sign')).update(payload).digest('base64url');

export function verify(c: Config, payload: string, signature: string): boolean {
  const a = Buffer.from(sign(c, payload));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A Drive folder id from a link like https://drive.google.com/drive/folders/<id>?usp=… or a bare id. */
export function folderIdFrom(input: string): string | null {
  const m = input.trim().match(/folders\/([A-Za-z0-9_-]{10,100})/) ?? input.trim().match(/^([A-Za-z0-9_-]{10,100})$/);
  return m ? m[1] : null;
}

// ───────────────────────── Google ─────────────────────────

export const DRIVE = 'https://www.googleapis.com/drive/v3';
export const SCOPES = 'openid email https://www.googleapis.com/auth/drive';

export interface Connection {
  google_email: string;
  folder_id: string;
  folder_name: string | null;
  refresh_token_enc: string;
}

export async function connection(c: Config): Promise<Connection | null> {
  const [row] = await rest<Connection[]>(c, 'drive_connection?id=eq.1&select=google_email,folder_id,folder_name,refresh_token_enc');
  return row ?? null;
}

let cached: { token: string; until: number; for: string } | null = null;

/** A short-lived Google access token from the stored refresh token (kept for this instance). */
export async function accessToken(c: Config, conn: Connection): Promise<string> {
  if (cached && cached.for === conn.refresh_token_enc && cached.until > Date.now() + 60_000) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: decrypt(c, conn.refresh_token_enc), grant_type: 'refresh_token' }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    await noteError(c, `Google refused the saved connection (${body.error ?? res.status}). An administrator needs to connect Google Drive again.`);
    throw new DriveConnectionError();
  }
  cached = { token: body.access_token, until: Date.now() + (body.expires_in ?? 3000) * 1000, for: conn.refresh_token_enc };
  return body.access_token;
}

export class DriveConnectionError extends Error {
  constructor() {
    super('The Google Drive connection stopped working. An administrator needs to connect it again on the Documentation page.');
  }
}

export async function noteError(c: Config, message: string) {
  await rest(c, 'drive_connection?id=eq.1', {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_error: message.slice(0, 300), last_error_at: new Date().toISOString() }),
  }).catch(() => undefined);
}

/** A Drive API call; throws with Google's message on failure. */
export async function drive<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path.startsWith('http') ? path : `${DRIVE}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers as Record<string, string>) } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`Google Drive ${res.status}: ${body.error?.message ?? res.statusText}`);
  }
  return (await res.json()) as T;
}

const FOLDER = 'application/vnd.google-apps.folder';
/** Drive accepts almost any name; keep folder names tidy and free of slashes. */
export const folderName = (name: string) => name.replace(/[\\/]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Other';
const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

type TagKey = 'philradsStaffId' | 'philradsCategory' | 'philradsDay';
interface FolderRow {
  folder_id: string | null;
  name: string | null;
  claimed_at: string;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rowPath = (parent: string, tagKey: TagKey, tagValue: string) =>
  `drive_folders?parent_id=eq.${encodeURIComponent(parent)}&tag_key=eq.${tagKey}&tag_value=eq.${encodeURIComponent(tagValue)}`;

/** Every folder in `parent` tagged with this key and value, oldest first (Drive's search; can lag a few seconds). */
async function findTagged(token: string, parent: string, tagKey: TagKey, tagValue: string) {
  const query = `'${q(parent)}' in parents and mimeType = '${FOLDER}' and trashed = false and appProperties has { key='${tagKey}' and value='${q(tagValue)}' }`;
  const found = await drive<{ files: { id: string; name: string }[] }>(
    token,
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=createdTime&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=100`,
  );
  return found.files;
}

/**
 * Folds `dup` into `keep`: its files move across; a tagged sub-folder that `keep` also has is
 * folded in the same way, any other moves across whole. Then `dup` goes to Drive's trash. Records
 * that pointed at `dup` are pointed at `keep`.
 */
async function mergeInto(c: Config, token: string, keep: string, dup: string): Promise<void> {
  const children = await drive<{ files: { id: string; mimeType: string; appProperties?: Record<string, string> }[] }>(
    token,
    `/files?q=${encodeURIComponent(`'${q(dup)}' in parents and trashed = false`)}&fields=files(id,mimeType,appProperties)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  );
  for (const child of children.files) {
    const tag = (['philradsStaffId', 'philradsCategory', 'philradsDay'] as TagKey[]).find((k) => child.appProperties?.[k]);
    if (child.mimeType === FOLDER && tag) {
      const twin = (await findTagged(token, keep, tag, child.appProperties![tag]))[0];
      if (twin) {
        await mergeInto(c, token, twin.id, child.id);
        continue;
      }
    }
    await drive(token, `/files/${child.id}?addParents=${keep}&removeParents=${dup}&supportsAllDrives=true&fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  }
  await drive(token, `/files/${dup}?supportsAllDrives=true&fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }).catch(() => undefined);
  await rest(c, `documents?drive_folder_id=eq.${encodeURIComponent(dup)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ drive_folder_id: keep }) }).catch(() => undefined);
  await rest(c, `drive_folders?parent_id=eq.${encodeURIComponent(dup)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => undefined);
}

/**
 * The one folder in `parent` for this person, category or day: from the portal's own list first
 * (public.drive_folders), so it is never made twice. The first upload to need it claims it in the
 * list, then adopts the folder if Drive already has it (folding any duplicates from before into
 * the oldest) or makes it; uploads at the same moment wait for that and use the same folder.
 */
export async function folderFor(c: Config, token: string, parent: string, tagKey: TagKey, tagValue: string, name: string): Promise<string> {
  const path = rowPath(parent, tagKey, tagValue);
  const [known] = await rest<FolderRow[]>(c, `${path}&select=folder_id,name,claimed_at`);
  if (known?.folder_id) {
    if (known.name !== name) {
      // e.g. a staff member's new display name: rename their folder to match.
      await drive(token, `/files/${known.folder_id}?supportsAllDrives=true&fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).catch(() => undefined);
      await rest(c, path, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ name }) }).catch(() => undefined);
    }
    return known.folder_id;
  }

  // Claim it (only one upload can), or take over a claim left behind by an upload that failed.
  let mine = false;
  if (!known) {
    const claimed = await rest<FolderRow[]>(c, 'drive_folders?on_conflict=parent_id,tag_key,tag_value', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ parent_id: parent, tag_key: tagKey, tag_value: tagValue, name }),
    });
    mine = claimed.length > 0;
  } else if (Date.now() - Date.parse(known.claimed_at) > 60_000) {
    const taken = await rest<FolderRow[]>(c, `${path}&folder_id=is.null&claimed_at=eq.${encodeURIComponent(known.claimed_at)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ claimed_at: new Date().toISOString() }),
    });
    mine = taken.length > 0;
  }

  if (!mine) {
    // Someone else is making it right now: wait for it.
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const [row] = await rest<FolderRow[]>(c, `${path}&select=folder_id`);
      if (row?.folder_id) return row.folder_id;
    }
    throw new Error('Timed out waiting for the Drive folder to be made. Try again.');
  }

  try {
    const existing = await findTagged(token, parent, tagKey, tagValue);
    let id: string;
    if (existing.length) {
      id = existing[0].id;
      for (const dup of existing.slice(1)) await mergeInto(c, token, id, dup.id);
      if (existing[0].name !== name)
        await drive(token, `/files/${id}?supportsAllDrives=true&fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).catch(() => undefined);
    } else {
      id = (
        await drive<{ id: string }>(token, '/files?supportsAllDrives=true&fields=id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent], appProperties: { [tagKey]: tagValue } }),
        })
      ).id;
    }
    await rest(c, path, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ folder_id: id, name }) });
    return id;
  } catch (e) {
    // Let the next upload try again.
    await rest(c, `${path}&folder_id=is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => undefined);
    throw e;
  }
}

/** Forget folders the portal made (e.g. someone deleted them in Drive), so they're made again. */
export async function forgetFolders(c: Config, ids: string[]): Promise<void> {
  const list = ids.filter(Boolean).map((id) => `"${id}"`).join(',');
  if (list) await rest(c, `drive_folders?folder_id=in.(${list})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => undefined);
}

/** Today in Manila (YYYY-MM-DD), the day folder an upload goes into. */
export const manilaDay = (d = new Date()) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);

/** The site's own address (for Google's redirect and for upload CORS). */
export function siteOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? url.host;
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${proto}://${host}`;
}
