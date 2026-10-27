import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, CheckSquare, CloudUpload, FileText, Film, HardDrive, Image as ImageIcon, Link2, Loader2, Play, RotateCw, Search, Trash2, Upload, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { DocViewer } from '../components/documentation/DocViewer';
import { UploadSheet, type TagOption } from '../components/documentation/UploadSheet';
import { EmptyState, LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatBytes, formatDayHeading, formatNumber, formatTime, manilaDayKey } from '../lib/format';
import { documentationService, inventoryStore, mapService, projectsService, uploadQueue } from '../services';
import { DEFAULT_DRIVE_FOLDER, type DocFile, type DocLinks, type DriveStatus, type QueuedUpload } from '../services/documentation/documentationService';
import { useInventoryState } from '../services/inventory/inventoryStore';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '../types';

type Toast = { text: string; error?: boolean };

/** Field photos, videos and reports, saved to the PHILRADS Google Drive and visible to every active staff member. */
export function DocumentationPage() {
  const { can, profile } = useAuth();
  const online = useOnlineStatus();
  const canUpload = can('documents.upload');
  const canManage = can('documents.manage');
  const isAdmin = can('staff.manage');
  const [params, setParams] = useSearchParams();

  const [docs, setDocs] = useState<DocFile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, DocLinks>>({});
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  // From a project's page: ?project=<id> shows (and uploads to) that project; &upload=1 opens the upload.
  const [projectFilter, setProjectFilter] = useState(() => params.get('project') ?? '');
  const [uploadProject] = useState<string | null>(() => params.get('project'));
  const [queue, setQueue] = useState<QueuedUpload[]>(() => uploadQueue.items());

  // Relief events from the IMS and Live Map places, for tagging uploads.
  const { snapshot } = useInventoryState(inventoryStore);
  useEffect(() => {
    if (!profile) return;
    void inventoryStore.start({ id: profile.id, name: profile.displayName });
    return () => inventoryStore.stop();
  }, [profile]);
  const events: TagOption[] = useMemo(
    () => (snapshot?.imsEvents ?? []).filter((e) => e.status !== 'cancelled').map((e) => ({ id: String(e.id), name: e.name })),
    [snapshot],
  );
  const [places, setPlaces] = useState<TagOption[]>([]);
  const [projects, setProjects] = useState<TagOption[]>([]);
  useEffect(() => {
    mapService.listPlaces().then((ps) => setPlaces(ps.map((p) => ({ id: p.id, name: p.name }))), () => setPlaces([]));
    projectsService.list().then((ps) => setProjects(ps.filter((p) => p.status !== 'cancelled').map((p) => ({ id: p.id, name: p.name }))), () => setProjects([]));
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await documentationService.list();
      setDocs(list);
      // Preview links for everything shown (they last two hours).
      for (let i = 0; i < list.length; i += 200) {
        const batch = list.slice(i, i + 200).map((d) => d.id);
        documentationService.links(batch).then((l) => setLinks((prev) => ({ ...prev, ...l })), () => undefined);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Documentation could not be loaded.');
    }
  }, []);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    documentationService.sync().then((n) => n > 0 && void load(), () => undefined);
  }, [load]);

  // Administrators: select several files and delete them (in Google Drive too).
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const deleteSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} file${ids.length === 1 ? '' : 's'}? ${ids.length === 1 ? 'It’s' : 'They’re'} removed from the portal and moved to Google Drive’s trash (recoverable there for 30 days).`)) return;
    setDeleting(true);
    try {
      const r = await documentationService.remove(ids);
      const failed = new Set(r.failed.map((f) => f.id));
      setDocs((list) => list && list.filter((d) => !ids.includes(d.id) || failed.has(d.id)));
      setSelected(failed);
      if (!failed.size) setSelecting(false);
      setToast(
        r.failed.length
          ? { text: `Deleted ${r.deleted}. ${r.failed.length} couldn’t be: ${r.failed[0].error}`, error: true }
          : { text: `Deleted ${r.deleted} file${r.deleted === 1 ? '' : 's'}. They’re in Google Drive’s trash for 30 days if you need them back.` },
      );
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : 'Nothing was deleted. Try again.', error: true });
    } finally {
      setDeleting(false);
    }
  };
  const loadStatus = useCallback(() => documentationService.status().then(setStatus, () => setStatus(null)), []);
  useEffect(() => void loadStatus(), [loadStatus]);

  // Uploads carry on in the background; when one finishes, show it.
  useEffect(
    () =>
      uploadQueue.subscribe((items) => {
        setQueue((prev) => {
          if (items.some((i) => i.status === 'done' && prev.find((p) => p.key === i.key)?.status !== 'done')) void load();
          return items;
        });
      }),
    [load],
  );
  // Leaving the portal mid-upload loses it: ask first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (uploadQueue.busy()) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => {
    if (params.get('upload') !== '1' || !status?.connected) return;
    setUploadOpen(true);
    setParams((p) => (p.delete('upload'), p), { replace: true });
  }, [params, setParams, status]);

  // Back from Google (connecting Drive).
  useEffect(() => {
    const drive = params.get('drive');
    if (!drive) return;
    setToast(drive === 'connected' ? { text: 'Google Drive is connected. Uploads can start.' } : { text: params.get('reason') ?? 'Google Drive could not be connected.', error: true });
    setParams((p) => (p.delete('drive'), p.delete('reason'), p), { replace: true });
    void loadStatus();
  }, [params, setParams, loadStatus]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const all = useMemo(() => docs ?? [], [docs]);
  const people = useMemo(() => [...new Set(all.map((d) => d.uploadedByName))].sort(), [all]);
  const docEvents = useMemo(() => [...new Map(all.filter((d) => d.imsEventId).map((d) => [d.imsEventId!, d.imsEventName ?? 'Response'])).entries()], [all]);
  const needle = search.trim().toLowerCase();
  const shown = useMemo(
    () =>
      all.filter(
        (d) =>
          (category === 'all' || d.category === category) &&
          (!person || d.uploadedByName === person) &&
          (!eventFilter || d.imsEventId === eventFilter) &&
          (!projectFilter || d.projectId === projectFilter) &&
          (!needle || [d.title, d.notes, d.uploadedByName, d.imsEventName, d.fileName].some((s) => s?.toLowerCase().includes(needle))),
      ),
    [all, category, person, eventFilter, projectFilter, needle],
  );
  const days = useMemo(() => {
    const groups: { day: string; items: DocFile[] }[] = [];
    for (const d of shown) {
      const key = manilaDayKey(d.uploadedAt);
      const g = groups[groups.length - 1];
      if (g && g.day === key) g.items.push(d);
      else groups.push({ day: key, items: [d] });
    }
    return groups;
  }, [shown]);
  const opened = all.find((d) => d.id === openId) ?? null;
  const today = manilaDayKey(new Date().toISOString());
  const ready = Boolean(status?.connected) && !status?.lastError;

  const connect = async (folder: string) => {
    try {
      window.location.href = await documentationService.connectUrl(folder);
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : 'Could not start connecting Google Drive.', error: true });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <DriveCard status={status} isAdmin={isAdmin} sample={documentationService.source === 'mock'} onConnect={(f) => void connect(f)} />

      {queue.length > 0 && <UploadQueuePanel items={queue} />}

      <section className="card flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="card-title flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-uplift" aria-hidden /> Field documentation
            {docs && <span className="text-sm font-normal text-muted">{formatNumber(all.length)}</span>}
          </h2>
          <div className="flex flex-wrap gap-2">
            {canManage && all.length > 0 && (
              <button type="button" className="btn-ghost min-h-11 px-4" aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
                {selecting ? <X className="h-4 w-4" aria-hidden /> : <CheckSquare className="h-4 w-4" aria-hidden />} {selecting ? 'Done selecting' : 'Select'}
              </button>
            )}
            {canUpload && !selecting && (
              <button type="button" className="btn-primary min-h-11 px-4" onClick={() => setUploadOpen(true)} disabled={!ready || !online} title={!ready ? 'Google Drive isn’t connected yet' : undefined}>
                <Upload className="h-4 w-4" aria-hidden /> Upload
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Show">
          {(['all', ...DOCUMENT_CATEGORIES] as const).map((c) => {
            const n = c === 'all' ? all.length : all.filter((d) => d.category === c).length;
            if (c !== 'all' && n === 0) return null;
            return (
              <button key={c} type="button" role="radio" aria-checked={category === c} aria-pressed={category === c} className="chip" onClick={() => setCategory(c)}>
                {c === 'all' ? 'Everything' : c} <span className="ml-1.5 opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_12rem_12rem]">
          <label className="relative block">
            <span className="sr-only">Search documentation</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" className="field pl-10" placeholder="Search titles, notes, people…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select className="field" aria-label="Uploaded by" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className="field" aria-label="Project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="field" aria-label="Response" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
            <option value="">All responses</option>
            {docEvents.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {loadError ? (
          <LoadError message={loadError} onRetry={() => void load()} />
        ) : docs === null ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading documentation">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={CloudUpload}
            title={all.length ? 'Nothing matches' : 'No documentation yet'}
            action={
              !all.length && canUpload && ready ? (
                <button type="button" className="btn-primary min-h-10 px-4 text-sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4" aria-hidden /> Upload the first photos
                </button>
              ) : undefined
            }
          >
            {all.length ? 'Try another word, person or category.' : 'Photos, videos and reports from the field show here, for the whole team.'}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-5">
            {days.map((g) => (
              <section key={g.day} aria-label={formatDayHeading(g.items[0].uploadedAt)}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  {g.day === today ? 'Today' : g.day === manilaDayKey(new Date(Date.now() - 86_400_000).toISOString()) ? 'Yesterday' : formatDayHeading(g.items[0].uploadedAt)}
                </h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {g.items.map((d) => (
                    <li key={d.id}>
                      <DocCard doc={d} thumb={links[d.id]?.thumb} selecting={selecting} selected={selected.has(d.id)} onOpen={() => (selecting ? toggle(d.id) : setOpenId(d.id))} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      {selecting && (
        <div className="sticky bottom-4 z-30 mx-auto flex w-full max-w-xl flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface-raised/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-md">
          <span className="min-w-0 flex-1 text-sm font-semibold">{selected.size ? `${selected.size} selected` : 'Tap files to select them'}</span>
          <button
            type="button"
            className="btn-ghost min-h-10 px-3 text-xs"
            onClick={() => setSelected((s) => (shown.every((d) => s.has(d.id)) ? new Set() : new Set(shown.map((d) => d.id))))}
          >
            {shown.length && shown.every((d) => selected.has(d.id)) ? 'Select none' : `Select all ${shown.length}`}
          </button>
          <button type="button" className="btn-primary min-h-10 bg-status-out px-4 text-xs text-white" onClick={() => void deleteSelected()} disabled={!selected.size || deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />} Delete
          </button>
        </div>
      )}

      <UploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        events={events}
        places={places}
        projects={projects}
        initialProjectId={uploadProject}
        today={today}
        onUpload={(entries) => {
          uploadQueue.add(entries);
          setUploadOpen(false);
          setToast({ text: `Uploading ${entries.length} file${entries.length === 1 ? '' : 's'}. You can keep working; they carry on in the background.` });
        }}
      />

      {opened && (
        <DocViewer
          doc={opened}
          links={links[opened.id]}
          canEdit={canManage || (Boolean(profile?.id) && opened.uploadedById === profile?.id)}
          events={events}
          places={places}
          onClose={() => setOpenId(null)}
          onSave={async (patch) => {
            try {
              await documentationService.update(opened.id, patch);
              setDocs((list) => list && list.map((d) => (d.id === opened.id ? { ...d, ...patch } : d)));
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : 'Not saved.';
            }
          }}
          onRemove={async () => {
            try {
              const r = await documentationService.remove([opened.id]);
              if (r.failed.length) return r.failed[0].error;
              setDocs((list) => list && list.filter((d) => d.id !== opened.id));
              setOpenId(null);
              setToast({ text: `Deleted “${opened.title}”. It’s in Google Drive’s trash for 30 days if you need it back.` });
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : 'Not deleted.';
            }
          }}
        />
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-6 md:left-auto md:right-6 md:justify-end">
        {toast && (
          <p
            role={toast.error ? 'alert' : undefined}
            className={`pointer-events-auto flex max-w-md animate-pop-in items-start gap-3 rounded-2xl border bg-surface-raised px-4 py-3 text-sm shadow-2xl shadow-black/50 ${toast.error ? 'border-status-out/50' : 'border-status-in/40'}`}
          >
            <span className="flex-1">{toast.text}</span>
            <button type="button" className="-m-1 grid h-8 w-8 shrink-0 place-items-center text-muted hover:text-ink" onClick={() => setToast(null)} aria-label="Dismiss">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

/** Where uploads go, and (administrators) connecting Google Drive. */
function DriveCard({ status, isAdmin, sample, onConnect }: { status: DriveStatus | null; isAdmin: boolean; sample: boolean; onConnect: (folder: string) => void }) {
  const [changing, setChanging] = useState(false);
  const [folder, setFolder] = useState(DEFAULT_DRIVE_FOLDER);
  const [busy, setBusy] = useState(false);
  if (!status) return <Skeleton className="h-16 rounded-2xl" />;
  const broken = Boolean(status.connected && status.lastError);
  const showForm = isAdmin && (!status.connected || broken || changing);

  return (
    <section className={`card flex flex-col gap-3 p-4 ${broken || !status.connected ? 'border-uplift/40' : ''}`} aria-label="Google Drive">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex min-w-0 items-start gap-3 text-sm">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${status.connected && !broken ? 'bg-status-in/15 text-status-in' : 'bg-uplift/15 text-uplift'}`}>
            {broken ? <AlertTriangle className="h-4 w-4" aria-hidden /> : <HardDrive className="h-4 w-4" aria-hidden />}
          </span>
          <span className="min-w-0">
            {status.connected && !broken ? (
              <>
                <span className="block font-semibold">
                  Saving to Google Drive: “{status.folderName ?? 'Documentation'}” {sample && <SampleBadge />}
                </span>
              </>
            ) : broken ? (
              <>
                <span className="block font-semibold text-uplift">Uploads are paused</span>
                <span className="block text-xs text-muted">{status.lastError}</span>
              </>
            ) : (
              <>
                <span className="block font-semibold">Google Drive isn’t connected yet</span>
                <span className="block text-xs text-muted">
                  {isAdmin ? 'Connect it once and everyone can upload.' : 'Uploads open once an administrator connects it. You can still browse what’s here.'}
                </span>
              </>
            )}
          </span>
        </p>
        {isAdmin && status.connected && !broken && !changing && (
          <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => setChanging(true)}>
            Change
          </button>
        )}
      </div>

      {showForm && (
        <form
          className="flex flex-col gap-3 rounded-xl border border-line/70 bg-white/[0.02] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            onConnect(folder);
            setTimeout(() => setBusy(false), 4000);
          }}
        >
          <ol className="list-decimal space-y-1 pl-5 text-xs text-ink-soft">
            <li>The folder’s owner shares it with the PHILRADS Google account as <strong>Editor</strong>.</li>
            <li>Paste the folder link below (it’s filled in already), then sign in with that PHILRADS account.</li>
          </ol>
          <label className="relative block">
            <span className="sr-only">Google Drive folder link</span>
            <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input className="field pl-10 text-xs" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary min-h-11 px-4" disabled={busy || !folder.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <HardDrive className="h-4 w-4" aria-hidden />} Connect Google Drive
            </button>
            {changing && (
              <button type="button" className="btn-ghost min-h-11 px-4" onClick={() => setChanging(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function DocCard({ doc, thumb, selecting = false, selected = false, onOpen }: { doc: DocFile; thumb: string | undefined; selecting?: boolean; selected?: boolean; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const isVideo = doc.mimeType.startsWith('video/');
  const Icon = isVideo ? Film : doc.mimeType.startsWith('image/') ? ImageIcon : FileText;
  const minutes = doc.durationMs ? `${Math.floor(doc.durationMs / 60000)}:${String(Math.round((doc.durationMs % 60000) / 1000)).padStart(2, '0')}` : null;
  return (
    <button type="button" onClick={onOpen} aria-pressed={selecting ? selected : undefined} className="tap group flex w-full flex-col gap-1.5 text-left">
      <span className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl border bg-surface-sunken ${selected ? 'border-uplift ring-2 ring-uplift' : 'border-line/60'}`}>
        {selecting && (
          <span className={`absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-md border-2 ${selected ? 'border-uplift bg-uplift text-page' : 'border-white/80 bg-black/40'}`} aria-hidden>
            {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
        )}
        {thumb && !failed ? (
          <img src={thumb} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : thumb === undefined && !failed ? (
          <span className="skeleton absolute inset-0 !rounded-none" />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <Icon className="h-8 w-8 text-muted" aria-hidden />
          </span>
        )}
        {isVideo && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
            <Play className="h-3 w-3 fill-white" aria-hidden /> {minutes ?? 'Video'}
          </span>
        )}
        {doc.mimeType === 'application/pdf' && <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.625rem] font-bold text-white">PDF</span>}
      </span>
      <span className="line-clamp-2 text-sm font-semibold leading-snug">{doc.title}</span>
      <span className="truncate text-[0.6875rem] text-muted">
        {doc.uploadedByName} · {formatTime(doc.uploadedAt)}
        {doc.imsEventName ? ` · ${doc.imsEventName}` : ''}
      </span>
    </button>
  );
}

/** Uploads in progress (and just finished or failed), with cancel and retry. */
function UploadQueuePanel({ items }: { items: QueuedUpload[] }) {
  const active = items.filter((i) => i.status === 'uploading' || i.status === 'waiting').length;
  const finished = items.some((i) => i.status === 'done' || i.status === 'cancelled');
  return (
    <section className="card flex flex-col gap-3 p-4" aria-label="Uploads">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {active ? <Loader2 className="h-4 w-4 animate-spin text-uplift" aria-hidden /> : <CheckCircle2 className="h-4 w-4 text-status-in" aria-hidden />}
          {active ? `Uploading ${active} file${active === 1 ? '' : 's'}…` : 'Uploads finished'}
        </h2>
        {finished && (
          <button type="button" className="link" onClick={() => uploadQueue.clearFinished()}>
            Clear finished
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.key} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium">{i.meta.title}</span>
              <span className={`shrink-0 tabular-nums ${i.status === 'failed' ? 'text-status-out' : i.status === 'done' ? 'text-status-in' : 'text-muted'}`}>
                {i.status === 'uploading'
                  ? `${Math.round(i.progress * 100)}% of ${formatBytes(i.file.size)}`
                  : i.status === 'waiting'
                    ? 'Waiting'
                    : i.status === 'done'
                      ? 'Saved'
                      : i.status === 'cancelled'
                        ? 'Cancelled'
                        : 'Failed'}
              </span>
              {(i.status === 'uploading' || i.status === 'waiting') && (
                <button type="button" className="icon-btn h-7 w-7" aria-label={`Cancel ${i.meta.title}`} onClick={() => uploadQueue.cancel(i.key)}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
              {(i.status === 'failed' || i.status === 'cancelled') && (
                <button type="button" className="icon-btn h-7 w-7" aria-label={`Try ${i.meta.title} again`} onClick={() => uploadQueue.retry(i.key)}>
                  <RotateCw className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={Math.round(i.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={i.meta.title}>
              <div
                className={`h-full w-full origin-left rounded-full transition-transform duration-300 ${i.status === 'failed' ? 'bg-status-out' : i.status === 'done' ? 'bg-status-in' : 'bg-uplift'}`}
                style={{ transform: `scaleX(${Math.max(0.02, i.progress)})` }}
              />
            </div>
            {i.error && <p className="text-[0.6875rem] text-status-out">{i.error}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
