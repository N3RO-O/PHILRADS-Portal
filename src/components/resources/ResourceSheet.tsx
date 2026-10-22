import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CloudUpload, Link2, Loader2, Trash2 } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { LINK_KIND_LABEL, parseResourceLink, type LinkKind } from '../../lib/resourceLinks';
import { validateResource, type ResourceErrors } from '../../lib/resources';
import { driveUploadService } from '../../services';
import {
  RESOURCE_CATEGORIES,
  RESOURCE_FILE_TYPES,
  ResourceRuleError,
  type Resource,
  type ResourceCategory,
  type ResourceDraft,
  type ResourceFileType,
} from '../../services/resources/types';
import { Sheet } from '../ui/Sheet';

interface Props {
  open: boolean;
  resource: Resource | null;
  existing: Resource[];
  onClose: () => void;
  onSave: (draft: ResourceDraft) => Promise<Resource>;
  onRemove: (r: Resource) => Promise<void>;
  onDone: (message: string) => void;
}

/** Sensible file type for a link, so most staff never need to pick one. */
const TYPE_FOR_KIND: Partial<Record<LinkKind, ResourceFileType>> = {
  drive_folder: 'Folder',
  google_doc: 'Word',
  google_sheet: 'Excel',
  google_slides: 'PowerPoint',
  web: 'Web page',
};

/** Add or edit a resource by pasting a Google Drive (or web) link. */
export function ResourceSheet({ open, resource, existing, onClose, onSave, onRemove, onDone }: Props) {
  const uid = useId();
  const online = useOnlineStatus();
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<'link' | 'upload'>('link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<ResourceCategory>('Forms and templates');
  const [fileType, setFileType] = useState<ResourceFileType | ''>('');
  const [description, setDescription] = useState('');
  const [pinned, setPinned] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('link');
    setTitle(resource?.title ?? '');
    setUrl(resource?.url ?? '');
    setCategory(resource?.category ?? 'Forms and templates');
    setFileType(resource?.fileType ?? '');
    setDescription(resource?.description ?? '');
    setPinned(resource?.pinned ?? false);
    setAttempted(false);
    setServerError(null);
  }, [open, resource]);

  const link = parseResourceLink(url);
  // Fill the file type from the link until the staff member picks one themselves.
  const effectiveType = fileType || (link && TYPE_FOR_KIND[link.kind]) || '';
  const draft: ResourceDraft = { id: resource?.id, title, url, category, description, pinned, fileType: effectiveType || null };
  const errors: ResourceErrors = attempted ? validateResource(draft, existing) : {};
  const aria = (k: keyof ResourceErrors) => ({
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setAttempted(true);
    setServerError(null);
    if (Object.keys(validateResource(draft, existing)).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy('save');
    try {
      const saved = await onSave(draft);
      onDone(`${resource ? 'Updated' : 'Added'} “${saved.title}”.`);
      onClose();
    } catch (err) {
      setServerError(err instanceof ResourceRuleError ? err.message : 'Could not reach the server. Check the connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!resource || !window.confirm(`Remove “${resource.title}” from Resources? The file in Google Drive is not deleted.`)) return;
    setBusy('remove');
    try {
      await onRemove(resource);
      onDone(`Removed “${resource.title}” from Resources.`);
      onClose();
    } catch (err) {
      setServerError(err instanceof ResourceRuleError ? err.message : 'Could not reach the server. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={resource ? 'Edit resource' : 'Add a resource'}
      subtitle="Staff open or download it from Google Drive with their PHILRADS account."
      footer={
        mode === 'link' && (
          <div className="flex gap-2">
            {resource && (
              <button type="button" className="btn-ghost px-4 text-status-out" onClick={() => void remove()} disabled={Boolean(busy) || !online}>
                {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                <span className="sr-only sm:not-sr-only">Remove</span>
              </button>
            )}
            <button type="submit" form={`${uid}-form`} className="btn-primary h-12 flex-1 text-base" disabled={Boolean(busy) || !online}>
              {busy === 'save' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
              {!online ? 'Connect to save' : busy === 'save' ? 'Saving…' : resource ? 'Save changes' : 'Add resource'}
            </button>
          </div>
        )
      }
    >
      {!resource && (
        <div role="tablist" aria-label="How to add" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-surface-sunken p-1">
          {(
            [
              ['link', 'Paste a link', Link2],
              ['upload', 'Upload a file', CloudUpload],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className="tap flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-ink-soft transition aria-selected:bg-surface-raised aria-selected:text-ink"
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      )}

      {mode === 'upload' ? (
        <div className="tile flex flex-col gap-3 px-4 py-5 text-sm text-ink-soft">
          <p>
            <strong className="font-semibold text-ink">Uploading straight to Google Drive isn’t connected yet.</strong>{' '}
            {driveUploadService.configured
              ? ''
              : 'Until it is: upload the file in Google Drive, choose Share → Copy link, then add it here with “Paste a link”.'}
          </p>
          <button type="button" className="btn-ghost self-start" onClick={() => setMode('link')}>
            <Link2 className="h-4 w-4" aria-hidden /> Paste a link instead
          </button>
        </div>
      ) : (
        <form id={`${uid}-form`} ref={formRef} noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
          {serverError && (
            <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
              <strong className="font-semibold text-status-out">Not saved.</strong> {serverError}
            </p>
          )}
          <Field id={`${uid}-url`} label="Google Drive or web link" error={errors.url} errorId={`${uid}-url-err`}>
            <input
              id={`${uid}-url`}
              className="field"
              type="url"
              inputMode="url"
              data-autofocus={resource ? undefined : true}
              placeholder="https://drive.google.com/file/d/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              {...aria('url')}
            />
            {link && !errors.url && <p className="text-xs text-status-in">Detected: {LINK_KIND_LABEL[link.kind]}</p>}
          </Field>
          <Field id={`${uid}-title`} label="Title" error={errors.title} errorId={`${uid}-title-err`}>
            <input id={`${uid}-title`} className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} {...aria('title')} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={`${uid}-cat`} label="Category" error={errors.category} errorId={`${uid}-category-err`}>
              <select id={`${uid}-cat`} className="field" value={category} onChange={(e) => setCategory(e.target.value as ResourceCategory)} {...aria('category')}>
                {RESOURCE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field id={`${uid}-type`} label="File type" hint="Optional">
              <select id={`${uid}-type`} className="field" value={effectiveType} onChange={(e) => setFileType(e.target.value as ResourceFileType | '')}>
                <option value="">Not specified</option>
                {RESOURCE_FILE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field id={`${uid}-desc`} label="What it’s for" hint="Optional" error={errors.description} errorId={`${uid}-description-err`}>
            <textarea id={`${uid}-desc`} className="field min-h-20" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} {...aria('description')} />
          </Field>
          <label className="tap flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-line/70 px-4">
            <span>
              <span className="block text-sm font-semibold">Pin to the top</span>
              <span className="block text-xs text-muted">For the few things staff need most often.</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-uplift" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          </label>
          <p className="text-xs text-muted">
            Check the file’s sharing in Google Drive: staff can only open it if it’s shared with their PHILRADS account or the PHILRADS Shared Drive.
          </p>
        </form>
      )}
    </Sheet>
  );
}

function Field({ id, label, hint, error, errorId, children }: { id: string; label: string; hint?: string; error?: string; errorId?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
          {label}
        </label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-status-out">
          {error}
        </p>
      )}
    </div>
  );
}
