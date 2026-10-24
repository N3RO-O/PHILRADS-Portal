import { useCallback, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDismiss } from '../../hooks/useDismiss';
import { formatDayHeading, formatTime } from '../../lib/format';
import { useLiveRefresh } from '../../lib/imsActions';
import { dashboardService } from '../../services';
import type { NotificationItem } from '../../types';
import { LoadError, Skeleton } from '../ui/Card';
import { SampleBadge } from '../ui/SampleBadge';

/**
 * The bell: in-portal notices, including what's new in PHILRADS IMS (releases waiting for
 * approval, new items, stock received or released). Checks for new ones every minute.
 * Nothing here is emailed; the IMS sends its own emails.
 */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const navigate = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, wrap, close, button);
  const notes = useAsyncData(() => dashboardService.getNotifications());
  useLiveRefresh(!open, notes.reload);
  const unread = notes.status === 'success' ? notes.data.filter((n) => !n.read) : [];

  const markRead = async (ids: string[]) => {
    try {
      await dashboardService.markNotificationsRead(ids);
      notes.reload();
    } catch {
      /* stays unread; the next refresh shows the real state */
    }
  };
  const openNote = (n: NotificationItem) => {
    if (!n.read) void markRead([n.id]);
    if (n.linkPath) {
      setOpen(false);
      navigate(n.linkPath);
    }
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        className="icon-btn relative"
        aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        {unread.length > 0 && (
          <span
            className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose px-1 text-[0.625rem] font-bold leading-none text-white ring-2 ring-page"
            aria-hidden
          >
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} className="popover absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] origin-top-right animate-pop-in p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              Notifications {dashboardService.source === 'mock' && <SampleBadge />}
            </p>
            {unread.length > 0 && (
              <button type="button" className="link" onClick={() => void markRead(unread.map((n) => n.id))}>
                <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark all read
              </button>
            )}
          </div>
          {notes.status === 'loading' && <Skeleton className="h-24" />}
          {notes.status === 'error' && <LoadError message={notes.error.message} onRetry={notes.reload} />}
          {notes.status === 'success' &&
            (notes.data.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">You’re all caught up.</p>
            ) : (
              <ul className="flex max-h-[min(28rem,70dvh)] flex-col overflow-y-auto">
                {notes.data.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNote(n)}
                      className="tap flex w-full gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-uplift'}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.read ? 'text-ink-soft' : 'font-medium text-ink'}`}>
                          {n.title}
                          {!n.read && <span className="sr-only"> (unread)</span>}
                        </span>
                        {n.body && <span className="block text-xs text-muted">{n.body}</span>}
                        <span className="block text-xs text-muted">
                          {formatDayHeading(n.createdAt)}, {formatTime(n.createdAt)}
                        </span>
                      </span>
                      {n.linkPath && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}
    </div>
  );
}
