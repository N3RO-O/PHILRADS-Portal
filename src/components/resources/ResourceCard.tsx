import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Globe,
  MoreHorizontal,
  Pencil,
  Pin,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import { LINK_KIND_LABEL, parseResourceLink, type LinkKind } from '../../lib/resourceLinks';
import { formatShortInstant } from '../../lib/format';
import { useDismiss } from '../../hooks/useDismiss';
import type { Resource, ResourceFileType } from '../../services/resources/types';

export const TYPE_ICON: Record<ResourceFileType, LucideIcon> = {
  PDF: FileText,
  Word: FileText,
  Excel: FileSpreadsheet,
  PowerPoint: Presentation,
  Image: FileImage,
  Video: FileVideo,
  Folder: Folder,
  'Web page': Globe,
};
export const KIND_ICON: Record<LinkKind, LucideIcon> = {
  drive_file: FileText,
  drive_folder: Folder,
  google_doc: FileText,
  google_sheet: FileSpreadsheet,
  google_slides: Presentation,
  web: Globe,
};
export const TYPE_TONE: Partial<Record<ResourceFileType, string>> = {
  PDF: 'text-ink-soft',
  Word: 'text-ink-soft',
  Excel: 'text-ink-soft',
  PowerPoint: 'text-ink-soft',
  Folder: 'text-ink-soft',
};

export async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

interface Props {
  resource: Resource;
  canManage: boolean;
  onEdit: (r: Resource) => void;
  /** Show the file inside the portal (Drive and Google files only; web pages open in a new tab). */
  onPreview: (r: Resource) => void;
  /** Selecting several (managers): the card toggles instead of opening, actions hidden. */
  selecting?: boolean;
  selected?: boolean;
  onSelect?: (e: MouseEvent) => void;
}

/** One resource: what it is, where it lives, a one-tap Preview (or Open), and Open / Download / Copy link under the ⋯ menu. */
export function ResourceCard({ resource: r, canManage, onEdit, onPreview, selecting = false, selected = false, onSelect }: Props) {
  const link = parseResourceLink(r.url);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const Icon = r.fileType ? TYPE_ICON[r.fileType] : KIND_ICON[r.kind];
  const tone = (r.fileType && TYPE_TONE[r.fileType]) || 'bg-ink/5 text-ink-soft';
  const source = r.kind === 'drive_file' && r.fileType ? `${r.fileType} in Google Drive` : LINK_KIND_LABEL[r.kind];
  const copyLink = async () => setCopied((await copy(link?.openUrl ?? r.url)) ? 'ok' : 'failed');
  // The card's one button: Uplift text on the faintest tint, quiet until you look for it.
  const main =
    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-uplift/[0.08] px-2.5 text-xs font-semibold text-uplift transition-colors hover:bg-uplift/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uplift/60';

  return (
    <div
      className={`tile group/card flex h-full flex-col border border-line/50 p-4 transition-colors hover:border-line ${selecting ? 'cursor-pointer select-none' : ''} ${selected ? 'ring-2 ring-uplift' : ''}`}
      onClick={selecting ? onSelect : (e) => (e.shiftKey || e.ctrlKey || e.metaKey) && onSelect?.(e)}
      onMouseDown={(e) => e.shiftKey && e.preventDefault()}
      aria-selected={selecting ? selected : undefined}
    >
      {/* What it is and where it lives; the actions sit quietly on the right. */}
      <div className="flex items-center gap-2.5">
        {selecting && (
          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${selected ? 'border-burgundy-400 bg-burgundy-500 text-cloud' : 'border-ink-mute'}`} aria-hidden>
            {selected && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
        )}
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink/[0.05] ${tone}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs text-muted">{source}</p>
        {r.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-ink-mute" aria-label="Pinned" />}
        {!selecting && (
          <div className="-my-1 -mr-2 flex shrink-0 items-center">
            <MoreMenu
              title={r.title}
              openUrl={link?.previewUrl ? (link.openUrl ?? r.url) : null}
              openLabel={r.kind === 'web' ? 'Open the page' : 'Open in Google'}
              downloadUrl={link?.downloadUrl ?? null}
              onCopy={() => void copyLink()}
            />
            {canManage && (
              <button type="button" className="icon-btn h-8 w-8 rounded-lg" onClick={() => onEdit(r)} aria-label={`Edit ${r.title}`}>
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-ink">{r.title}</h3>
      <p className="mt-0.5 text-xs text-muted">{r.category}</p>
      {r.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">{r.description}</p>}

      {/* Grows so footers line up across a row; never less than a little breathing room. */}
      <div className="min-h-4 flex-1" aria-hidden />
      <div className="flex items-center justify-between gap-3 border-t border-line/50 pt-3">
        <p role="status" className={`min-w-0 truncate text-[0.6875rem] ${copied === 'ok' ? 'text-status-in' : copied === 'failed' ? 'text-status-out' : 'text-muted'}`}>
          {copied === 'ok' ? (
            <span className="inline-flex items-center gap-1">
              <Check className="h-3.5 w-3.5" aria-hidden /> Link copied
            </span>
          ) : copied === 'failed' ? (
            'Couldn’t copy the link'
          ) : (
            <span title={`Updated ${formatShortInstant(r.updatedAt)} · added by ${r.addedByName}`}>
              {formatShortInstant(r.updatedAt)} · {r.addedByName}
            </span>
          )}
        </p>
        {!selecting &&
          (link?.previewUrl ? (
            <button type="button" className={main} onClick={() => onPreview(r)}>
              <Eye className="h-3.5 w-3.5" aria-hidden /> Preview
            </button>
          ) : (
            <a className={main} href={link?.openUrl ?? r.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open
            </a>
          ))}
      </div>
    </div>
  );
}

/** ⋯ beside the pencil: the less-used actions (open in Google, download, copy link). */
function MoreMenu({ title, openUrl, openLabel, downloadUrl, onCopy }: { title: string; openUrl: string | null; openLabel: string; downloadUrl: string | null; onCopy: () => void }) {
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setAt(null), []);
  useDismiss(Boolean(at), wrap, close, button);
  useEffect(() => {
    if (!at) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    // It floats in place (fixed), so it closes rather than drift when the page moves.
    const away = (e: Event) => !menu.current?.contains(e.target as Node) && close();
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', close);
    };
  }, [at, close]);
  const item = 'flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-ink hover:bg-ink/[0.06] focus-visible:bg-ink/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-uplift';
  const moveFocus = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };
  return (
    <span ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        className="icon-btn h-9 w-9"
        aria-label={`More for ${title}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(at)}
        onClick={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          setAt((o) => (o ? null : { top: b.bottom + 4, right: window.innerWidth - b.right }));
        }}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {at &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={`More for ${title}`}
            data-popover-child
            onKeyDown={moveFocus}
            className="fixed z-[70] w-56 origin-top-right animate-pop-in rounded-xl border border-line bg-surface-raised p-1 shadow-2xl shadow-black/50"
            style={{ top: at.top, right: at.right }}
          >
            {openUrl && (
              <a role="menuitem" className={item} href={openUrl} target="_blank" rel="noopener noreferrer" onClick={close}>
                <ExternalLink className="h-4 w-4 text-ink-soft" aria-hidden /> {openLabel}
              </a>
            )}
            {downloadUrl && (
              <a role="menuitem" className={item} href={downloadUrl} target="_blank" rel="noopener noreferrer" onClick={close}>
                <Download className="h-4 w-4 text-ink-soft" aria-hidden /> Download
              </a>
            )}
            <button type="button" role="menuitem" className={item} onClick={() => (onCopy(), close())}>
              <Copy className="h-4 w-4 text-ink-soft" aria-hidden /> Copy link
            </button>
          </div>,
          document.body,
        )}
    </span>
  );
}
