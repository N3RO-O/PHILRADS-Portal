import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataSource, DocumentCategory } from '../../types';

/**
 * Documentation: field photos, videos and reports. Files live in the PHILRADS Google Drive folder
 * (<folder>/<uploader>/<category>); the portal keeps a record of each, visible to every active
 * staff member. Uploads go from the browser straight to Google in pieces (big videos too); the
 * server opens and checks each one (api/drive/*). See supabase/migrations/20261028000100_documentation.sql.
 */

export interface DocFile {
  id: string;
  title: string;
  category: DocumentCategory;
  notes: string | null;
  fileName: string | null;
  mimeType: string;
  sizeBytes: number | null;
  /** YYYY-MM-DD: when it was taken or written. */
  takenOn: string | null;
  imsEventId: string | null;
  imsEventName: string | null;
  mapPlaceId: string | null;
  uploadedById: string | null;
  uploadedByName: string;
  uploadedAt: string;
  drivePath: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

/** Short-lived addresses to see a file (made by the server; files stay private in Drive). */
export interface DocLinks {
  thumb: string;
  view: string;
  download: string;
}

export interface DriveStatus {
  connected: boolean;
  googleEmail: string | null;
  folderId: string | null;
  folderName: string | null;
  connectedAt: string | null;
  /** The connection stopped working (e.g. access removed): an administrator connects again. */
  lastError: string | null;
}

export interface UploadMeta {
  title: string;
  category: DocumentCategory;
  notes: string;
  takenOn: string | null;
  imsEventId: string | null;
  imsEventName: string | null;
  mapPlaceId: string | null;
}

export type DocPatch = Partial<Pick<DocFile, 'title' | 'category' | 'notes' | 'takenOn' | 'imsEventId' | 'imsEventName' | 'mapPlaceId'>>;

export interface UploadOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface DocumentationService {
  readonly source: DataSource;
  list(): Promise<DocFile[]>;
  links(ids: string[]): Promise<Record<string, DocLinks>>;
  status(): Promise<DriveStatus>;
  /** Administrators: where to send the browser to connect Google Drive (that folder). */
  connectUrl(folder: string): Promise<string>;
  /** Resolves to the new record's id. */
  upload(file: File, meta: UploadMeta, options?: UploadOptions): Promise<string>;
  update(id: string, patch: DocPatch): Promise<void>;
  /** Off the portal; the file stays in Drive. */
  remove(id: string): Promise<void>;
}

/** The folder PHILRADS chose for Documentation (2026-10-28); an administrator can change it when connecting. */
export const DEFAULT_DRIVE_FOLDER = 'https://drive.google.com/drive/folders/1gXtyek05YP_57rsPYzRIUcqpCCg1N-_l';

export class DocRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocRuleError';
  }
}

/** A sensible category for a file from its type. */
export const categoryFor = (mime: string): DocumentCategory => (mime.startsWith('image/') ? 'Photos' : mime.startsWith('video/') ? 'Videos' : mime === 'application/pdf' ? 'Reports' : 'Other');

/** "IMG_0042.jpg" → "IMG 0042": a starting title the uploader can change. */
export const titleFor = (fileName: string) => fileName.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_]+/g, ' ').trim().slice(0, 200) || 'Untitled';

// ───────────────────────── Supabase + Drive ─────────────────────────

const COLUMNS =
  'id, title, category, notes, file_name, mime_type, size_bytes, taken_on, ims_event_id, ims_event_name, map_place_id, uploaded_by, uploaded_at, drive_path, width, height, duration_ms, uploader:profiles!documents_uploaded_by_fkey(display_name)';

/** Pieces sent to Google: a multiple of 256 KiB, small enough to retry quickly on a weak signal. */
const CHUNK = 8 * 1024 * 1024;

export function createSupabaseDocumentationService(client: SupabaseClient): DocumentationService {
  const token = async () => (await client.auth.getSession()).data.session?.access_token ?? '';
  const api = async <T>(path: string, body?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(`/api/drive/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify(body ?? {}),
      });
    } catch {
      throw new Error('No connection. Check the signal and try again.');
    }
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new DocRuleError(data.error ?? `The server said no (${res.status}).`);
    return data;
  };

  const map = (r: Record<string, unknown>): DocFile => ({
    id: r.id as string,
    title: r.title as string,
    category: r.category as DocumentCategory,
    notes: (r.notes as string | null) ?? null,
    fileName: (r.file_name as string | null) ?? null,
    mimeType: r.mime_type as string,
    sizeBytes: r.size_bytes == null ? null : Number(r.size_bytes),
    takenOn: (r.taken_on as string | null) ?? null,
    imsEventId: (r.ims_event_id as string | null) ?? null,
    imsEventName: (r.ims_event_name as string | null) ?? null,
    mapPlaceId: (r.map_place_id as string | null) ?? null,
    uploadedById: (r.uploaded_by as string | null) ?? null,
    uploadedByName: ((r.uploader as { display_name?: string } | null)?.display_name ?? '').trim() || 'Someone',
    uploadedAt: r.uploaded_at as string,
    drivePath: (r.drive_path as string | null) ?? null,
    width: (r.width as number | null) ?? null,
    height: (r.height as number | null) ?? null,
    durationMs: r.duration_ms == null ? null : Number(r.duration_ms),
  });

  /** One piece to Google, with progress. Resolves to Google's answer: 308 (more please) or the finished file. */
  const putChunk = (url: string, blob: Blob, start: number, total: number, onBytes: (n: number) => void, signal?: AbortSignal) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Range', `bytes ${start}-${start + blob.size - 1}/${total}`);
      xhr.upload.onprogress = (e) => onBytes(e.loaded);
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
      xhr.onerror = () => reject(new Error('network'));
      xhr.onabort = () => reject(new DOMException('Cancelled', 'AbortError'));
      signal?.addEventListener('abort', () => xhr.abort(), { once: true });
      xhr.send(blob);
    });

  /** How much Google already has (after a dropped connection): ask with an empty piece. */
  const received = async (url: string, total: number): Promise<number | 'done'> => {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Range': `bytes */${total}` } }).catch(() => null);
    if (!res) throw new Error('network');
    if (res.status === 200 || res.status === 201) return 'done';
    const range = res.headers.get('range');
    return range ? Number(range.split('-')[1]) + 1 : 0;
  };

  return {
    source: 'supabase',
    async list() {
      const { data, error } = await client.from('documents').select(COLUMNS).eq('module', 'documentation').is('removed_at', null).order('uploaded_at', { ascending: false }).limit(2000);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => map(r as Record<string, unknown>));
    },
    async links(ids) {
      if (!ids.length) return {};
      return (await api<{ links: Record<string, DocLinks> }>('links', { ids })).links;
    },
    async status() {
      const { data, error } = await client.rpc('drive_status');
      if (error) throw new Error(error.message);
      const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
      return {
        connected: Boolean(r?.connected),
        googleEmail: (r?.google_email as string | null) ?? null,
        folderId: (r?.folder_id as string | null) ?? null,
        folderName: (r?.folder_name as string | null) ?? null,
        connectedAt: (r?.connected_at as string | null) ?? null,
        lastError: (r?.last_error as string | null) ?? null,
      };
    },
    async connectUrl(folder) {
      return (await api<{ url: string }>('connect', { folder })).url;
    },
    async upload(file, meta, options = {}) {
      const { sessionId, uploadUrl } = await api<{ sessionId: string; uploadUrl: string }>('upload', {
        ...meta,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      let offset = 0;
      let fileId: string | null = null;
      let failures = 0;
      while (!fileId) {
        if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        const end = Math.min(offset + CHUNK, file.size);
        try {
          const r = await putChunk(uploadUrl, file.slice(offset, end), offset, file.size, (n) => options.onProgress?.((offset + n) / file.size), options.signal);
          if (r.status === 200 || r.status === 201) fileId = (JSON.parse(r.body) as { id: string }).id;
          else if (r.status === 308) offset = end;
          else throw new Error(`google ${r.status}`);
          failures = 0;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e;
          // Weak signal: wait, ask Google how much it has, and carry on from there.
          if (++failures > 6) throw new Error('The connection kept dropping. Try again with a better signal.');
          await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** failures)));
          const have = await received(uploadUrl, file.size).catch(() => offset);
          if (have === 'done') {
            // Finished on Google's side but the answer was lost: the server finds the file.
            const done = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes */${file.size}` } });
            fileId = ((await done.json().catch(() => ({}))) as { id?: string }).id ?? null;
            if (!fileId) throw new Error('The upload finished but Google didn’t say where. Try again.');
          } else offset = have;
        }
      }
      options.onProgress?.(1);
      return (await api<{ documentId: string }>('complete', { sessionId, fileId })).documentId;
    },
    async update(id, p) {
      const row: Record<string, unknown> = {};
      if ('title' in p) row.title = p.title?.trim();
      if ('category' in p) row.category = p.category;
      if ('notes' in p) row.notes = p.notes?.trim() || null;
      if ('takenOn' in p) row.taken_on = p.takenOn;
      if ('imsEventId' in p) row.ims_event_id = p.imsEventId;
      if ('imsEventName' in p) row.ims_event_name = p.imsEventName;
      if ('mapPlaceId' in p) row.map_place_id = p.mapPlaceId;
      const { error } = await client.from('documents').update(row).eq('id', id);
      if (error) throw new DocRuleError(error.code === '42501' ? 'Only the person who uploaded it, or an administrator, can change it.' : error.message);
    },
    async remove(id) {
      const { error } = await client.rpc('remove_document', { p_id: id });
      if (error) throw new DocRuleError(error.message);
    },
  };
}

// ───────────────────────── Sample data ─────────────────────────

/** A coloured placeholder picture for sample files (no real photos in demo mode). */
function samplePicture(hue: number, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,38%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},50%,18%)"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/><circle cx="380" cy="90" r="38" fill="hsla(45,90%,70%,.55)"/><path d="M0 300 L120 190 L210 260 L300 170 L480 310 L480 360 L0 360Z" fill="hsla(0,0%,0%,.35)"/><text x="24" y="336" font-family="sans-serif" font-size="22" fill="rgba(255,255,255,.75)">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** A time `daysAgo` days back at about `hour` o'clock, never in the future. */
const day = (daysAgo: number, hour = 10) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  d.setHours(hour, (daysAgo * 17) % 60, 0, 0);
  return new Date(Math.min(d.getTime(), Date.now() - 5 * 60_000)).toISOString();
};

type SampleSeed = { title: string; category: string; mime: string; by: string; ago: number; hue: number; event: string | null; duration?: number };
const SEEDS: SampleSeed[] = [
  { title: 'Food packs handed out, Brgy. 12 covered court', category: 'Photos', mime: 'image/jpeg', by: 'Maria Santos', ago: 0, hue: 28, event: 'Typhoon Kristine response' },
  { title: 'Families queueing for hygiene kits', category: 'Photos', mime: 'image/jpeg', by: 'Jun Dela Cruz', ago: 0, hue: 200, event: 'Typhoon Kristine response' },
  { title: 'Distribution walk-through', category: 'Videos', mime: 'video/mp4', by: 'Maria Santos', ago: 1, hue: 260, event: 'Typhoon Kristine response', duration: 94_000 },
  { title: 'Situation report, day 5', category: 'Reports', mime: 'application/pdf', by: 'Ana Reyes', ago: 1, hue: 0, event: 'Typhoon Kristine response' },
  { title: 'Signed attendance sheet, Purok 3', category: 'Distribution records', mime: 'image/jpeg', by: 'Leo Mendoza', ago: 2, hue: 140, event: 'Typhoon Kristine response' },
  { title: 'Rapid needs assessment, Barangay San Roque', category: 'Assessments', mime: 'application/pdf', by: 'Ana Reyes', ago: 3, hue: 0, event: null },
  { title: 'Warehouse stock check', category: 'Photos', mime: 'image/jpeg', by: 'Jun Dela Cruz', ago: 4, hue: 90, event: null },
  { title: 'Water containers unloaded', category: 'Photos', mime: 'image/jpeg', by: 'Leo Mendoza', ago: 6, hue: 180, event: null },
];
const SAMPLE: (DocFile & { picture?: string })[] = SEEDS.map((s, i) => ({
  id: `sample-doc-${i + 1}`,
  title: s.title,
  category: s.category as DocumentCategory,
  notes: i === 0 ? '120 families served before noon; 30 packs left for the afternoon.' : null,
  fileName: `${titleFor(s.title).replace(/\s+/g, '_').slice(0, 30)}.${s.mime === 'application/pdf' ? 'pdf' : s.mime === 'video/mp4' ? 'mp4' : 'jpg'}`,
  mimeType: s.mime,
  sizeBytes: s.mime === 'video/mp4' ? 48_200_000 : s.mime === 'application/pdf' ? 820_000 : 2_400_000,
  takenOn: day(s.ago).slice(0, 10),
  imsEventId: s.event ? 'sample-event-1' : null,
  imsEventName: s.event,
  mapPlaceId: null,
  uploadedById: null,
  uploadedByName: s.by,
  uploadedAt: day(s.ago, 9 + i),
  drivePath: `Documentation/${s.by}/${s.category}/${day(s.ago).slice(0, 10)}`,
  width: s.mime.startsWith('image') ? 4032 : null,
  height: s.mime.startsWith('image') ? 3024 : null,
  durationMs: s.duration ?? null,
  picture: s.mime === 'application/pdf' ? undefined : samplePicture(s.hue, s.category),
}));

const sampleState = { files: [...SAMPLE], connected: true, extra: new Map<string, string>() };

export const mockDocumentationService: DocumentationService = {
  source: 'mock',
  async list() {
    await new Promise((r) => setTimeout(r, 300));
    return sampleState.files.map(({ picture: _p, ...f }) => f as DocFile);
  },
  async links(ids) {
    return Object.fromEntries(
      ids.map((id) => {
        const f = sampleState.files.find((x) => x.id === id);
        const pic = sampleState.extra.get(id) ?? f?.picture ?? '';
        return [id, { thumb: pic, view: pic, download: pic }];
      }),
    );
  },
  async status() {
    return { connected: sampleState.connected, googleEmail: 'info.philrads@gmail.com', folderId: '1gXtyek05YP_57rsPYzRIUcqpCCg1N-_l', folderName: 'Documentation', connectedAt: day(3), lastError: null };
  },
  async connectUrl() {
    throw new DocRuleError('In sample mode Google Drive is pretend-connected already.');
  },
  async upload(file, meta, options = {}) {
    // Pretend progress, a bit slower for bigger files.
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      await new Promise((r) => setTimeout(r, Math.min(250, 40 + file.size / 2e6)));
      options.onProgress?.(i / steps);
    }
    const id = `sample-doc-${Date.now()}`;
    const url = URL.createObjectURL(file);
    sampleState.extra.set(id, url);
    sampleState.files.unshift({
      id,
      ...meta,
      notes: meta.notes || null,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedById: 'demo',
      uploadedByName: 'Demo User',
      uploadedAt: new Date().toISOString(),
      drivePath: `Documentation/Demo User/${meta.category}/${new Date().toISOString().slice(0, 10)}`,
      width: null,
      height: null,
      durationMs: null,
      picture: url,
    });
    return id;
  },
  async update(id, p) {
    sampleState.files = sampleState.files.map((f) => (f.id === id ? { ...f, ...p } : f));
  },
  async remove(id) {
    sampleState.files = sampleState.files.filter((f) => f.id !== id);
  },
};

// ───────────────────────── Upload queue ─────────────────────────

export interface QueuedUpload {
  key: string;
  file: File;
  meta: UploadMeta;
  progress: number;
  status: 'waiting' | 'uploading' | 'done' | 'failed' | 'cancelled';
  error: string | null;
  documentId: string | null;
}

/**
 * Uploads in progress, kept outside the page so they carry on while staff look around the portal.
 * Two at a time; each can be cancelled or retried.
 */
export function createUploadQueue(service: DocumentationService) {
  let items: QueuedUpload[] = [];
  const controllers = new Map<string, AbortController>();
  const listeners = new Set<(items: QueuedUpload[]) => void>();
  const emit = () => listeners.forEach((l) => l(items));
  const patch = (key: string, p: Partial<QueuedUpload>) => {
    items = items.map((i) => (i.key === key ? { ...i, ...p } : i));
    emit();
  };

  const pump = () => {
    while (items.filter((i) => i.status === 'uploading').length < 2) {
      const next = items.find((i) => i.status === 'waiting');
      if (!next) return;
      const ctl = new AbortController();
      controllers.set(next.key, ctl);
      patch(next.key, { status: 'uploading', progress: 0, error: null });
      let last = 0;
      service
        .upload(next.file, next.meta, {
          signal: ctl.signal,
          onProgress: (f) => {
            // Redraw at most every 2%.
            if (f - last >= 0.02 || f === 1) {
              last = f;
              patch(next.key, { progress: f });
            }
          },
        })
        .then((documentId) => patch(next.key, { status: 'done', progress: 1, documentId }))
        .catch((e: unknown) =>
          patch(next.key, e instanceof DOMException && e.name === 'AbortError' ? { status: 'cancelled' } : { status: 'failed', error: e instanceof Error ? e.message : 'The upload failed.' }),
        )
        .finally(() => {
          controllers.delete(next.key);
          pump();
        });
    }
  };

  return {
    add(entries: { file: File; meta: UploadMeta }[]) {
      items = [...items, ...entries.map((e) => ({ key: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, ...e, progress: 0, status: 'waiting' as const, error: null, documentId: null }))];
      emit();
      pump();
    },
    cancel(key: string) {
      const it = items.find((i) => i.key === key);
      if (it?.status === 'waiting') patch(key, { status: 'cancelled' });
      controllers.get(key)?.abort();
    },
    retry(key: string) {
      patch(key, { status: 'waiting', error: null, progress: 0 });
      pump();
    },
    clearFinished() {
      items = items.filter((i) => i.status === 'uploading' || i.status === 'waiting' || i.status === 'failed');
      emit();
    },
    busy: () => items.some((i) => i.status === 'uploading' || i.status === 'waiting'),
    items: () => items,
    subscribe(fn: (items: QueuedUpload[]) => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

export type UploadQueue = ReturnType<typeof createUploadQueue>;
