import { useEffect, useRef, useState } from 'react';
import { Camera, Link2, Loader2, Plus, X } from 'lucide-react';
import type { OutputDraft } from '../../services/tasks/staffBoard';
import type { Task } from '../../services/tasks/types';
import { Sheet } from '../ui/Sheet';
import { SuccessTick } from '../ui/SuccessTick';

const MAX_PHOTOS = 4;

/** A photo made small enough to send (longest side 1280 px, JPEG). */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = bad;
      i.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    let q = 0.75;
    let out = c.toDataURL('image/jpeg', q);
    while (out.length > 450_000 && q > 0.35) out = c.toDataURL('image/jpeg', (q -= 0.1));
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Finishing a task someone gave you: say what you did, if you like (a note, links, photos), and
 * the person who gave it is told. Finishing without an output is fine too.
 */
export function FinishSheet({ task, onClose, onFinish }: { task: Task | null; onClose: () => void; onFinish: (t: Task, output: OutputDraft | null) => Promise<string | null> }) {
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState<'photo' | 'send' | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!task) return;
    setNote('');
    setLink('');
    setLinks([]);
    setPhotos([]);
    setDone(false);
    setError(null);
  }, [task]);

  const addLink = () => {
    let l = link.trim();
    if (!l) return;
    if (!/^https?:\/\//i.test(l)) l = `https://${l}`;
    try {
      new URL(l);
    } catch {
      setError('That doesn’t look like a link.');
      return;
    }
    setLinks((ls) => [...ls, l].slice(0, 10));
    setLink('');
    setError(null);
  };
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('photo');
    try {
      const room = MAX_PHOTOS - photos.length;
      const shrunk = await Promise.all([...files].slice(0, room).map(shrink));
      setPhotos((p) => [...p, ...shrunk].slice(0, MAX_PHOTOS));
    } catch {
      setError('That picture couldn’t be read. Try another one.');
    } finally {
      setBusy(null);
    }
  };

  const finish = async () => {
    if (!task || busy) return;
    const pending = link.trim() ? [...links, /^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`] : links;
    const output = note.trim() || pending.length || photos.length ? { note, links: pending, photos } : null;
    setBusy('send');
    setError(null);
    const err = await onFinish(task, output);
    setBusy(null);
    if (err) return setError(err);
    setDone(true);
    setTimeout(onClose, 1100);
  };

  const given = task?.createdByName;
  return (
    <Sheet
      open={Boolean(task)}
      onClose={onClose}
      title={done ? 'Finished!' : 'Finish task'}
      subtitle={task ? `“${task.title}”` : undefined}
      footer={
        !done && (
          <button type="button" className="btn-primary h-12 w-full text-base" onClick={() => void finish()} disabled={Boolean(busy)}>
            {busy === 'send' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            {note.trim() || links.length || photos.length || link.trim() ? 'Finish and send' : 'Finish'}
          </button>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <SuccessTick className="h-20 w-20 text-status-in" />
          <p className="text-lg font-semibold text-ink">Nice work!</p>
          <p className="text-sm text-muted">{given ? `${given} has been told.` : 'Marked done.'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            Show what you did{given ? ` for ${given}` : ''}: a note, links or photos. All optional.
          </p>
          {error && (
            <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-3 py-2 text-sm text-ink">
              {error}
            </p>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
            Note
            <textarea className="field min-h-24" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done, anything they should know…" />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink-soft">Links</span>
            {links.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {links.map((l) => (
                  <li key={l} className="flex animate-pop-in items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-sm">
                    <Link2 className="h-4 w-4 shrink-0 text-uplift" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-ink-soft">{l}</span>
                    <button type="button" className="icon-btn h-7 w-7" onClick={() => setLinks((ls) => ls.filter((x) => x !== l))} aria-label={`Remove ${l}`}>
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                className="field py-2.5"
                inputMode="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
                placeholder="Drive folder, report, post…"
              />
              <button type="button" className="btn-ghost shrink-0 px-3" onClick={addLink} disabled={!link.trim()} aria-label="Add link">
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink-soft">
              Photos <span className="font-normal text-muted">({photos.length} of {MAX_PHOTOS})</span>
            </span>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square animate-pop-in overflow-hidden rounded-xl border border-line">
                  <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}>
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" className="press grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line text-muted hover:border-uplift hover:text-uplift" onClick={() => file.current?.click()} disabled={busy === 'photo'}>
                  {busy === 'photo' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}
                  <span className="sr-only">Add photos</span>
                </button>
              )}
            </div>
            <input ref={file} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => (void addPhotos(e.target.files), (e.target.value = ''))} />
          </div>
        </div>
      )}
    </Sheet>
  );
}
