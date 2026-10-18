import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import type { DataSource } from '../../types';
import { SampleBadge } from './SampleBadge';

interface CardProps {
  id?: string;
  title?: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  source?: DataSource;
  className?: string;
  children: ReactNode;
}

export function Card({ id, title, note, action, source, className = '', children }: CardProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={`card flex scroll-mt-24 flex-col gap-4 ${className}`}>
      {title && (
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={headingId} className="card-title flex flex-wrap items-center gap-2">
              {title}
              {source === 'mock' && <SampleBadge />}
            </h2>
            {note && <p className="card-note">{note}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl bg-cloud px-4 py-6 text-center text-sm">
      <p className="flex items-center gap-2 text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-burgundy" aria-hidden />
        {message}
      </p>
      <button type="button" onClick={onRetry} className="link">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
      </button>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}
