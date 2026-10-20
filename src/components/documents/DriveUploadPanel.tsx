import { useId, useState, type ChangeEvent } from 'react';
import { CloudUpload, FileText, X } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { formatBytes } from '../../lib/format';
import { DriveNotConfiguredError, driveUploadService } from '../../services';
import { UPLOAD_RULES, uploadMetadataSchema, validateUploadFile } from '../../services/googleDrive';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '../../types';

interface Selected {
  key: string;
  file: File;
  error: string | null;
}

/**
 * Upload form for documentation files. The selection is kept on screen until
 * staff remove it; nothing is reported as uploaded unless Drive confirms it.
 */
export function DriveUploadPanel() {
  const online = useOnlineStatus();
  const inputId = useId();
  const [files, setFiles] = useState<Selected[]>([]);
  const [category, setCategory] = useState<DocumentCategory>('Photos');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = files.filter((f) => !f.error);
  const blockedReason = !driveUploadService.configured
    ? 'Google Drive isn’t connected yet, so files can’t be uploaded. Your selection stays here and nothing has been uploaded.'
    : !online
      ? 'You’re offline. Uploading needs an internet connection; your selection is kept.'
      : null;

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      error: validateUploadFile(file),
    }));
    setFiles((prev) => [...prev, ...picked.filter((p) => !prev.some((q) => q.key === p.key))]);
    setMessage(null);
    e.target.value = '';
  };

  const upload = async () => {
    setBusy(true);
    setMessage(null);
    try {
      for (const f of valid) {
        const meta = uploadMetadataSchema.parse({ title: f.file.name, category });
        await driveUploadService.upload({ file: f.file, title: meta.title, destination: { module: 'documentation', category: meta.category } });
      }
      setMessage(`${valid.length} file(s) uploaded.`);
      setFiles((prev) => prev.filter((f) => f.error));
    } catch (err) {
      setMessage(err instanceof DriveNotConfiguredError ? err.message : 'Upload failed. Your files are still selected; please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="upload-title" className="card flex h-full flex-col gap-4">
      <div>
        <h2 id="upload-title" className="card-title">
          Upload documentation
        </h2>
        <p className="card-note">Photos, videos, PDFs and office documents go to the Documentation folder in Google Drive.</p>
      </div>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface-sunken px-4 py-8 text-center transition-colors hover:border-uplift/50 focus-within:border-uplift"
      >
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-uplift/10 text-uplift">
          <CloudUpload className="h-6 w-6" aria-hidden />
        </span>
        <span className="text-sm font-semibold text-ink">Choose files</span>
        <span className="text-xs text-muted">Up to 2 GB each (limit to be confirmed)</span>
        <input id={inputId} type="file" multiple accept={UPLOAD_RULES.accept} onChange={onPick} className="sr-only" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
        Category
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {files.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Selected files">
          {files.map((f) => (
            <li key={f.key} className="tile flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-uplift" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{f.file.name}</p>
                <p className={`text-xs ${f.error ? 'text-rose' : 'text-muted'}`}>{f.error ?? formatBytes(f.file.size)}</p>
              </div>
              <button
                type="button"
                className="icon-btn h-8 w-8"
                aria-label={`Remove ${f.file.name}`}
                onClick={() => setFiles((prev) => prev.filter((p) => p.key !== f.key))}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn-primary self-start" disabled={busy || valid.length === 0 || Boolean(blockedReason)} onClick={() => void upload()}>
        {busy ? 'Uploading…' : `Upload${valid.length ? ` ${valid.length} file${valid.length > 1 ? 's' : ''}` : ''}`}
      </button>
      {(blockedReason || message) && (
        <p role="status" className="rounded-xl border border-uplift/30 bg-uplift/10 px-4 py-3 text-sm text-ink">
          {message ?? blockedReason}
        </p>
      )}
    </section>
  );
}
