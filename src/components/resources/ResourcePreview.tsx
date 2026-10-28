import { useEffect, useId, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, X } from 'lucide-react';
import { LINK_KIND_LABEL, parseResourceLink, withGoogleAccount } from '../../lib/resourceLinks';
import type { Resource } from '../../services/resources/types';
import { useBackdropClose } from '../ui/Sheet';
import { FolderBrowser } from './FolderBrowser';

interface Props {
  /** The resource to show, or null when the preview is closed. */
  resource: Resource | null;
  /** The viewer's portal email: Google shows the file as that account when it's signed in. */
  googleAccount?: string | null;
  onClose: () => void;
}

/**
 * Shows a Google Drive file, folder, Doc, Sheet or Slides inside the portal, using Google's own
 * viewer, with "Open in Drive" for everything the viewer can't do (editing, comments, sharing).
 * Full screen on phones, a large window from md up. Built on <dialog> like Sheet.
 */
export function ResourcePreview({ resource, googleAccount, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const backdrop = useBackdropClose(ref, onClose);
  const [loaded, setLoaded] = useState(false);
  const link = resource ? parseResourceLink(resource.url) : null;
  const open = Boolean(resource && link?.previewUrl);
  const asViewer = (url: string) => withGoogleAccount(url, googleAccount);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => setLoaded(false), [link?.previewUrl]);
  // Google's own folder view, when the portal can't list a folder (not shared with its account).
  const [googleView, setGoogleView] = useState(false);
  useEffect(() => setGoogleView(false), [resource?.id]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape closes the dialog natively; it also reports "closed" after `resource` went null, so ignore that.
      onClose={() => open && onClose()}
      {...backdrop.handlers}
      className="fixed inset-0 m-0 flex h-dvh max-h-none w-full max-w-none animate-fade-in flex-col bg-page p-0 text-ink backdrop:animate-fade-in backdrop:bg-black/70 md:m-auto md:h-[90dvh] md:w-[min(72rem,92vw)] md:animate-pop-in md:overflow-hidden md:rounded-3xl md:border md:border-line/70 md:glass [&:not([open])]:hidden"
    >
      {resource && link?.previewUrl && (
        <>
          <header className="flex shrink-0 items-center gap-2 border-b border-line/70 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:gap-3 sm:px-5 md:pt-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate font-semibold leading-tight">
                {resource.title}
              </h2>
              <p className="truncate text-xs text-muted">
                {resource.kind === 'drive_file' && resource.fileType ? `${resource.fileType} in Google Drive` : LINK_KIND_LABEL[link.kind]} · {resource.category}
              </p>
            </div>
            {link.downloadUrl && (
              <a className="icon-btn shrink-0" href={asViewer(link.downloadUrl)} target="_blank" rel="noopener noreferrer" aria-label="Download" title="Download">
                <Download className="h-5 w-5" aria-hidden />
              </a>
            )}
            <a className="btn-primary min-h-10 shrink-0 px-3 text-sm" href={asViewer(link.openUrl)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Open in</span> Drive
            </a>
            <button type="button" className="icon-btn -mr-1 shrink-0" onClick={onClose} aria-label="Close preview">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>
          {link.kind === 'drive_folder' && !googleView ? (
            // Folders: browsed in the portal (views, choose files, download), Google's view as a fallback.
            <FolderBrowser resource={resource} onFallback={() => setGoogleView(true)} />
          ) : (
          <div className="relative min-h-0 flex-1 bg-white">
            {!loaded && (
              <div className="absolute inset-0 grid place-items-center bg-page text-sm text-muted" aria-hidden>
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading preview…
                </span>
              </div>
            )}
            <iframe
              key={link.previewUrl}
              src={asViewer(link.previewUrl)}
              title={`Preview of ${resource.title}`}
              className="h-full w-full border-0"
              allow="autoplay; fullscreen"
              onLoad={() => setLoaded(true)}
            />
          </div>
          )}
          {/* Google's viewer can't tell the portal it failed (wrong account, not shared), so say what to do. */}
          {(link.kind !== 'drive_folder' || googleView) && (
          <p className="shrink-0 border-t border-line/70 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 text-xs text-muted sm:px-5">
            Seeing a sign-in page or “You need access”? Sign in to Google with your PHILRADS account
            {googleAccount ? ` (${googleAccount})` : ''}, or use{' '}
            <a className="link" href={asViewer(link.openUrl)} target="_blank" rel="noopener noreferrer">
              Open in Drive
            </a>
            .
          </p>
          )}
        </>
      )}
    </dialog>
  );
}
