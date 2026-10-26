/**
 * GET /api/drive/callback: Google returns here after the administrator signs in (see connect.ts).
 * Checks the signed state, trades the code for tokens, makes sure that Google account can add files
 * to the chosen folder, then saves the connection (refresh token encrypted) and goes back to the
 * Documentation page with ?drive=connected (or ?drive=error&reason=…).
 */
import { config, drive, encrypt, log, rest, siteOrigin, verify } from '../_drive.js';

export async function GET(request: Request) {
  const c = config();
  const site = siteOrigin(request);
  const back = (params: Record<string, string>) => Response.redirect(`${site}/documentation?${new URLSearchParams(params)}`, 302);
  const url = new URL(request.url);
  if (url.searchParams.get('error')) return back({ drive: 'error', reason: 'Google sign-in was cancelled.' });

  const [payload, signature] = (url.searchParams.get('state') ?? '').split('.');
  if (!payload || !signature || !verify(c, payload, signature)) return back({ drive: 'error', reason: 'That sign-in link isn’t valid. Start again from the Documentation page.' });
  const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid: string; folder: string; exp: number };
  if (Date.now() > state.exp) return back({ drive: 'error', reason: 'That took more than 10 minutes. Start again from the Documentation page.' });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: url.searchParams.get('code') ?? '',
      client_id: c.clientId,
      client_secret: c.clientSecret,
      redirect_uri: c.redirectUri || `${site}/api/drive/callback`,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; scope?: string };
  if (!tokenRes.ok || !tokens.access_token) return back({ drive: 'error', reason: 'Google didn’t accept the sign-in. Try again.' });
  if (!tokens.refresh_token) return back({ drive: 'error', reason: 'Google didn’t give lasting access. Try again and tick every permission Google asks for.' });
  if (!tokens.scope?.includes('auth/drive')) return back({ drive: 'error', reason: 'Drive access wasn’t allowed. Try again and tick “See, edit, create and delete all of your Google Drive files”.' });

  const me = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const email = ((await me.json().catch(() => ({}))) as { email?: string }).email ?? 'unknown';

  // The account must be able to add files to the folder (Editor, or the owner).
  let folder: { name: string; capabilities?: { canAddChildren?: boolean } };
  try {
    folder = await drive(tokens.access_token, `/files/${state.folder}?fields=name,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`);
  } catch {
    return back({ drive: 'error', reason: `${email} can’t open that folder. Ask its owner to share it with ${email} as Editor, then connect again.` });
  }
  if (!folder.capabilities?.canAddChildren)
    return back({ drive: 'error', reason: `${email} can only view “${folder.name}”. Ask its owner to make ${email} an Editor, then connect again.` });

  await rest(c, 'drive_connection', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: 1,
      google_email: email,
      folder_id: state.folder,
      folder_name: folder.name,
      refresh_token_enc: encrypt(c, tokens.refresh_token),
      connected_by: state.uid,
      connected_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
    }),
  });
  await log(c, { actor: state.uid, action: 'drive.connected', summary: `Google Drive connected: ${email}, folder “${folder.name}”`, metadata: { email, folder: state.folder } });
  return back({ drive: 'connected' });
}
