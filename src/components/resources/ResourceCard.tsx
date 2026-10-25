import { useEffect, useState } from 'react';
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
  Pencil,
  Pin,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import { LINK_KIND_LABEL, parseResourceLink, type LinkKind } from '../../lib/resourceLinks';
import { formatShortInstant } from '../../lib/format';
import type { Resource, ResourceFileType } from '../../services/resources/types';

const TYPE_ICON: Record<ResourceFileType, LucideIcon> = {
  PDF: FileText,
  Word: FileText,
  Excel: FileSpreadsheet,
  PowerPoint: Presentation,
  Image: FileImage,
  Video: FileVideo,
  Folder: Folder,
  'Web page': Globe,
};
const KIND_ICON: Record<LinkKind, LucideIcon> = {
  drive_file: FileText,
  drive_folder: Folder,
  google_doc: FileText,
  google_sheet: FileSpreadsheet,
  google_slides: Presentation,
  web: Globe,
};
const TYPE_TONE: Partial<Record<ResourceFileType, string>> = {
  PDF: 'bg-status-out/10 text-status-out',
  Word: 'bg-sky-300/10 text-sky-300',
  Excel: 'bg-status-in/10 text-status-in',
  PowerPoint: 'bg-uplift/10 text-uplift',
  Folder: 'bg-status-low/10 text-status-low',
};

async function copy(text: string) {
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
}

/** One resource: what it is, where it lives, and one-tap Preview (or Open) / Download / Copy link. */
export function ResourceCard({ resource: r, canManage, onEdit, onPreview }: Props) {
  const link = parseResourceLink(r.url);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const Icon = r.fileType ? TYPE_ICON[r.fileType] : KIND_ICON[r.kind];
  const tone = (r.fileType && TYPE_TONE[r.fileType]) || 'bg-white/5 text-ink-soft';
  const source = r.kind === 'drive_file' && r.fileType ? `${r.fileType} in Google Drive` : LINK_KIND_LABEL[r.kind];
  const action = 'btn-ghost min-h-11 flex-1 px-3 text-xs sm:flex-none';

  return (
    <li className="tile flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-start gap-1.5 font-semibold leading-snug text-ink">
            {r.pinned && <Pin className="mt-1 h-3.5 w-3.5 shrink-0 text-uplift" aria-label="Pinned" />}
            <span className="min-w-0">{r.title}</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {source} · {r.category}
          </p>
        </div>
        {canManage && (
          <button type="button" className="icon-btn -mr-2 -mt-1 h-10 w-10" onClick={() => onEdit(r)} aria-label={`Edit ${r.title}`}>
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {r.description && <p className="line-clamp-2 text-sm text-ink-soft">{r.description}</p>}
      <p className="text-[0.6875rem] text-muted">
        Updated {formatShortInstant(r.updatedAt)} · added by {r.addedByName}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        {link?.previewUrl ? (
          <button type="button" className={`${action} border-uplift/40 text-uplift`} onClick={() => onPreview(r)}>
            <Eye className="h-4 w-4" aria-hidden /> Preview
          </button>
        ) : (
          <a className={`${action} border-uplift/40 text-uplift`} href={link?.openUrl ?? r.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" aria-hidden /> Open
          </a>
        )}
        {link?.downloadUrl && (
          <a className={action} href={link.downloadUrl} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" aria-hidden /> Download
          </a>
        )}
        <button type="button" className={action} onClick={async () => setCopied((await copy(link?.openUrl ?? r.url)) ? 'ok' : 'failed')}>
          {copied === 'ok' ? <Check className="h-4 w-4 text-status-in" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied === 'ok' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy link'}
        </button>
      </div>
    </li>
  );
}
