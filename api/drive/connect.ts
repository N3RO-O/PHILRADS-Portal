/**
 * POST /api/drive/connect: an administrator (staff.manage) starts connecting Google Drive.
 * Body: { folder: "<Drive folder link or id>" }. Returns { url } to send the browser to Google,
 * where they sign in with the account that has Editor access to that folder. Google then returns
 * to /api/drive/callback, which saves the connection.
 *
 * GET: a health check that reveals no secrets.
 */
import { caller, can, config, folderIdFrom, json, SCOPES, sign, siteOrigin } from '../_drive.js';

export function GET() {
  const c = config();
  return json(200, { ok: true, service: 'drive-connect', configured: Boolean(c.supabaseUrl && c.serviceKey && c.clientId && c.clientSecret) });
}

export async function POST(request: Request) {
  const c = config();
  if (!c.supabaseUrl || !c.serviceKey) return json(500, { error: 'The server is missing its Supabase settings.' });
  if (!c.clientId || !c.clientSecret) return json(503, { error: 'Google sign-in isn’t set up on the server yet (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel).' });
  const who = await caller(c, request);
  if (!who) return json(401, { error: 'Sign in again, then try once more.' });
  if (!(await can(c, who, 'staff.manage'))) return json(403, { error: 'Only administrators can connect Google Drive.' });

  const body = (await request.json().catch(() => ({}))) as { folder?: string };
  const folderId = folderIdFrom(String(body.folder ?? ''));
  if (!folderId) return json(400, { error: 'Paste the link to the Google Drive folder (it looks like drive.google.com/drive/folders/…).' });

  // Who asked, for which folder, valid for 10 minutes, signed so it can't be altered on the way back.
  const payload = Buffer.from(JSON.stringify({ uid: who.id, folder: folderId, exp: Date.now() + 10 * 60_000 })).toString('base64url');
  const state = `${payload}.${sign(c, payload)}`;
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri || `${siteOrigin(request)}/api/drive/callback`,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    // Always ask, so Google always returns a refresh token.
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state,
  });
  return json(200, { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}
