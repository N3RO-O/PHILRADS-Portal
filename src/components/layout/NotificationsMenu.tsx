import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, Gift, Hand, MoreHorizontal, Package, Smartphone, SquareCheckBig, Sun, ThumbsUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { disablePush, enablePush, pushEnabled, pushSupported } from '../../lib/push';
import type { PermissionKey } from '../../config/permissions';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDismiss } from '../../hooks/useDismiss';
import { formatTime } from '../../lib/format';
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
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [more, setMore] = useState(false);
  const [phone, setPhone] = useState<'on' | 'off' | 'busy'>('off');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  useEffect(() => {
    const again = () => notes.reload();
    window.addEventListener('philrads:notification', again);
    return () => window.removeEventListener('philrads:notification', again);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (open) void pushEnabled().then((on) => setPhone(on ? 'on' : 'off'));
    else setMore(false);
  }, [open]);
  const togglePhone = async () => {
    setPhone('busy');
    setPhoneError(null);
    if (phone === 'on') {
      await disablePush().catch(() => undefined);
      setPhone('off');
    } else {
      const err = await enablePush();
      setPhoneError(err);
      setPhone(err ? 'off' : 'on');
    }
  };
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
          className="popover fixed inset-x-3 top-16 z-50 flex max-h-[min(40rem,82dvh)] origin-top animate-pop-in flex-col !bg-surface-raised/[0.97] px-2 pb-2 pt-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[24rem] sm:origin-top-right"
        >
          <div className="flex items-center justify-between gap-2 px-3">
            <p className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink">
              Notifications {dashboardService.source === 'mock' && <SampleBadge />}
            </p>
            <div className="relative">
              <button type="button" className="icon-btn h-9 w-9 rounded-full" aria-label="Notification options" aria-expanded={more} onClick={() => setMore((m) => !m)}>
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </button>
              {more && (
                <div className="absolute right-0 top-10 z-10 w-64 origin-top-right animate-pop-in rounded-2xl border border-line bg-surface-raised p-1.5 shadow-2xl shadow-black/50">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/[0.05] disabled:opacity-50"
                    disabled={!unread.length}
                    onClick={() => (void markRead(unread.map((n) => n.id)), setMore(false))}
                  >
                    <CheckCheck className="h-4 w-4 text-uplift" aria-hidden /> Mark all as read
                  </button>
                  {pushSupported() && (
                    <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/[0.05]" disabled={phone === 'busy'} onClick={() => void togglePhone()}>
                      <Smartphone className="h-4 w-4 text-uplift" aria-hidden />
                      <span className="flex-1">Phone notifications</span>
                      <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${phone === 'on' ? 'bg-status-in/15 text-status-in' : 'bg-white/[0.06] text-muted'}`}>
                        {phone === 'busy' ? '…' : phone === 'on' ? 'On' : 'Off'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/[0.05]"
                    onClick={() => {
                      setOpen(false);
                      navigate('/tasks?view=myday');
                    }}
                  >
                    <Sun className="h-4 w-4 text-uplift" aria-hidden /> Open My Day
                  </button>
                  {phoneError && <p className="px-3 pb-2 pt-1 text-xs text-rose">{phoneError}</p>}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex gap-2 px-3" role="tablist" aria-label="Show">
            {(['all', 'unread'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`press rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${tab === t ? 'bg-uplift/20 text-uplift' : 'bg-white/[0.07] text-ink-soft hover:bg-white/[0.1]'}`}
              >
                {t === 'all' ? 'All' : `Unread${unread.length ? ` (${unread.length})` : ''}`}
              </button>
            ))}
          </div>
          {notes.status === 'loading' && <Skeleton className="mx-3 mt-3 h-24" />}
          {notes.status === 'error' && <LoadError message={notes.error.message} onRetry={notes.reload} />}
          {notes.status === 'success' && <NoteGroups list={tab === 'unread' ? unread : list} unreadTab={tab === 'unread'} onOpen={openNote} onMyDay={() => (setOpen(false), navigate('/tasks?view=myday'))} />}
        </div>
      )}
    </div>
  );
}

const startOfToday = () => {
  const d = new Date(Date.now() + 8 * 3600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 8 * 3600_000;
};
/** "5m", "3h", "Yesterday", "Mon", "Oct 28". */
const ago = (iso: string) => {
  const ms = Date.now() - Date.parse(iso);
  if (ms < 60_000) return 'now';
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m`;
  if (Date.parse(iso) >= startOfToday()) return `${Math.floor(ms / 3600_000)}h`;
  if (ms < 7 * 86_400_000) return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' });
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
};
/** A picture for each kind of note, from what it says. */
const kindOf = (n: Note): { icon: LucideIcon; tint: string } => {
  const t = n.title.toLowerCase();
  if (n.portal) return { icon: Gift, tint: 'bg-uplift/20 text-uplift' };
  if (t.includes('nudged')) return { icon: BellRing, tint: 'bg-uplift/20 text-uplift' };
  if (t.includes('accepted') || t.includes('kudos')) return { icon: ThumbsUp, tint: 'bg-status-in/20 text-status-in' };
  if (t.includes('declined') || t.includes('sent back')) return { icon: Hand, tint: 'bg-rose/20 text-rose' };
  if (t.includes('task') || t.includes('gave you') || t.includes('asks you')) return { icon: SquareCheckBig, tint: 'bg-sky-400/20 text-sky-300' };
  if (t.includes('stock') || t.includes('release') || t.includes('item')) return { icon: Package, tint: 'bg-violet-400/20 text-violet-300' };
  return { icon: Bell, tint: 'bg-white/10 text-ink-soft' };
};

function NoteGroups({ list, unreadTab, onOpen, onMyDay }: { list: Note[]; unreadTab: boolean; onOpen: (n: Note) => void; onMyDay: () => void }) {
  if (list.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <CheckCheck className="h-7 w-7 text-status-in" aria-hidden />
        <p className="text-sm font-semibold text-ink">{unreadTab ? 'Nothing unread' : 'You’re all caught up'}</p>
        <p className="max-w-[16rem] text-xs text-muted">Tasks given to you, nudges and news from the IMS show here.</p>
        <button type="button" className="btn-ghost mt-1 min-h-9 px-4 text-xs" onClick={onMyDay}>
          Open My Day
        </button>
      </div>
    );
  const today = startOfToday();
  const groups = [
    { label: 'Today', items: list.filter((n) => Date.parse(n.createdAt) >= today) },
    { label: 'Earlier', items: list.filter((n) => Date.parse(n.createdAt) < today) },
  ].filter((g) => g.items.length);
  return (
    <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h3 className="px-3 pb-1 pt-3 text-base font-bold text-ink">{g.label}</h3>
          <ul>
            {g.items.map((n, i) => {
              const k = kindOf(n);
              return (
                <li key={n.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                  <button type="button" onClick={() => onOpen(n)} className={`press flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] ${n.read ? '' : 'bg-uplift/[0.05]'}`}>
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${k.tint}`}>
                      <k.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`line-clamp-2 text-sm leading-snug ${n.read ? 'text-ink-soft' : 'font-semibold text-ink'}`}>
                        {n.title}
                        {!n.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      {n.body && <span className="line-clamp-1 text-xs text-muted">{n.body}</span>}
                      <span className={`text-xs ${n.read ? 'text-muted' : 'font-semibold text-uplift'}`} title={formatTime(n.createdAt)}>
                        {ago(n.createdAt)}
                      </span>
                    </span>
                    {!n.read && <span className="h-3 w-3 shrink-0 rounded-full bg-uplift" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
