/**
 * POST /api/drive/upload: opens an upload for one file (documents.upload).
 * Body: { title, category, notes?, takenOn?, imsEventId?, imsEventName?, mapPlaceId?, fileName, mimeType, sizeBytes }.
 * Files it into <Documentation folder>/<uploader's name>/<category> (folders made as needed; the
 * uploader comes from the session, never from the browser) and returns { sessionId, uploadUrl }:
 * a one-time Google address the browser sends the bytes to directly, in pieces, with progress.
 * When Google has the whole file, the browser calls /api/drive/complete.
 */
import { z } from 'zod';
import { accessToken, caller, can, childFolder, config, connection, DriveConnectionError, folderName, json, noteError, rest, siteOrigin } from '../_drive.js';

const CATEGORIES = ['Photos', 'Videos', 'Reports', 'Assessments', 'Distribution records', 'Contracts and agreements', 'Other'] as const;
const MAX_BYTES = 2 * 1024 ** 3;
const OK_TYPES = /^(image\/|video\/|application\/pdf$|application\/msword$|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)$|application\/vnd\.ms-excel$)/;

const body = z.object({
  title: z.string().trim().min(1, 'Give the file a title.').max(200),
  category: z.enum(CATEGORIES),
  notes: z.string().trim().max(1000).optional().default(''),
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  imsEventId: z.string().trim().max(64).optional().nullable(),
  imsEventName: z.string().trim().max(200).optional().nullable(),
  mapPlaceId: z.string().uuid().optional().nullable(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().regex(OK_TYPES, 'This file type is not accepted. Use photos, videos, PDF, Word, Excel or PowerPoint files.'),
  sizeBytes: z.number().int().positive().max(MAX_BYTES, 'This file is larger than the 2 GB limit.'),
});

export async function POST(request: Request) {
  const c = config();
  const who = await caller(c, request);
  if (!who) return json(401, { error: 'Sign in again, then try once more.' });
  if (!(await can(c, who, 'documents.upload'))) return json(403, { error: 'Your role can’t upload documentation.' });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: parsed.error.issues[0]?.message ?? 'Check the file details.' });
  const m = parsed.data;

  const conn = await connection(c);
  if (!conn) return json(503, { error: 'Google Drive isn’t connected yet. An administrator connects it on the Documentation page.' });
  try {
    const token = await accessToken(c, conn);
    // <folder> / <uploader> / <category>: the person's folder is found by their staff id, so a
    // renamed account keeps (and renames) its folder, and two people with one name never share.
    const personFolder = await childFolder(token, conn.folder_id, 'philradsStaffId', who.id, folderName(who.name));
    const categoryFolder = await childFolder(token, personFolder, 'philradsCategory', m.category, folderName(m.category));
    const drivePath = [conn.folder_name ?? 'Documentation', folderName(who.name), folderName(m.category)].join('/');

    const [session] = await rest<{ id: string }[]>(c, 'drive_upload_sessions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: who.id,
        title: m.title,
        category: m.category,
        notes: m.notes || null,
        taken_on: m.takenOn ?? null,
        ims_event_id: m.imsEventId || null,
        ims_event_name: m.imsEventName || null,
        map_place_id: m.mapPlaceId || null,
        file_name: m.fileName,
        mime_type: m.mimeType,
        size_bytes: m.sizeBytes,
        folder_id: categoryFolder,
        drive_path: drivePath,
      }),
    });

    // Google lets the browser at this Origin send the bytes to the session address.
    const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,mimeType', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': m.mimeType,
        'X-Upload-Content-Length': String(m.sizeBytes),
        Origin: request.headers.get('origin') ?? siteOrigin(request),
      },
      body: JSON.stringify({
        name: m.fileName,
        parents: [categoryFolder],
        description: [m.title, m.notes].filter(Boolean).join('\n\n'),
        appProperties: { philradsSession: session.id, philradsStaffId: who.id },
      }),
    });
    const uploadUrl = init.headers.get('location');
    if (!init.ok || !uploadUrl) throw new Error(`Google Drive ${init.status}: ${(await init.text()).slice(0, 200)}`);
    return json(200, { sessionId: session.id, uploadUrl, drivePath });
  } catch (e) {
    if (e instanceof DriveConnectionError) return json(503, { error: e.message });
    const message = e instanceof Error ? e.message : String(e);
    console.error('[drive upload]', message);
    if (/insufficient|permission|403|404/i.test(message)) {
      await noteError(c, `Can’t add files to the Documentation folder (${message.slice(0, 120)}). Check that ${conn.google_email} is still an Editor.`);
      return json(502, { error: 'Google Drive refused the upload: the connected account may no longer be an Editor of the folder. Tell an administrator.' });
    }
    if (/storageQuota|quota/i.test(message)) return json(507, { error: 'The connected Google Drive is full. Tell an administrator.' });
    return json(502, { error: 'Google Drive didn’t respond. Check the connection and try again.' });
  }
}
