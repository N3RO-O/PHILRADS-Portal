import { useCallback, useId, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDismiss } from '../../hooks/useDismiss';
import { formatDayHeading, formatTime } from '../../lib/format';
import { dashboardService } from '../../services';
import { LoadError, Skeleton } from '../ui/Card';
import { SampleBadge } from '../ui/SampleBadge';

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, wrap, close, button);
  const notes = useAsyncData(() => dashboardService.getNotifications());
  const unread = notes.status === 'success' ? notes.data.filter((n) => !n.read).length : 0;

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        className="icon-btn relative"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-uplift ring-2 ring-white" aria-hidden />}
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/5">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            Notifications {dashboardService.source === 'mock' && <SampleBadge />}
          </p>
          {notes.status === 'loading' && <Skeleton className="h-24" />}
          {notes.status === 'error' && <LoadError message={notes.error.message} onRetry={notes.reload} />}
          {notes.status === 'success' &&
            (notes.data.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">You’re all caught up.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {notes.data.map((n) => (
                  <li key={n.id} className="flex gap-3 rounded-2xl px-2 py-2.5 hover:bg-cloud">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-black/10' : 'bg-uplift'}`} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {n.title}
                        {!n.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      {n.body && <span className="block text-xs text-muted">{n.body}</span>}
                      <span className="block text-xs text-muted">
                        {formatDayHeading(n.createdAt)}, {formatTime(n.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
    </div>
  );
}
