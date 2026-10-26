import { useEffect, useId, useState } from 'react';
import { Download, FileText, Loader2, Pencil, Trash2 } from 'lucide-react';
import { formatBytes, formatDateTime, formatShortDate } from '../../lib/format';
import type { DocFile, DocLinks, DocPatch } from '../../services/documentation/documentationService';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '../../types';
import { Sheet } from '../ui/Sheet';
import type { TagOption } from './UploadSheet';

interface Props {
  doc: DocFile;
  links: DocLinks | undefined;
  canEdit: boolean;
  events: TagOption[];
  places: TagOption[];
  onClose: () => void;
  /** Resolve to an error message, or null when saved. */
  onSave: (patch: DocPatch) => Promise<string | null>;
  onRemove: () => Promise<string | null>;
}

/** One file: a large preview (photo, playable video, readable PDF), its details, download, and corrections. */
export function DocViewer({ doc, links, canEdit, events, places, onClose, onSave, onRemove }: Props) {
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: doc.title, category: doc.category, notes: doc.notes ?? '', takenOn: doc.takenOn ?? '', eventId: doc.imsEventId ?? '' });
  useEffect(() => {
    setEditing(false);
    setError(null);
    setDraft({ title: doc.title, category: doc.category, notes: doc.notes ?? '', takenOn: doc.takenOn ?? '', eventId: doc.imsEventId ?? '' });
  }, [doc]);

  const isImage = doc.mimeType.startsWith('image/');
  const isVideo = doc.mimeType.startsWith('video/');
  const isPdf = doc.mimeType === 'application/pdf';
  const place = places.find((p) => p.id === doc.mapPlaceId);

  const save = async () => {
    if (!draft.title.trim()) return setError('Give it a title.');
    setBusy('save');
    setError(null);
    const event = events.find((e) => e.id === draft.eventId);
    const err = await onSave({
      title: draft.title.trim(),
      category: draft.category,
      notes: draft.notes.trim() || null,
      takenOn: draft.takenOn || null,
      imsEventId: draft.eventId ? (event?.id ?? doc.imsEventId) : null,
      imsEventName: draft.eventId ? (event?.name ?? doc.imsEventName) : null,
    });
    setBusy(null);
    if (err) setError(err);
    else setEditing(false);
  };

  const remove = async () => {
    if (!window.confirm(`Remove “${doc.title}” from the portal? The file stays in Google Drive.`)) return;
    setBusy('remove');
    const err = await onRemove();
    setBusy(null);
    if (err) setError(err);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      dirty={editing}
      title={doc.title}
      subtitle={`${doc.category} · ${doc.uploadedByName}`}
      footer={
        <div className="flex gap-2">
          {canEdit && !editing && (
            <>
              <button type="button" className="btn-ghost px-3 text-status-out" onClick={() => void remove()} disabled={Boolean(busy)} title="Remove from the portal">
                {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                <span className="sr-only">Remove from the portal</span>
              </button>
              <button type="button" className="btn-ghost px-3" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </button>
            </>
          )}
          {editing ? (
            <>
              <button type="button" className="btn-ghost px-4" onClick={() => setEditing(false)} disabled={Boolean(busy)}>
                Cancel
              </button>
              <button type="button" className="btn-primary h-12 flex-1" onClick={() => void save()} disabled={Boolean(busy)}>
                {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save
              </button>
            </>
          ) : (
            <a className={`btn-primary h-12 flex-1 ${links ? '' : 'pointer-events-none opacity-50'}`} href={links?.download} download={doc.fileName ?? doc.title}>
              <Download className="h-4 w-4" aria-hidden /> Download
            </a>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <div className="overflow-hidden rounded-2xl bg-black/40">
          {!links ? (
            <div className="skeleton aspect-[4/3] w-full !rounded-none" aria-label="Loading the preview" />
          ) : isImage ? (
            <img src={links.view} alt={doc.title} className="max-h-[60vh] w-full object-contain" />
          ) : isVideo ? (
            <video src={links.view} controls preload="metadata" playsInline className="max-h-[60vh] w-full" poster={links.thumb} />
          ) : isPdf ? (
            <iframe src={links.view} title={doc.title} className="h-[60vh] w-full bg-white" />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
              <FileText className="h-10 w-10" aria-hidden />
              No preview for this kind of file. Download it to open it.
            </div>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5" htmlFor={`${uid}-title`}>
              <span className="text-sm font-semibold text-ink-soft">Title</span>
              <input id={`${uid}-title`} className="field" maxLength={200} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            </label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What it is">
              {DOCUMENT_CATEGORIES.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={draft.category === c} onClick={() => setDraft((d) => ({ ...d, category: c as DocumentCategory }))}>
                  {c}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5" htmlFor={`${uid}-taken`}>
                <span className="text-sm font-semibold text-ink-soft">Taken or written on</span>
                <input id={`${uid}-taken`} type="date" className="field" value={draft.takenOn} onChange={(e) => setDraft((d) => ({ ...d, takenOn: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5" htmlFor={`${uid}-event`}>
                <span className="text-sm font-semibold text-ink-soft">Response</span>
                <select id={`${uid}-event`} className="field" value={draft.eventId} onChange={(e) => setDraft((d) => ({ ...d, eventId: e.target.value }))}>
                  <option value="">Not for a response</option>
                  {doc.imsEventId && !events.some((e) => e.id === doc.imsEventId) && <option value={doc.imsEventId}>{doc.imsEventName ?? 'Earlier response'}</option>}
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1.5" htmlFor={`${uid}-notes`}>
              <span className="text-sm font-semibold text-ink-soft">Notes</span>
              <textarea id={`${uid}-notes`} className="field min-h-20" rows={3} maxLength={1000} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
            </label>
          </div>
        ) : (
          <>
            {doc.notes && <p className="rounded-xl border border-line/70 px-4 py-3 text-sm text-ink-soft">{doc.notes}</p>}
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Uploaded by</dt>
              <dd>{doc.uploadedByName}</dd>
              <dt className="text-muted">Uploaded</dt>
              <dd>{formatDateTime(doc.uploadedAt)}</dd>
              {doc.takenOn && (
                <>
                  <dt className="text-muted">Taken on</dt>
                  <dd>{formatShortDate(doc.takenOn)}</dd>
                </>
              )}
              {doc.imsEventName && (
                <>
                  <dt className="text-muted">Response</dt>
                  <dd>{doc.imsEventName}</dd>
                </>
              )}
              {place && (
                <>
                  <dt className="text-muted">Place</dt>
                  <dd>{place.name}</dd>
                </>
              )}
              {doc.sizeBytes != null && (
                <>
                  <dt className="text-muted">Size</dt>
                  <dd>
                    {formatBytes(doc.sizeBytes)}
                    {doc.width && doc.height ? ` · ${doc.width} × ${doc.height}` : ''}
                  </dd>
                </>
              )}
              {doc.drivePath && (
                <>
                  <dt className="text-muted">In Google Drive</dt>
                  <dd className="break-words">{doc.drivePath.split('/').join(' › ')}</dd>
                </>
              )}
            </dl>
          </>
        )}
      </div>
    </Sheet>
  );
}
