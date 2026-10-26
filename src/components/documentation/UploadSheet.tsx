import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FileText, Film, ImagePlus, Upload, X } from 'lucide-react';
import { formatBytes } from '../../lib/format';
import { categoryFor, titleFor, type UploadMeta } from '../../services/documentation/documentationService';
import { UPLOAD_RULES, validateUploadFile } from '../../services/googleDrive';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '../../types';
import { Sheet } from '../ui/Sheet';

export interface TagOption {
  id: string;
  name: string;
}

interface Picked {
  key: string;
  file: File;
  title: string;
  preview: string | null;
  error: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUpload: (entries: { file: File; meta: UploadMeta }[]) => void;
  events: TagOption[];
  places: TagOption[];
  today: string;
}

/** Choose photos, videos or reports, give each a title, say what they are, and send them to Google Drive. */
export function UploadSheet({ open, onClose, onUpload, events, places, today }: Props) {
  const uid = useId();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [category, setCategory] = useState<DocumentCategory>('Photos');
  const [takenOn, setTakenOn] = useState(today);
  const [eventId, setEventId] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [notes, setNotes] = useState('');

  // Previews made for this visit, freed when the sheet closes (or the page goes away).
  const previews = useRef<string[]>([]);
  useEffect(() => {
    if (open) return;
    previews.current.forEach((u) => URL.revokeObjectURL(u));
    previews.current = [];
  }, [open]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Start fresh each time.
  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setCategory('Photos');
    setTakenOn(today);
    setEventId('');
    setPlaceId('');
    setNotes('');
  }, [open, today]);

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...files].map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      title: titleFor(file.name),
      preview: file.type.startsWith('image/') ? (previews.current[previews.current.push(URL.createObjectURL(file)) - 1] ?? null) : null,
      error: validateUploadFile(file),
    }));
    // The first pick sets a sensible category (photos, videos, reports).
    if (!picked.length) setCategory(categoryFor(next[0].file.type));
    setPicked((p) => [...p, ...next]);
  };

  const ok = picked.filter((p) => !p.error);
  const total = useMemo(() => ok.reduce((s, p) => s + p.file.size, 0), [ok]);
  const submit = () => {
    if (!ok.length) return;
    const event = events.find((e) => e.id === eventId);
    onUpload(
      ok.map((p) => ({
        file: p.file,
        meta: { title: p.title.trim() || titleFor(p.file.name), category, notes: notes.trim(), takenOn: takenOn || null, imsEventId: event?.id ?? null, imsEventName: event?.name ?? null, mapPlaceId: placeId || null },
      })),
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={picked.length > 0}
      title="Upload documentation"
      subtitle="Photos, videos and reports from the field. They’re saved to the PHILRADS Google Drive."
      footer={
        <button type="button" className="btn-primary h-12 w-full text-base" onClick={submit} disabled={!ok.length}>
          <Upload className="h-5 w-5" aria-hidden />
          {ok.length ? `Upload ${ok.length} file${ok.length === 1 ? '' : 's'} (${formatBytes(total)})` : 'Choose files first'}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <input ref={input} type="file" multiple accept={UPLOAD_RULES.accept} className="sr-only" onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="tap flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-6 text-center transition hover:border-uplift/60 hover:bg-uplift/[0.04]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            add(e.dataTransfer.files);
          }}
        >
          <ImagePlus className="h-7 w-7 text-uplift" aria-hidden />
          <span className="text-sm font-semibold">{picked.length ? 'Add more files' : 'Choose photos, videos or files'}</span>
          <span className="text-xs text-muted">From your phone’s gallery or camera, or drag them here. Up to 2 GB each.</span>
        </button>

        {picked.length > 0 && (
          <ul className="flex flex-col gap-2">
            {picked.map((p) => (
              <li key={p.key} className={`flex items-start gap-3 rounded-xl border p-2 ${p.error ? 'border-status-out/50 bg-status-out/5' : 'border-line/70'}`}>
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sunken">
                  {p.preview ? (
                    <img src={p.preview} alt="" className="h-full w-full object-cover" />
                  ) : p.file.type.startsWith('video/') ? (
                    <Film className="h-6 w-6 text-muted" aria-hidden />
                  ) : (
                    <FileText className="h-6 w-6 text-muted" aria-hidden />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <input
                    className="field py-2"
                    aria-label={`Title for ${p.file.name}`}
                    value={p.title}
                    maxLength={200}
                    disabled={Boolean(p.error)}
                    onChange={(e) => setPicked((list) => list.map((x) => (x.key === p.key ? { ...x, title: e.target.value } : x)))}
                  />
                  <span className={`truncate text-[0.6875rem] ${p.error ? 'text-status-out' : 'text-muted'}`}>{p.error ?? `${p.file.name} · ${formatBytes(p.file.size)}`}</span>
                </span>
                <button type="button" className="icon-btn h-9 w-9 shrink-0" aria-label={`Leave out ${p.file.name}`} onClick={() => setPicked((list) => list.filter((x) => x.key !== p.key))}>
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-ink-soft">What are they?</legend>
          <div className="flex flex-wrap gap-2">
            {DOCUMENT_CATEGORIES.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5" htmlFor={`${uid}-taken`}>
            <span className="text-sm font-semibold text-ink-soft">Taken or written on</span>
            <input id={`${uid}-taken`} type="date" className="field" value={takenOn} max={today} onChange={(e) => setTakenOn(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5" htmlFor={`${uid}-event`}>
            <span className="text-sm font-semibold text-ink-soft">For which response?</span>
            <select id={`${uid}-event`} className="field" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Not for a response</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2" htmlFor={`${uid}-place`}>
            <span className="text-sm font-semibold text-ink-soft">Where? (a place on the Live Map)</span>
            <select id={`${uid}-place`} className="field" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
              <option value="">Not tied to a place</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5" htmlFor={`${uid}-notes`}>
          <span className="flex items-baseline justify-between text-sm font-semibold text-ink-soft">
            Notes <span className="text-xs font-normal text-muted">Optional, for all of them</span>
          </span>
          <textarea id={`${uid}-notes`} className="field min-h-20" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 120 families served before noon" />
        </label>
      </div>
    </Sheet>
  );
}
