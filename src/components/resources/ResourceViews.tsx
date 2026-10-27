import { useState, type MouseEvent } from 'react';
import { Check, Copy, Download, ExternalLink, Eye, MousePointerClick, Pencil, Pin } from 'lucide-react';
import type { DocPane, DocView } from '../documentation/DocViews';
import { formatShortInstant } from '../../lib/format';
import { LINK_KIND_LABEL, parseResourceLink } from '../../lib/resourceLinks';
import type { Resource } from '../../services/resources/types';
import { copy, KIND_ICON, TYPE_ICON, TYPE_TONE } from './ResourceCard';

/**
 * Resources in the same views as Documentation (View menu): the full cards for Extra large and
 * Large icons (ResourceCard), and these compact layouts for the rest. Files are links, so each
 * shows its type's icon rather than a picture.
 */

const iconOf = (r: Resource) => (r.fileType ? TYPE_ICON[r.fileType] : KIND_ICON[r.kind]);
const toneOf = (r: Resource) => (r.fileType && TYPE_TONE[r.fileType]) || 'bg-white/5 text-ink-soft';
const typeLabel = (r: Resource) => r.fileType ?? LINK_KIND_LABEL[r.kind];

/** Lists for the compact views (Extra large and Large use the card grid). */
export const RESOURCE_LIST: Record<Exclude<DocView, 'xl' | 'large'>, string> = {
  medium: 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6',
  small: 'grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  list: 'grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3',
  details: 'flex flex-col',
  tiles: 'grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3',
  content: 'flex flex-col divide-y divide-line/50',
};
export const CARD_LIST: Record<'xl' | 'large', string> = {
  xl: 'grid gap-3 sm:grid-cols-2',
  large: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3',
};

function Tick({ on }: { on: boolean }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-uplift bg-uplift text-page' : 'border-ink-mute'}`} aria-hidden>
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

const detailsGrid = (compact: boolean) =>
  compact
    ? 'grid grid-cols-[minmax(0,1fr)_7rem] gap-3'
    : 'grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_5.5rem_6rem] lg:grid-cols-[minmax(0,1fr)_9rem_5.5rem_9rem_6rem]';

export function ResourceDetailsHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${detailsGrid(compact)} border-b border-line/70 px-2 pb-2 text-xs font-semibold text-muted`} aria-hidden>
      <span>Name</span>
      <span className={compact ? '' : 'hidden sm:block'}>Category</span>
      {!compact && <span className="text-right sm:text-left">Type</span>}
      {!compact && <span className="hidden lg:block">Added by</span>}
      {!compact && <span className="hidden sm:block">Updated</span>}
    </div>
  );
}

interface ItemProps {
  resource: Resource;
  view: Exclude<DocView, 'xl' | 'large'>;
  selecting: boolean;
  selected: boolean;
  focused: boolean;
  compact: boolean;
  onClick: (e: MouseEvent) => void;
  onDoubleClick: () => void;
}

export function ResourceItem({ resource: r, view, selecting, selected, focused, compact, onClick, onDoubleClick }: ItemProps) {
  const Icon = iconOf(r);
  const base = 'tap group w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-uplift';
  const rowState = selected ? 'bg-uplift/10 ring-1 ring-inset ring-uplift/60' : focused ? 'bg-surface-raised' : 'hover:bg-white/[0.04]';
  const props = {
    type: 'button' as const,
    onClick,
    onDoubleClick,
    onMouseDown: (e: MouseEvent) => e.shiftKey && e.preventDefault(),
    'aria-pressed': selecting ? selected : undefined,
    title: r.title,
  };
  const pin = r.pinned && <Pin className="h-3 w-3 shrink-0 text-uplift" aria-label="Pinned" />;

  if (view === 'medium')
    return (
      <button {...props} className={`${base} flex flex-col items-center gap-1.5 rounded-xl p-2 text-center ${rowState}`}>
        <span className="relative">
          <span className={`grid h-14 w-14 place-items-center rounded-2xl ${toneOf(r)}`}>
            <Icon className="h-7 w-7" aria-hidden />
          </span>
          {selecting && (
            <span className="absolute -right-1.5 -top-1.5">
              <Tick on={selected} />
            </span>
          )}
        </span>
        <span className="line-clamp-2 text-xs font-semibold leading-snug">{r.title}</span>
      </button>
    );

  if (view === 'small' || view === 'list')
    return (
      <button {...props} className={`${base} flex items-center gap-2.5 rounded-lg ${view === 'small' ? 'p-1.5' : 'px-1.5 py-1'} ${rowState}`}>
        {selecting && <Tick on={selected} />}
        <span className={`grid shrink-0 place-items-center ${view === 'small' ? 'h-9 w-9 rounded-lg' : 'h-6 w-6 rounded'} ${toneOf(r)}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 truncate text-sm">
            {pin}
            <span className="truncate">{r.title}</span>
          </span>
          {view === 'small' && <span className="block truncate text-[0.6875rem] text-muted">{r.category}</span>}
        </span>
      </button>
    );

  if (view === 'details')
    return (
      <button {...props} className={`${base} ${detailsGrid(compact)} items-center rounded-lg px-2 py-1.5 text-sm ${rowState}`}>
        <span className="flex min-w-0 items-center gap-2.5">
          {selecting && <Tick on={selected} />}
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded ${toneOf(r)}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          {pin}
          <span className="truncate">{r.title}</span>
        </span>
        <span className={`truncate text-ink-soft ${compact ? '' : 'hidden sm:block'}`}>{r.category}</span>
        {!compact && <span className="truncate text-right text-ink-soft sm:text-left">{typeLabel(r)}</span>}
        {!compact && <span className="hidden truncate text-ink-soft lg:block">{r.addedByName}</span>}
        {!compact && <span className="hidden truncate text-ink-soft tabular-nums sm:block">{formatShortInstant(r.updatedAt)}</span>}
      </button>
    );

  if (view === 'tiles')
    return (
      <button
        {...props}
        className={`${base} flex items-center gap-3 rounded-xl border p-2.5 ${selected ? 'border-uplift/60 bg-uplift/10' : focused ? 'border-ink-mute/60 bg-surface-raised' : 'border-line/60 hover:bg-white/[0.04]'}`}
      >
        {selecting && <Tick on={selected} />}
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${toneOf(r)}`}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            {pin}
            <span className="line-clamp-2 text-sm font-semibold leading-snug">{r.title}</span>
          </span>
          <span className="block truncate text-xs text-ink-soft">
            {typeLabel(r)} · {r.category}
          </span>
          <span className="block truncate text-[0.6875rem] text-muted">{r.addedByName}</span>
        </span>
      </button>
    );

  // Content: the description beside it.
  return (
    <button {...props} className={`${base} flex items-start gap-3 rounded-lg px-1.5 py-3 sm:gap-4 ${rowState}`}>
      {selecting && (
        <span className="mt-1">
          <Tick on={selected} />
        </span>
      )}
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${toneOf(r)}`}>
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          {pin}
          <span className="text-sm font-semibold leading-snug">{r.title}</span>
        </span>
        {r.description && <span className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{r.description}</span>}
        <span className="mt-1 block truncate text-[0.6875rem] text-muted sm:hidden">
          {typeLabel(r)} · {r.category}
        </span>
      </span>
      <span className="hidden w-48 shrink-0 flex-col gap-0.5 text-right text-xs text-ink-soft sm:flex">
        <span className="truncate">{r.addedByName}</span>
        <span>Updated {formatShortInstant(r.updatedAt)}</span>
        <span>
          {typeLabel(r)} · {r.category}
        </span>
      </span>
    </button>
  );
}

/** The panel beside the list (wide screens): the clicked resource's details, or its preview. */
export function ResourceSidePane({
  mode,
  resource: r,
  canManage,
  onOpen,
  onEdit,
}: {
  mode: Exclude<DocPane, 'none'>;
  resource: Resource | null;
  canManage: boolean;
  onOpen: (r: Resource) => void;
  onEdit: (r: Resource) => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!r)
    return (
      <aside className="hidden w-80 shrink-0 lg:block" aria-label={mode === 'details' ? 'Details pane' : 'Preview pane'}>
        <div className="sticky top-24 grid min-h-64 place-items-center rounded-xl border border-dashed border-line/70 p-6 text-center text-sm text-muted">
          <span className="flex flex-col items-center gap-2">
            <MousePointerClick className="h-6 w-6" aria-hidden /> Click a resource to see it here
          </span>
        </div>
      </aside>
    );
  const link = parseResourceLink(r.url);
  const Icon = iconOf(r);
  const rows: [string, string | null][] = [
    ['Type', typeLabel(r)],
    ['Category', r.category],
    ['Where', LINK_KIND_LABEL[r.kind]],
    ['Added by', r.addedByName],
    ['Updated', formatShortInstant(r.updatedAt)],
  ];
  return (
    <aside className="hidden w-80 shrink-0 lg:block" aria-label={mode === 'details' ? 'Details pane' : 'Preview pane'}>
      <div className="sticky top-24 flex max-h-[calc(100dvh-7rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-line/70 bg-surface-sunken p-3">
        {mode === 'preview' && link?.previewUrl ? (
          <iframe key={link.previewUrl} src={link.previewUrl} title={r.title} className="h-[55dvh] w-full rounded-lg border border-line/60 bg-white" allow="autoplay" />
        ) : (
          <span className={`grid h-28 w-full place-items-center rounded-lg ${toneOf(r)}`}>
            <Icon className="h-10 w-10" aria-hidden />
          </span>
        )}
        <div>
          <p className="flex items-start gap-1.5 break-words font-semibold leading-snug">
            {r.pinned && <Pin className="mt-1 h-3.5 w-3.5 shrink-0 text-uplift" aria-label="Pinned" />}
            {r.title}
          </p>
          {mode === 'preview' && !link?.previewUrl && <p className="mt-1 text-xs text-muted">This link can’t be previewed here. Open it instead.</p>}
        </div>
        {mode === 'details' && (
          <>
            <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-xs">
              {rows
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="break-words text-ink-soft">{v}</dd>
                  </div>
                ))}
            </dl>
            {r.description && <p className="whitespace-pre-line break-words rounded-lg bg-surface p-2.5 text-xs text-ink-soft">{r.description}</p>}
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary col-span-2 min-h-10 px-3 text-sm" onClick={() => onOpen(r)}>
            {link?.previewUrl ? <Eye className="h-4 w-4" aria-hidden /> : <ExternalLink className="h-4 w-4" aria-hidden />} {link?.previewUrl ? 'Open preview' : 'Open'}
          </button>
          {link?.downloadUrl && (
            <a className="btn-ghost min-h-10 px-3 text-sm" href={link.downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" aria-hidden /> Download
            </a>
          )}
          <button
            type="button"
            className="btn-ghost min-h-10 px-3 text-sm"
            onClick={async () => {
              setCopied(await copy(link?.openUrl ?? r.url));
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="h-4 w-4 text-status-in" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? 'Copied' : 'Copy link'}
          </button>
          {canManage && (
            <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={() => onEdit(r)}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
