/**
 * Resources: browse a shared Google Drive folder inside the portal, through the PHILRADS
 * Drive connection.
 *
 *   POST /api/drive/folder { resource, folder? }   what's in a folder resource (or a folder inside
 *        it), with 2-hour links to each file's thumbnail, view and download. Staff with
 *        resources.read only, and only folders that sit inside a folder resource.
 *   GET  /api/drive/folder?r=&id=&kind=thumb|view|download&exp=&sig=   one of those files, for a
 *        link made by the POST (Google Docs, Sheets and Slides come as Word, Excel and PowerPoint).
 *
 * One endpoint for both: the Hobby plan allows 12 functions.
 */
import { accessToken, caller, can, config, connection, drive, json, rest, sign, verify, type Config } from '../_drive.js';

const FOLDER = 'application/vnd.google-apps.folder';
const GOOGLE_ID = /^[A-Za-z0-9_-]{10,}$/;
const UUID = /^[0-9a-f-]{36}$/i;
/** Google files have no bytes of their own: they're exported. */
const EXPORT: Record<string, [string, string]> = {
  'application/vnd.google-apps.document': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  'application/vnd.google-apps.spreadsheet': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
  'application/vnd.google-apps.presentation': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx'],
  'application/vnd.google-apps.drawing': ['application/pdf', '.pdf'],
};

/** The Drive folder a resource points to, if it's an active folder resource. */
async function rootOf(c: Config, resourceId: string): Promise<string | null> {
  const [r] = await rest<{ url: string; kind: string; is_active: boolean }[]>(c, `resources?id=eq.${resourceId}&select=url,kind,is_active`);
  if (!r?.is_active || r.kind !== 'drive_folder') return null;
  const id = r.url.match(/\/folders\/([A-Za-z0-9_-]{10,})/)?.[1];
  return id ?? null;
}

interface Meta {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}
const metaOf = (token: string, id: string, fields = 'id,name,mimeType,parents') => drive<Meta>(token, `/files/${id}?fields=${fields}&supportsAllDrives=true`);

/** The folders from the resource's root down to `folder`, or null if it isn't inside it. */
async function pathTo(token: string, root: string, folder: string): Promise<{ id: string; name: string }[] | null> {
  const path: { id: string; name: string }[] = [];
  let id: string | undefined = folder;
  for (let depth = 0; id && depth < 15; depth++) {
    const m = await metaOf(token, id);
    path.unshift({ id: m.id, name: m.name });
    if (m.id === root) return path;
    id = m.parents?.[0];
  }
  return null;
}

export async function POST(request: Request) {
  const c = config();
  const who = await caller(c, request);
  if (!who) return json(401, { error: 'Sign in again, then try once more.' });
  if (!(await can(c, who, 'resources.read'))) return json(403, { error: 'Your role doesn’t include Resources.' });
  const b = (await request.json().catch(() => ({}))) as { resource?: unknown; folder?: unknown };
  const resource = typeof b.resource === 'string' && UUID.test(b.resource) ? b.resource : null;
  const asked = typeof b.folder === 'string' && GOOGLE_ID.test(b.folder) ? b.folder : null;
  if (!resource) return json(400, { error: 'Which resource?' });

  const root = await rootOf(c, resource);
  if (!root) return json(404, { error: 'This resource isn’t a Google Drive folder (any more).' });
  const conn = await connection(c);
  if (!conn) return json(503, { error: 'Google Drive isn’t connected yet.' });
  const token = await accessToken(c, conn);

  const folder = asked ?? root;
  let path: { id: string; name: string }[] | null;
  try {
    path = await pathTo(token, root, folder);
  } catch {
    return json(403, {
      error: `The portal’s Google account (${conn.google_email}) can’t open this folder. Share the folder with it as a Viewer, then try again.`,
      shareWith: conn.google_email,
    });
  }
  if (!path) return json(403, { error: 'That folder isn’t part of this resource.' });

  type File = {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    hasThumbnail?: boolean;
    videoMediaMetadata?: { durationMillis?: string };
    imageMediaMetadata?: { width?: number; height?: number };
  };
  const files: File[] = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({
      q: `'${folder}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,hasThumbnail,videoMediaMetadata(durationMillis),imageMediaMetadata(width,height))',
      orderBy: 'folder,name_natural',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      ...(pageToken ? { pageToken } : {}),
    });
    const r = await drive<{ files?: File[]; nextPageToken?: string }>(token, `/files?${q}`);
    files.push(...(r.files ?? []));
    if (!r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }

  const exp = Math.floor(Date.now() / 1000) + 2 * 3600;
  const link = (id: string, kind: string) => `/api/drive/folder?${new URLSearchParams({ r: resource, id, kind, exp: String(exp), sig: sign(c, `folder.${resource}.${id}.${kind}.${exp}`) })}`;
  return json(200, {
    path,
    items: files.map((f) => {
      const isFolder = f.mimeType === FOLDER;
      const exported = EXPORT[f.mimeType];
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        folder: isFolder,
        sizeBytes: f.size ? Number(f.size) : null,
        modifiedAt: f.modifiedTime ?? null,
        durationMs: f.videoMediaMetadata?.durationMillis ? Number(f.videoMediaMetadata.durationMillis) : null,
        width: f.imageMediaMetadata?.width ?? null,
        height: f.imageMediaMetadata?.height ?? null,
        // Google Docs, Sheets and Slides download as Word, Excel and PowerPoint.
        downloadAs: exported ? exported[1] : null,
        links: isFolder
          ? null
          : { thumb: f.hasThumbnail ? link(f.id, 'thumb') : null, view: link(f.id, 'view'), download: link(f.id, 'download') },
      };
    }),
  });
}

export async function GET(request: Request) {
  const c = config();
  const url = new URL(request.url);
  const r = url.searchParams.get('r') ?? '';
  const id = url.searchParams.get('id') ?? '';
  const kind = url.searchParams.get('kind') ?? '';
  const exp = Number(url.searchParams.get('exp'));
  if (!UUID.test(r) || !GOOGLE_ID.test(id) || !['thumb', 'view', 'download'].includes(kind) || !verify(c, `folder.${r}.${id}.${kind}.${exp}`, url.searchParams.get('sig') ?? ''))
    return json(403, { error: 'This link isn’t valid.' });
  if (Date.now() / 1000 > exp) return json(410, { error: 'This link has expired. Open the folder again.' });
  if (!(await rootOf(c, r))) return json(404, { error: 'This resource was removed.' });
  const conn = await connection(c);
  if (!conn) return json(503, { error: 'Google Drive isn’t connected.' });
  const token = await accessToken(c, conn);
  const privately = { 'Cache-Control': 'private, max-age=3600' };

  const meta = await drive<{ name: string; mimeType: string; thumbnailLink?: string }>(token, `/files/${id}?fields=name,mimeType,thumbnailLink&supportsAllDrives=true`).catch(() => null);
  if (!meta) return json(404, { error: 'This file isn’t there any more.' });

  if (kind === 'thumb' || (kind === 'view' && meta.mimeType.startsWith('image/'))) {
    if (!meta.thumbnailLink) return new Response(null, { status: 404, headers: privately });
    const size = kind === 'thumb' ? 's480' : 's2000';
    const img = await fetch(meta.thumbnailLink.replace(/=s\d+(-[a-z0-9-]*)?$/i, `=${size}`), { headers: { Authorization: `Bearer ${token}` } });
    if (!img.ok) return new Response(null, { status: 404, headers: privately });
    return new Response(img.body, { status: 200, headers: { 'Content-Type': img.headers.get('content-type') ?? 'image/jpeg', ...privately } });
  }

  const exported = EXPORT[meta.mimeType];
  const range = request.headers.get('range');
  const media = exported
    ? await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exported[0])}`, { headers: { Authorization: `Bearer ${token}` } })
    : await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) } });
  if (!media.ok && media.status !== 206) return json(media.status === 404 ? 404 : 502, { error: 'Google Drive didn’t return the file.' });
  const headers: Record<string, string> = { 'Content-Type': exported ? exported[0] : meta.mimeType, ...privately };
  if (!exported) headers['Accept-Ranges'] = 'bytes';
  for (const h of ['content-length', 'content-range']) {
    const v = media.headers.get(h);
    if (v) headers[h] = v;
  }
  const name = (exported && !meta.name.toLowerCase().endsWith(exported[1]) ? meta.name + exported[1] : meta.name).replace(/["\r\n]/g, '');
  headers['Content-Disposition'] = `${kind === 'download' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`;
  return new Response(media.body, { status: media.status, headers });
}
