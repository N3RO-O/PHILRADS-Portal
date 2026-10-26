/**
 * POST /api/drive/links: short-lived links (2 hours) to see documentation files, for any active
 * staff member. Body: { ids: [documentId, …] } (up to 200). Returns
 * { links: { [id]: { thumb, view, download } } } pointing at /api/drive/file, which checks the
 * signature. Files themselves stay private in Drive.
 */
import { caller, config, json, sign } from '../_drive.js';

export async function POST(request: Request) {
  const c = config();
  const who = await caller(c, request);
  if (!who) return json(401, { error: 'Sign in again, then try once more.' });
  const b = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200) : [];
  const exp = Math.floor(Date.now() / 1000) + 2 * 3600;
  const link = (id: string, kind: string) => `/api/drive/file?${new URLSearchParams({ id, kind, exp: String(exp), sig: sign(c, `${id}.${kind}.${exp}`) })}`;
  return json(200, { links: Object.fromEntries(ids.map((id) => [id, { thumb: link(id, 'thumb'), view: link(id, 'view'), download: link(id, 'download') }])) });
}
