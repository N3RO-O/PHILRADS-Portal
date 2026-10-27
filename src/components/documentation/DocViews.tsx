import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Film,
  Grid2x2,
  Grid3x3,
  Image as ImageIcon,
  LayoutGrid,
  LayoutList,
  List,
  MousePointerClick,
  PanelRight,
  PanelRightOpen,
  Play,
  Rows3,
  Square,
  Table,
  type LucideIcon,
} from 'lucide-react';
import { useDismiss } from '../../hooks/useDismiss';
import { formatBytes, formatShortDate, formatShortInstant, formatTime } from '../../lib/format';
import type { DocFile, DocLinks } from '../../services/documentation/documentationService';

/** How files are laid out, like the View menu in File Explorer. */
export type DocView = 'xl' | 'large' | 'medium' | 'small' | 'list' | 'details' | 'tiles' | 'content';
/** A panel beside the files (wide screens): the clicked file's details, or a bigger preview. */
export type DocPane = 'none' | 'details' | 'preview';

export const VIEWS: { id: DocView; label: string; icon: LucideIcon }[] = [
  { id: 'xl', label: 'Extra large icons', icon: Square },
  { id: 'large', label: 'Large icons', icon: Grid2x2 },
  { id: 'medium', label: 'Medium icons', icon: Grid3x3 },
  { id: 'small', label: 'Small icons', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: List },
  { id: 'details', label: 'Details', icon: Table },
  { id: 'tiles', label: 'Tiles', icon: LayoutList },
  { id: 'content', label: 'Content', icon: Rows3 },
];

/** The list around one day's files. */
export const VIEW_LIST: Record<DocView, string> = {
  xl: 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3',
  large: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4',
  medium: 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6',
  small: 'grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  list: 'grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3',
  details: 'flex flex-col',
  tiles: 'grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3',
  content: 'flex flex-col divide-y divide-line/50',
};

const STORE = 'philrads.docs.view.v1';
const isView = (v: unknown): v is DocView => VIEWS.some((x) => x.id === v);

/** The chosen view and pane, remembered on this device (each page keeps its own). */
export function useDocViewPrefs(storeKey = STORE) {
  const [prefs, setPrefs] = useState<{ view: DocView; pane: DocPane }>(() => {
    try {
      const p = JSON.parse(localStorage.getItem(storeKey) ?? '{}') as { view?: unknown; pane?: unknown };
      return { view: isView(p.view) ? p.view : 'large', pane: p.pane === 'details' || p.pane === 'preview' ? p.pane : 'none' };
    } catch {
      return { view: 'large', pane: 'none' };
    }
  });
  const update = useCallback((patch: Partial<{ view: DocView; pane: DocPane }>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(storeKey, JSON.stringify(next));
      } catch {
        // Not remembered (private window or storage off); the view still changes.
      }
      return next;
    });
  }, [storeKey]);
  return [prefs, update] as const;
}

// ───────────────────────── The View menu ─────────────────────────

export function ViewMenu({ view, pane, onChange, showPanes }: { view: DocView; pane: DocPane; onChange: (p: Partial<{ view: DocView; pane: DocPane }>) => void; showPanes: boolean }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, wrap, close, button);
  const Current = VIEWS.find((v) => v.id === view)?.icon ?? Grid2x2;
  const item = 'flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm text-ink transition-colors hover:bg-white/[0.06]';
  const dot = (on: boolean) => <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? 'bg-ink' : 'bg-transparent'}`} aria-hidden />;
  return (
    <div ref={wrap} className="relative">
      <button ref={button} type="button" className="btn-ghost min-h-11 px-3.5" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Current className="h-4 w-4" aria-hidden /> View <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="View" className="popover absolute right-0 top-12 z-40 w-60 origin-top-right animate-pop-in p-1.5">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" role="menuitemradio" aria-checked={view === v.id} className={item} onClick={() => (onChange({ view: v.id }), setOpen(false))}>
              {dot(view === v.id)}
              <v.icon className="h-4 w-4 text-ink-soft" aria-hidden /> {v.label}
            </button>
          ))}
          {showPanes && (
            <>
              <hr className="my-1.5 border-line/70" />
              {(
                [
                  ['details', 'Details pane', PanelRight],
                  ['preview', 'Preview pane', PanelRightOpen],
                ] as const
              ).map(([id, label, Icon]) => (
                <button key={id} type="button" role="menuitemcheckbox" aria-checked={pane === id} className={item} onClick={() => (onChange({ pane: pane === id ? 'none' : id }), setOpen(false))}>
                  {dot(pane === id)}
                  <Icon className="h-4 w-4 text-ink-soft" aria-hidden /> {label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── One file, in any view ─────────────────────────

const iconFor = (doc: DocFile) => (doc.mimeType.startsWith('video/') ? Film : doc.mimeType.startsWith('image/') ? ImageIcon : FileText);
const duration = (ms: number | null) => (ms ? `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}` : null);
const kindLabel = (doc: DocFile) =>
  doc.mimeType === 'application/pdf' ? 'PDF' : doc.mimeType.startsWith('image/') ? 'Photo' : doc.mimeType.startsWith('video/') ? 'Video' : (doc.fileName?.split('.').pop()?.toUpperCase() ?? 'File');

/** A file's picture, or its kind's icon while there's none. */
function Thumb({ doc, thumb, className, icon = 'h-8 w-8', badges = false }: { doc: DocFile; thumb: string | undefined; className: string; icon?: string; badges?: boolean }) {
  const [failed, setFailed] = useState(false);
  const Icon = iconFor(doc);
  const isVideo = doc.mimeType.startsWith('video/');
  return (
    <span className={`relative block shrink-0 overflow-hidden bg-surface-sunken ${className}`}>
      {thumb && !failed ? (
        <img src={thumb} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
      ) : thumb === undefined && !failed ? (
        <span className="skeleton absolute inset-0 !rounded-none" />
      ) : (
        <span className="grid h-full w-full place-items-center">
          <Icon className={`${icon} text-muted`} aria-hidden />
        </span>
      )}
      {badges && isVideo && (
        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
          <Play className="h-3 w-3 fill-white" aria-hidden /> {duration(doc.durationMs) ?? 'Video'}
        </span>
      )}
      {badges && doc.mimeType === 'application/pdf' && <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.625rem] font-bold text-white">PDF</span>}
    </span>
  );
}

function Tick({ on, className = '' }: { on: boolean; className?: string }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-uplift bg-uplift text-page' : 'border-white/70 bg-black/40'} ${className}`} aria-hidden>
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

interface ItemProps {
  doc: DocFile;
  thumb: string | undefined;
  view: DocView;
  selecting: boolean;
  selected: boolean;
  /** Shown in the side pane. */
  focused: boolean;
  onClick: (e: MouseEvent) => void;
  onDoubleClick: () => void;
  /** The side pane is open: Details shows fewer columns (the pane has the rest). */
  compact?: boolean;
}

/** One file. Shift-click and Ctrl-click are handled by the page (selecting several). */
export function DocItem({ doc, thumb, view, selecting, selected, focused, onClick, onDoubleClick, compact = false }: ItemProps) {
  const base = 'tap group w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-uplift';
  const rowState = selected ? 'bg-uplift/10 ring-1 ring-inset ring-uplift/60' : focused ? 'bg-surface-raised' : 'hover:bg-white/[0.04]';
  const props = {
    type: 'button' as const,
    onClick,
    onDoubleClick,
    // Shift-click selects a range; stop the browser selecting the text in between.
    onMouseDown: (e: MouseEvent) => e.shiftKey && e.preventDefault(),
    'aria-pressed': selecting ? selected : undefined,
    title: doc.title,
  };
  const meta = `${doc.uploadedByName} · ${formatTime(doc.uploadedAt)}${doc.imsEventName ? ` · ${doc.imsEventName}` : ''}`;

  if (view === 'xl' || view === 'large' || view === 'medium') {
    const ring = selected ? 'border-uplift ring-2 ring-uplift' : focused ? 'border-ink-mute ring-2 ring-ink-mute/60' : 'border-line/60';
    return (
      <button {...props} className={`${base} flex flex-col gap-1.5 rounded-xl`}>
        <span className="relative block w-full">
          <Thumb doc={doc} thumb={thumb} badges={view !== 'medium'} icon={view === 'medium' ? 'h-6 w-6' : 'h-8 w-8'} className={`aspect-[4/3] w-full rounded-xl border ${ring}`} />
          {selecting && <Tick on={selected} className="absolute right-2 top-2 z-10" />}
        </span>
        <span className={view === 'medium' ? 'truncate text-xs font-semibold' : 'line-clamp-2 text-sm font-semibold leading-snug'}>{doc.title}</span>
        {view !== 'medium' && <span className="truncate text-[0.6875rem] text-muted">{meta}</span>}
      </button>
    );
  }

  if (view === 'small' || view === 'list') {
    const small = view === 'small';
    return (
      <button {...props} className={`${base} flex items-center gap-2.5 rounded-lg ${small ? 'p-1.5' : 'px-1.5 py-1'} ${rowState}`}>
        {selecting && <Tick on={selected} />}
        <Thumb doc={doc} thumb={thumb} icon="h-4 w-4" className={small ? 'h-10 w-10 rounded-md' : 'h-6 w-6 rounded'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{doc.title}</span>
          {small && <span className="block truncate text-[0.6875rem] text-muted">{doc.uploadedByName}</span>}
        </span>
      </button>
    );
  }

  if (view === 'details') {
    return (
      <button {...props} className={`${base} ${detailsGrid(compact)} items-center rounded-lg px-2 py-1.5 text-sm ${rowState}`}>
        <span className="flex min-w-0 items-center gap-2.5">
          {selecting && <Tick on={selected} />}
          <Thumb doc={doc} thumb={thumb} icon="h-4 w-4" className="h-7 w-7 rounded" />
          <span className="truncate">{doc.title}</span>
        </span>
        <span className="hidden truncate text-ink-soft sm:block">{doc.category}</span>
        {!compact && <span className="hidden truncate text-ink-soft sm:block">{doc.uploadedByName}</span>}
        <span className="truncate text-right text-ink-soft tabular-nums sm:text-left">{formatTime(doc.uploadedAt)}</span>
        {!compact && <span className="hidden text-right text-ink-soft tabular-nums lg:block">{doc.sizeBytes ? formatBytes(doc.sizeBytes) : '—'}</span>}
      </button>
    );
  }

  if (view === 'tiles') {
    return (
      <button {...props} className={`${base} flex items-center gap-3 rounded-xl border p-2 ${selected ? 'border-uplift/60 bg-uplift/10' : focused ? 'border-ink-mute/60 bg-surface-raised' : 'border-line/60 hover:bg-white/[0.04]'}`}>
        {selecting && <Tick on={selected} />}
        <Thumb doc={doc} thumb={thumb} icon="h-6 w-6" className="h-16 w-16 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-semibold leading-snug">{doc.title}</span>
          <span className="block truncate text-xs text-ink-soft">
            {kindLabel(doc)}
            {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ''}
          </span>
          <span className="block truncate text-[0.6875rem] text-muted">{meta}</span>
        </span>
      </button>
    );
  }

  // Content: a bigger picture with the notes beside it.
  return (
    <button {...props} className={`${base} flex items-start gap-3 rounded-lg px-1.5 py-3 sm:gap-4 ${rowState}`}>
      {selecting && <Tick on={selected} className="mt-1" />}
      <Thumb doc={doc} thumb={thumb} icon="h-6 w-6" badges className="aspect-[4/3] w-24 rounded-lg sm:w-32" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug">{doc.title}</span>
        {doc.notes && <span className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{doc.notes}</span>}
        <span className="mt-1 block truncate text-[0.6875rem] text-muted sm:hidden">{meta}</span>
      </span>
      <span className="hidden w-48 shrink-0 flex-col gap-0.5 text-right text-xs text-ink-soft sm:flex">
        <span className="truncate">{doc.uploadedByName}</span>
        <span className="tabular-nums">{formatTime(doc.uploadedAt)}</span>
        <span>
          {doc.category}
          {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ''}
        </span>
      </span>
    </button>
  );
}

const detailsGrid = (compact: boolean) =>
  compact
    ? 'grid grid-cols-[minmax(0,1fr)_6.5rem_4.5rem] gap-3'
    : 'grid grid-cols-[minmax(0,1fr)_4.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_9rem_4.5rem] lg:grid-cols-[minmax(0,1fr)_6.5rem_9rem_4.5rem_4.5rem]';

/** Column names above the Details view. */
export function DetailsHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${detailsGrid(compact)} border-b border-line/70 px-2 pb-2 text-xs font-semibold text-muted`} aria-hidden>
      <span>Name</span>
      <span className="hidden sm:block">Category</span>
      {!compact && <span className="hidden sm:block">Uploaded by</span>}
      <span className="text-right sm:text-left">Time</span>
      {!compact && <span className="hidden text-right lg:block">Size</span>}
    </div>
  );
}

// ───────────────────────── Side pane ─────────────────────────

export function DocSidePane({ mode, doc, links, projectName, onOpen }: { mode: Exclude<DocPane, 'none'>; doc: DocFile | null; links: DocLinks | undefined; projectName: string | null; onOpen: () => void }) {
  if (!doc)
    return (
      <aside className="hidden w-80 shrink-0 lg:block" aria-label={mode === 'details' ? 'Details pane' : 'Preview pane'}>
        <div className="sticky top-24 grid min-h-64 place-items-center rounded-xl border border-dashed border-line/70 p-6 text-center text-sm text-muted">
          <span className="flex flex-col items-center gap-2">
            <MousePointerClick className="h-6 w-6" aria-hidden /> Click a file to see it here
          </span>
        </div>
      </aside>
    );
  const isImage = doc.mimeType.startsWith('image/');
  const src = mode === 'preview' && isImage ? links?.view : links?.thumb;
  const rows: [string, ReactNode][] = [
    ['Type', kindLabel(doc)],
    ['Category', doc.category],
    ['Size', doc.sizeBytes ? formatBytes(doc.sizeBytes) : null],
    ['Taken', doc.takenOn ? formatShortDate(doc.takenOn) : null],
    ['Uploaded by', doc.uploadedByName],
    ['Uploaded', `${formatShortInstant(doc.uploadedAt)}, ${formatTime(doc.uploadedAt)}`],
    ['Response', doc.imsEventName],
    ['Project', projectName],
    ['Dimensions', doc.width && doc.height ? `${doc.width} × ${doc.height}` : null],
    ['Length', duration(doc.durationMs)],
  ];
  return (
    <aside className="hidden w-80 shrink-0 lg:block" aria-label={mode === 'details' ? 'Details pane' : 'Preview pane'}>
      <div className="sticky top-24 flex max-h-[calc(100dvh-7rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-line/70 bg-surface-sunken p-3">
        <button type="button" onClick={onOpen} className="group block overflow-hidden rounded-lg" aria-label={`Open ${doc.title}`}>
          {src ? (
            <img src={src} alt="" className={`w-full bg-black/40 ${mode === 'preview' ? 'max-h-[60dvh] object-contain' : 'aspect-[4/3] object-cover'}`} />
          ) : (
            <Thumb doc={doc} thumb={undefined} className="aspect-[4/3] w-full rounded-lg" />
          )}
        </button>
        <div>
          <p className="break-words font-semibold leading-snug">{doc.title}</p>
          {doc.fileName && doc.fileName !== doc.title && <p className="break-all text-xs text-muted">{doc.fileName}</p>}
        </div>
        {mode === 'details' && (
          <>
            <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-xs">
              {rows
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="break-words text-ink-soft">{v}</dd>
                  </div>
                ))}
            </dl>
            {doc.notes && <p className="whitespace-pre-line break-words rounded-lg bg-surface p-2.5 text-xs text-ink-soft">{doc.notes}</p>}
          </>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-primary min-h-10 flex-1 px-3 text-sm" onClick={onOpen}>
            <Eye className="h-4 w-4" aria-hidden /> Open
          </button>
          {links?.download && (
            <a className="btn-ghost min-h-10 px-3 text-sm" href={links.download} aria-label={`Download ${doc.title}`}>
              <Download className="h-4 w-4" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
