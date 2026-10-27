/**
 * POST /api/drive/delete: delete documentation files, in the portal and in Google Drive.
 * Body: { ids: [documentId, …] } (up to 200). Administrators (documents.manage) can delete any;
 * others only their own uploads. Each file is moved to Google Drive's trash (recoverable there for
 * 30 days), then its record is marked deleted (removed_reason 'portal'). Returns
 * { deleted, failed: [{ id, error }] }.
 */
import { accessToken, caller, can, config, connection, drive, json, rest } from '../_drive.js';

interface Doc {
  id: string;
  title: string;
  uploaded_by: string | null;
  drive_file_id: string;
  removed_at: string | null;
}

export async function POST(request: Request) {
  const c = config();
  const who = await caller(c, request);
  if (!who) return json(401, { error: 'Sign in again, then try once more.' });
  const b = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(b.ids) ? [...new Set(b.ids.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 200) : [];
  if (!ids.length) return json(400, { error: 'Choose the files to delete.' });

  const admin = await can(c, who, 'documents.manage');
  const docs = await rest<Doc[]>(c, `documents?id=in.(${ids.join(',')})&select=id,title,uploaded_by,drive_file_id,removed_at`);
  const allowed = docs.filter((d) => !d.removed_at && (admin || d.uploaded_by === who.id));
  const failed: { id: string; error: string }[] = docs
    .filter((d) => !d.removed_at && !allowed.includes(d))
    .map((d) => ({ id: d.id, error: 'Only the person who uploaded it, or an administrator, can delete it.' }));
  if (!allowed.length) return json(failed.length ? 403 : 404, { deleted: 0, failed, error: failed[0]?.error ?? 'Those files are already gone.' });

  const conn = await connection(c);
  if (!conn) return json(503, { error: 'Google Drive isn’t connected, so files can’t be deleted there. Tell an administrator.' });
  const token = await accessToken(c, conn);

  const done: string[] = [];
  for (const d of allowed) {
    try {
      await drive(token, `/files/${d.drive_file_id}?supportsAllDrives=true&fields=id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      });
      done.push(d.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Already gone from Drive: just take it out of the portal.
      if (/ 404:/.test(message)) done.push(d.id);
      else failed.push({ id: d.id, error: /403/.test(message) ? 'Google Drive didn’t allow it (the file may belong to someone else).' : 'Google Drive didn’t respond. Try again.' });
    }
  }
  if (done.length)
    await rest(c, `documents?id=in.(${done.join(',')})&removed_at=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ removed_at: new Date().toISOString(), removed_by: who.id, removed_reason: 'portal' }),
    });
  return json(200, { deleted: done.length, failed });
}
