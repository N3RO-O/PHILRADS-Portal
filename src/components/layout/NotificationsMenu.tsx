import { useCallback, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight, Gift } from 'lucide-react';
import type { PermissionKey } from '../../config/permissions';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDismiss } from '../../hooks/useDismiss';
import { formatDayHeading, formatTime } from '../../lib/format';
import { useLiveRefresh } from '../../lib/imsActions';
import { CURRENT, useWhatsNew, whatsNew } from '../../lib/whatsNew';
import { dashboardService } from '../../services';
import type { NotificationItem } from '../../types';
import { LoadError, Skeleton } from '../ui/Card';
import { SampleBadge } from '../ui/SampleBadge';
import { useAuth } from '../auth/AuthProvider';

/**
 * The bell: in-portal notices, including what's new in PHILRADS IMS (releases waiting for
 * approval, new items, stock received or released). Checks for new ones every minute.
 * Nothing here is emailed; the IMS sends its own emails. It also carries the portal's own news:
 * an update waiting to be installed, and what's new in this version (both open the What's new popup).
 */
type Note = NotificationItem & { portal?: () => void };

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
  const { can } = useAuth();
  const news = useWhatsNew();
  const newsItems = CURRENT.items.filter((i) => !i.permission || can(i.permission as PermissionKey));
  const portal: Note[] = [
    ...(news.updateReady
      ? [
          {
            id: 'portal-update',
            title: news.incoming?.[0] ? `Update ready: ${news.incoming[0].title}` : 'A new version of the portal is ready',
            body: 'See what’s new, then update.',
            createdAt: new Date().toISOString(),
            read: false,
            portal: whatsNew.showUpdate,
          },
        ]
      : []),
    {
      id: `portal-whats-new-${CURRENT.id}`,
      title: `What’s new: ${CURRENT.title}`,
      body: newsItems
        .slice(0, 3)
        .map((i) => i.title)
        .join(' · '),
      createdAt: `${CURRENT.date}T08:00:00+08:00`,
      read: news.seen === CURRENT.id,
      portal: () => whatsNew.showNotes(),
    },
  ];
  const list: Note[] = notes.status === 'success' ? [...portal, ...notes.data].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) : portal;
  const unread = list.filter((n) => !n.read);

  const markRead = async (ids: string[]) => {
    if (ids.includes(`portal-whats-new-${CURRENT.id}`)) whatsNew.markSeen(CURRENT.id);
    ids = ids.filter((id) => !id.startsWith('portal-'));
    if (!ids.length) return;
    try {
      await dashboardService.markNotificationsRead(ids);
      notes.reload();
    } catch {
      /* stays unread; the next refresh shows the real state */
    }
  };
  const openNote = (n: Note) => {
    if (n.portal) {
      setOpen(false);
      n.portal();
      return;
    }
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
        // Phones: pinned to the screen with even margins (the bell isn't at the edge, so a right-aligned panel spills off the left).
        <div
          id={panelId}
          className="popover fixed inset-x-4 top-16 z-50 origin-top animate-pop-in p-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem] sm:origin-top-right"
        >
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
            (list.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-5 text-center">
                <CheckCheck className="h-6 w-6 text-status-in" aria-hidden />
                <p className="text-sm font-semibold text-ink">You’re all caught up</p>
                <p className="max-w-[16rem] text-xs text-muted">Releases to approve and new stock from the IMS will show here.</p>
                <button
                  type="button"
                  className="btn-ghost mt-1 min-h-9 px-4 text-xs"
                  onClick={() => {
                    setOpen(false);
                    navigate('/tasks?view=myday');
                  }}
                >
                  Open My Day
                </button>
              </div>
            ) : (
              <ul className="flex max-h-[min(28rem,70dvh)] flex-col overflow-y-auto">
                {list.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNote(n)}
                      className="tap flex w-full gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      {n.portal ? (
                        <Gift className={`mt-0.5 h-4 w-4 shrink-0 ${n.read ? 'text-muted' : 'text-uplift'}`} aria-hidden />
                      ) : (
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-uplift'}`} aria-hidden />
                      )}
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
                      {(n.linkPath || n.portal) && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" aria-hidden />}
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
