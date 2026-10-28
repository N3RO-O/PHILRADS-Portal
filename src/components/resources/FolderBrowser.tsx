import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { Check, ChevronRight, Download, ExternalLink, File, FileSpreadsheet, FileText, Film, Folder, Image as ImageIcon, Loader2, Presentation, type LucideIcon } from 'lucide-react';
import { useDocViewPrefs, ViewMenu, type DocView } from '../documentation/DocViews';
import { formatBytes, formatShortInstant } from '../../lib/format';
import { resourcesService } from '../../services';
import type { FolderItem, FolderListing, Resource } from '../../services/resources/types';

/** Lists for each view (like Documentation's, a little denser: these are files, not photos). */
const LIST: Record<DocView, string> = {
  xl: 'grid grid-cols-2 gap-4 sm:grid-cols-3',
  large: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4',
  medium: 'grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-6',
  small: 'grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3',
  list: 'grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3',
  details: 'flex flex-col',
  tiles: 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3',
  content: 'flex flex-col divide-y divide-line/50',
};

function kindOf(f: FolderItem): { icon: LucideIcon; tone: string; label: string } {
  const m = f.mimeType;
  if (f.folder) return { icon: Folder, tone: 'bg-status-low/10 text-status-low', label: 'Folder' };
  if (m.startsWith('image/')) return { icon: ImageIcon, tone: 'bg-sky-300/10 text-sky-300', label: 'Photo' };
  if (m.startsWith('video/')) return { icon: Film, tone: 'bg-violet-300/10 text-violet-300', label: 'Video' };
  if (m === 'application/pdf') return { icon: FileText, tone: 'bg-status-out/10 text-status-out', label: 'PDF' };
  if (m.includes('spreadsheet') || m.includes('excel')) return { icon: FileSpreadsheet, tone: 'bg-status-in/10 text-status-in', label: m.includes('google-apps') ? 'Google Sheet' : 'Excel' };
  if (m.includes('presentation') || m.includes('powerpoint')) return { icon: Presentation, tone: 'bg-uplift/10 text-uplift', label: m.includes('google-apps') ? 'Google Slides' : 'PowerPoint' };
  if (m.includes('document') || m.includes('word')) return { icon: FileText, tone: 'bg-sky-300/10 text-sky-300', label: m.includes('google-apps') ? 'Google Doc' : 'Word' };
  return { icon: File, tone: 'bg-white/5 text-ink-soft', label: f.name.includes('.') ? f.name.split('.').pop()!.toUpperCase() : 'File' };
}

function Thumb({ f, className, icon = 'h-7 w-7' }: { f: FolderItem; className: string; icon?: string }) {
  const [failed, setFailed] = useState(false);
  const k = kindOf(f);
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden ${k.tone} ${className}`}>
      {f.links?.thumb && !failed ? (
        <img src={f.links.thumb} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <k.icon className={icon} aria-hidden />
      )}
    </span>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-uplift bg-uplift text-page' : 'border-ink-mute bg-black/30'}`} aria-hidden>
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

/**
 * A Drive folder resource, browsed inside the portal: the View menu (as in Documentation), open
 * folders within it, tick files and download the ones you want. Read through the PHILRADS Drive
 * connection (/api/drive/folder); links last two hours.
 */
export function FolderBrowser({ resource, onFallback }: { resource: Resource; onFallback: () => void }) {
  const [prefs, setPrefs] = useDocViewPrefs('philrads.resources.folder.view.v1');
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const sample = resourcesService.source === 'mock';

  const load = useCallback(() => {
    setError(null);
    setListing(null);
    resourcesService.folder(resource.id, folderId).then(
      (l) => {
        setListing(l);
        setSelected(new Set());
        setAnchor(null);
      },
      (e: Error) => setError(e.message),
    );
  }, [resource.id, folderId]);
  useEffect(load, [load]);

  const files = listing?.items.filter((f) => !f.folder) ?? [];
  const open = (f: FolderItem) => {
    if (f.folder) return setFolderId(f.id);
    if (sample || !f.links) return;
    window.open(f.links.view, '_blank', 'noopener');
  };
  const onClick = (f: FolderItem, e: MouseEvent) => {
    if (f.folder) return setFolderId(f.id);
    if (e.shiftKey && anchor) {
      const ids = files.map((x) => x.id);
      const a = ids.indexOf(anchor);
      const b = ids.indexOf(f.id);
      const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
      return setSelected((s) => new Set([...s, ...range]));
    }
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(f.id)) next.delete(f.id);
      else next.add(f.id);
      return next;
    });
    setAnchor(f.id);
  };

  /** One after another (a short gap, so the browser keeps up); it may ask once to allow several downloads. */
  const download = async () => {
    const chosen = files.filter((f) => selected.has(f.id) && f.links);
    if (!chosen.length || sample) return;
    setDownloading(true);
    for (const f of chosen) {
      const a = document.createElement('a');
      a.href = f.links!.download;
      a.download = f.name + (f.downloadAs && !f.name.toLowerCase().endsWith(f.downloadAs) ? f.downloadAs : '');
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 700));
    }
    setDownloading(false);
  };

  const allOn = files.length > 0 && files.every((f) => selected.has(f.id));
  const meta = (f: FolderItem) => [kindOf(f).label + (f.downloadAs ? ` (downloads as ${f.downloadAs})` : ''), f.sizeBytes ? formatBytes(f.sizeBytes) : null].filter(Boolean).join(' · ');

  const item = (f: FolderItem) => {
    const on = selected.has(f.id);
    const k = kindOf(f);
    const base = 'tap group w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-uplift';
    const row = on ? 'bg-uplift/10 ring-1 ring-inset ring-uplift/60' : 'hover:bg-white/[0.05]';
    const props = {
      type: 'button' as const,
      onClick: (e: MouseEvent) => onClick(f, e),
      onDoubleClick: () => open(f),
      onMouseDown: (e: MouseEvent) => e.shiftKey && e.preventDefault(),
      'aria-pressed': f.folder ? undefined : on,
      title: f.folder ? `Open ${f.name}` : `${f.name} (double-click to open)`,
    };
    const tick = !f.folder && <Tick on={on} />;
    const v = prefs.view;
    if (v === 'xl' || v === 'large' || v === 'medium')
      return (
        <button {...props} className={`${base} flex flex-col gap-1.5 rounded-xl p-1`}>
          <span className="relative block w-full">
            <Thumb f={f} icon={v === 'medium' ? 'h-7 w-7' : 'h-10 w-10'} className={`aspect-[4/3] w-full rounded-xl border ${on ? 'border-uplift ring-2 ring-uplift' : 'border-line/60'}`} />
            {!f.folder && (
              <span className={`absolute right-2 top-2 transition ${on ? '' : 'opacity-0 group-hover:opacity-100'}`}>
                <Tick on={on} />
              </span>
            )}
          </span>
          <span className={v === 'medium' ? 'truncate text-xs font-semibold' : 'line-clamp-2 text-sm font-semibold leading-snug'}>{f.name}</span>
          {v !== 'medium' && <span className="truncate text-[0.6875rem] text-muted">{f.folder ? 'Folder' : meta(f)}</span>}
        </button>
      );
    if (v === 'details')
      return (
        <button {...props} className={`${base} grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-3 rounded-lg px-2 py-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_8rem_5.5rem_6rem] ${row}`}>
          <span className="flex min-w-0 items-center gap-2.5">
            {tick || <span className="w-5" />}
            <Thumb f={f} icon="h-4 w-4" className="h-7 w-7 rounded" />
            <span className="truncate">{f.name}</span>
          </span>
          <span className="truncate text-ink-soft">{k.label}</span>
          <span className="hidden text-right text-ink-soft tabular-nums sm:block">{f.sizeBytes ? formatBytes(f.sizeBytes) : '—'}</span>
          <span className="hidden text-ink-soft tabular-nums sm:block">{f.modifiedAt ? formatShortInstant(f.modifiedAt) : ''}</span>
        </button>
      );
    if (v === 'tiles' || v === 'content')
      return (
        <button {...props} className={`${base} flex items-center gap-3 rounded-xl ${v === 'tiles' ? `border p-2.5 ${on ? 'border-uplift/60 bg-uplift/10' : 'border-line/60 hover:bg-white/[0.04]'}` : `px-1.5 py-2.5 ${row}`}`}>
          {tick}
          <Thumb f={f} icon="h-6 w-6" className={v === 'tiles' ? 'h-12 w-12 rounded-xl' : 'aspect-[4/3] w-24 rounded-lg'} />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm font-semibold leading-snug">{f.name}</span>
            <span className="block truncate text-xs text-ink-soft">{f.folder ? 'Folder' : meta(f)}</span>
            {f.modifiedAt && <span className="block text-[0.6875rem] text-muted">Updated {formatShortInstant(f.modifiedAt)}</span>}
          </span>
          {f.folder && <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
        </button>
      );
    return (
      <button {...props} className={`${base} flex items-center gap-2.5 rounded-lg ${v === 'small' ? 'p-1.5' : 'px-1.5 py-1'} ${row}`}>
        {tick || <span className="w-5" />}
        <Thumb f={f} icon="h-4 w-4" className={v === 'small' ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{f.name}</span>
          {v === 'small' && <span className="block truncate text-[0.6875rem] text-muted">{f.folder ? 'Folder' : meta(f)}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line/70 px-3 py-2 sm:px-5">
        <nav aria-label="Folder" className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 text-sm">
          {(listing?.path ?? [{ id: '', name: resource.title }]).map((p, i, all) => (
            <span key={p.id || i} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden />}
              {i < all.length - 1 ? (
                <button type="button" className="rounded px-1 py-0.5 font-medium text-ink-soft hover:bg-white/[0.06] hover:text-ink" onClick={() => setFolderId(i === 0 ? undefined : p.id)}>
                  {i === 0 ? resource.title : p.name}
                </button>
              ) : (
                <span className="px-1 font-semibold">{i === 0 ? resource.title : p.name}</span>
              )}
            </span>
          ))}
        </nav>
        <ViewMenu view={prefs.view} pane="none" onChange={(p) => setPrefs({ view: p.view ?? prefs.view })} showPanes={false} />
        {files.length > 0 && (
          <button type="button" className="btn-ghost min-h-11 px-3 text-sm" onClick={() => setSelected(allOn ? new Set() : new Set(files.map((f) => f.id)))}>
            {allOn ? 'Select none' : `Select all ${files.length}`}
          </button>
        )}
        <button type="button" className="btn-primary min-h-11 px-4 text-sm" disabled={!selected.size || downloading || sample} onClick={() => void download()} title={sample ? 'Sample files can’t be downloaded' : undefined}>
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          Download{selected.size ? ` (${selected.size})` : ''}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5">
        {error ? (
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 text-center">
            <p className="text-sm text-ink-soft">{error}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-ghost min-h-10 px-4 text-sm" onClick={load}>
                Try again
              </button>
              <button type="button" className="btn-ghost min-h-10 px-4 text-sm" onClick={onFallback}>
                <ExternalLink className="h-4 w-4" aria-hidden /> Use Google’s folder view
              </button>
            </div>
          </div>
        ) : !listing ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
          </div>
        ) : listing.items.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted">This folder is empty.</p>
        ) : (
          <>
            {prefs.view === 'details' && (
              <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 border-b border-line/70 px-2 pb-2 text-xs font-semibold text-muted sm:grid-cols-[minmax(0,1fr)_8rem_5.5rem_6rem]" aria-hidden>
                <span className="pl-7">Name</span>
                <span>Type</span>
                <span className="hidden text-right sm:block">Size</span>
                <span className="hidden sm:block">Updated</span>
              </div>
            )}
            <ul className={LIST[prefs.view]}>
              {listing.items.map((f) => (
                <li key={f.id} className="min-w-0">
                  {item(f)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
