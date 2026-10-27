/**
 * POST /api/drive/complete: the browser finished sending a file to Google.
 * Body: { sessionId, fileId }. Checks the file really is in Drive, in the folder this upload was
 * opened for, with the expected size, then writes the documents record (with the uploader from the
 * session that opened it) and returns it. Calling it twice returns the same record.
 */
import { accessToken, caller, config, connection, drive, json, rest } from '../_drive.js';

interface Session {
  id: string;
  user_id: string;
  title: string;
  category: string;
  notes: string | null;
  taken_on: string | null;
  ims_event_id: string | null;
  ims_event_name: string | null;
  map_place_id: string | null;
  project_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  folder_id: string;
  drive_path: string;
  document_id: string | null;
}

export async function POST(request: Request) {
  const c = config();
  const who = await caller(c, request);
  if (!who) return json(401, { error: 'Sign in again, then try once more.' });
  const b = (await request.json().catch(() => ({}))) as { sessionId?: string; fileId?: string };
  if (!b.sessionId || !/^[0-9a-f-]{36}$/i.test(b.sessionId) || !b.fileId || !/^[A-Za-z0-9_-]{10,200}$/.test(b.fileId)) return json(400, { error: 'Missing upload details.' });

  const [s] = await rest<Session[]>(c, `drive_upload_sessions?id=eq.${b.sessionId}&user_id=eq.${who.id}&select=*`);
  if (!s) return json(404, { error: 'That upload wasn’t found. Upload the file again.' });
  if (s.document_id) return json(200, { documentId: s.document_id });

  const conn = await connection(c);
  if (!conn) return json(503, { error: 'Google Drive isn’t connected.' });
  const token = await accessToken(c, conn);
  const f = await drive<{ id: string; name: string; mimeType: string; size?: string; parents?: string[]; appProperties?: Record<string, string>; imageMediaMetadata?: { width?: number; height?: number }; videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string } }>(
    token,
    `/files/${b.fileId}?fields=id,name,mimeType,size,parents,appProperties,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis)&supportsAllDrives=true`,
  ).catch(() => null);
  if (!f || !f.parents?.includes(s.folder_id) || f.appProperties?.philradsSession !== s.id) return json(409, { error: 'The file didn’t arrive in Google Drive. Upload it again.' });
  if (Number(f.size ?? -1) !== Number(s.size_bytes)) return json(409, { error: 'Only part of the file arrived. Upload it again.' });

  const media = f.imageMediaMetadata ?? f.videoMediaMetadata;
  const [doc] = await rest<{ id: string }[]>(c, 'documents', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      title: s.title,
      category: s.category,
      module: 'documentation',
      mime_type: f.mimeType || s.mime_type,
      size_bytes: Number(f.size ?? s.size_bytes),
      drive_file_id: f.id,
      drive_folder_id: s.folder_id,
      drive_path: s.drive_path,
      file_name: f.name,
      notes: s.notes,
      taken_on: s.taken_on,
      ims_event_id: s.ims_event_id,
      ims_event_name: s.ims_event_name,
      map_place_id: s.map_place_id,
      project_id: s.project_id,
      width: media?.width ?? null,
      height: media?.height ?? null,
      duration_ms: f.videoMediaMetadata?.durationMillis ? Number(f.videoMediaMetadata.durationMillis) : null,
      uploaded_by: s.user_id,
    }),
  });
  await rest(c, `drive_upload_sessions?id=eq.${s.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ completed_at: new Date().toISOString(), document_id: doc.id }),
  });
  return json(200, { documentId: doc.id });
}
