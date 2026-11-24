import { useState, type ReactNode } from 'react';
import { Check, Copy, Share2, type LucideIcon } from 'lucide-react';

/**
 * A guest screen's content: the page header above it (in GuestPage) carries the title, so this is
 * the one line on what it is, then the content. `title` names the section for screen readers.
 */
export function GuestSection({ id, title, lead, aside, children }: { id: string; title: string; lead?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-label={title}>
      {(lead || aside) && (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          {lead && <div className="max-w-prose text-sm text-ink-soft">{lead}</div>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Copies the text, then says so for a moment. */
export function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      /* the text stays on screen to copy by hand */
    }
  };
  return (
    <button type="button" className={`chip gap-1.5 ${className}`} onClick={() => void copy()} aria-live="polite">
      {done ? <Check className="h-3.5 w-3.5 text-status-in" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {done ? 'Copied' : label}
    </button>
  );
}

/** The phone's share sheet where there is one; otherwise copies the link. */
export function ShareButton({ title, path, className = '' }: { title: string; path: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* closed the share sheet */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* nothing to do */
    }
  };
  return (
    <button type="button" className={`chip gap-1.5 ${className}`} onClick={() => void share()} aria-live="polite">
      {copied ? <Check className="h-3.5 w-3.5 text-status-in" aria-hidden /> : <Share2 className="h-3.5 w-3.5" aria-hidden />}
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}

/** A picture, or the brand's burgundy with an icon where there is none yet. */
export function Picture({ src, alt, icon: Icon, className = '' }: { src: string | null; alt: string; icon: LucideIcon; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)} className={`object-cover ${className}`} />;
  return (
    <div className={`grid place-items-center bg-gradient-to-br from-burgundy-500 to-burgundy-800 text-cloud/80 ${className}`} role="img" aria-label={alt}>
      <Icon className="h-8 w-8" strokeWidth={1.5} aria-hidden />
    </div>
  );
}

/** Loading rows while a section's data comes in. */
export function RowsLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16" />
      ))}
    </div>
  );
}

/** What went wrong, and a way to try again. */
export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="notice flex flex-wrap items-center justify-between gap-3">
      <span className="text-ink-soft">{message}</span>
      <button type="button" className="chip" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
