/**
 * GET /api/drive/file?id=<document>&kind=thumb|view|download&exp=…&sig=…: a documentation file,
 * fetched from Drive with the PHILRADS connection, for a link made by /api/drive/links.
 * - thumb: a small preview (photos, videos, PDFs: whatever Drive can draw)
 * - view: photos as a large image; videos and PDFs streamed (seeking works: byte ranges are passed on)
 * - download: the original file
 */
import { accessToken, config, connection, drive, json, rest, verify } from '../_drive.js';

export async function GET(request: Request) {
  const c = config();
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  const kind = url.searchParams.get('kind') ?? '';
  const exp = Number(url.searchParams.get('exp'));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['thumb', 'view', 'download'].includes(kind) || !verify(c, `${id}.${kind}.${exp}`, url.searchParams.get('sig') ?? ''))
    return json(403, { error: 'This link isn’t valid.' });
  if (Date.now() / 1000 > exp) return json(410, { error: 'This link has expired. Reload the page.' });

  const [doc] = await rest<{ drive_file_id: string; mime_type: string; file_name: string | null; title: string; removed_at: string | null }[]>(
    c,
    `documents?id=eq.${id}&select=drive_file_id,mime_type,file_name,title,removed_at`,
  );
  if (!doc || doc.removed_at) return json(404, { error: 'This file was removed.' });
  const conn = await connection(c);
  if (!conn) return json(503, { error: 'Google Drive isn’t connected.' });
  const token = await accessToken(c, conn);
  const privately = { 'Cache-Control': 'private, max-age=3600' };

  if (kind === 'thumb' || (kind === 'view' && doc.mime_type.startsWith('image/'))) {
    const meta = await drive<{ thumbnailLink?: string }>(token, `/files/${doc.drive_file_id}?fields=thumbnailLink&supportsAllDrives=true`).catch(() => null);
    if (!meta?.thumbnailLink) return new Response(null, { status: 404, headers: privately });
    const size = kind === 'thumb' ? 's480' : 's2000';
    const img = await fetch(meta.thumbnailLink.replace(/=s\d+(-[a-z0-9-]*)?$/i, `=${size}`), { headers: { Authorization: `Bearer ${token}` } });
    if (!img.ok) return new Response(null, { status: 404, headers: privately });
    return new Response(img.body, { status: 200, headers: { 'Content-Type': img.headers.get('content-type') ?? 'image/jpeg', ...privately } });
  }

  // The file itself, streamed; a Range request (video seeking) is passed straight to Google.
  const range = request.headers.get('range');
  const media = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.drive_file_id}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) },
  });
  if (!media.ok && media.status !== 206) return json(media.status === 404 ? 404 : 502, { error: 'Google Drive didn’t return the file.' });
  const headers: Record<string, string> = { 'Content-Type': doc.mime_type, 'Accept-Ranges': 'bytes', ...privately };
  for (const h of ['content-length', 'content-range']) {
    const v = media.headers.get(h);
    if (v) headers[h] = v;
  }
  const name = (doc.file_name || doc.title).replace(/["\r\n]/g, '');
  headers['Content-Disposition'] = `${kind === 'download' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`;
  return new Response(media.body, { status: media.status, headers });
}
