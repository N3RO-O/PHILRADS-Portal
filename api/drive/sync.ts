/**
 * /api/drive/sync: files deleted in Google Drive leave the portal too.
 * - GET: run by Vercel Cron once a day (vercel.json).
 * - POST: when someone opens Documentation (any signed-in staff member).
 * Runs at most once a minute. Reads Drive's change list from where it last stopped
 * (drive_connection.changes_page_token); a documentation file that was deleted or put in the trash
 * there is marked deleted in the portal (removed_reason 'drive'). The first run checks every file once.
 * Returns { removed }.
 */
import { accessToken, caller, config, connection, drive, json, rest, type Config } from '../_drive.js';

interface Changes {
  nextPageToken?: string;
  newStartPageToken?: string;
  changes: { fileId?: string; removed?: boolean; file?: { trashed?: boolean } }[];
}

async function run(c: Config): Promise<Response> {
  const conn = await connection(c);
  if (!conn) return json(200, { removed: 0, skipped: 'not connected' });
  // Claim this run: only one at a time, at most once a minute.
  const since = new Date(Date.now() - 60_000).toISOString();
  const claimed = await rest<{ changes_page_token: string | null }[]>(
    c,
    `drive_connection?id=eq.1&or=(changes_synced_at.is.null,changes_synced_at.lt.${encodeURIComponent(since)})`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ changes_synced_at: new Date().toISOString() }) },
  );
  if (!claimed.length) return json(200, { removed: 0, skipped: 'ran recently' });

  const token = await accessToken(c, conn);
  const gone = new Set<string>();
  let pageToken = claimed[0].changes_page_token;

  if (!pageToken) {
    // First run: start following changes from now, and check every file the portal knows once.
    pageToken = (await drive<{ startPageToken: string }>(token, '/changes/startPageToken?supportsAllDrives=true')).startPageToken;
    const docs = await rest<{ drive_file_id: string }[]>(c, 'documents?removed_at=is.null&select=drive_file_id&limit=2000');
    for (const d of docs) {
      const f = await drive<{ trashed?: boolean }>(token, `/files/${d.drive_file_id}?fields=trashed&supportsAllDrives=true`).catch((e: Error) =>
        / 404:/.test(e.message) ? { trashed: true } : null,
      );
      if (f?.trashed) gone.add(d.drive_file_id);
    }
  } else {
    for (let page = 0; page < 20 && pageToken; page++) {
      const r: Changes = await drive<Changes>(
        token,
        `/changes?pageToken=${encodeURIComponent(pageToken)}&includeRemoved=true&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1000&fields=nextPageToken,newStartPageToken,changes(fileId,removed,file(trashed))`,
      );
      for (const ch of r.changes) if (ch.fileId && (ch.removed || ch.file?.trashed)) gone.add(ch.fileId);
      if (r.newStartPageToken) {
        pageToken = r.newStartPageToken;
        break;
      }
      pageToken = r.nextPageToken ?? pageToken;
    }
  }

  let removed = 0;
  const ids = [...gone];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100).map((id) => `"${id}"`).join(',');
    const rows = await rest<{ id: string }[]>(c, `documents?drive_file_id=in.(${batch})&removed_at=is.null&select=id`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ removed_at: new Date().toISOString(), removed_reason: 'drive' }),
    });
    removed += rows.length;
  }
  await rest(c, 'drive_connection?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ changes_page_token: pageToken }) });
  return json(200, { removed });
}

export async function GET(request: Request) {
  const c = config();
  // Vercel Cron sends the CRON_SECRET when one is set; without one, the once-a-minute limit applies.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return json(401, { error: 'Not allowed.' });
  return run(c).catch((e: Error) => json(502, { error: e.message.slice(0, 200) }));
}

export async function POST(request: Request) {
  const c = config();
  if (!(await caller(c, request))) return json(401, { error: 'Sign in again, then try once more.' });
  return run(c).catch((e: Error) => json(502, { error: e.message.slice(0, 200) }));
}
