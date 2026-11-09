import { useSmoothNavigate } from '../../lib/smoothNavigate';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing, Check, CheckCheck, Gift, Hand, MoreHorizontal, Package, Smartphone, SquareCheckBig, Sun, ThumbsUp, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { disablePush, enablePush, pushEnabled, pushSupported } from '../../lib/push';
import type { PermissionKey } from '../../config/permissions';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDismiss } from '../../hooks/useDismiss';
import { formatTime } from '../../lib/format';
import { useLiveRefresh } from '../../lib/imsActions';
import { RELEASES, useWhatsNew, whatsNew } from '../../lib/whatsNew';
import { dashboardService } from '../../services';
import type { NotificationItem } from '../../types';
import { LoadError, Skeleton } from '../ui/Card';
import { SampleBadge } from '../ui/SampleBadge';
import { useAuth } from '../auth/AuthProvider';
import { useOnboarding } from '../onboarding/OnboardingProvider';

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
  const navigate = useSmoothNavigate();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, wrap, close, button);
  const notes = useAsyncData(() => dashboardService.getNotifications());
  useLiveRefresh(!open, notes.reload);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [more, setMore] = useState(false);
  const [phone, setPhone] = useState<'on' | 'off' | 'busy'>('off');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const onboarding = useOnboarding();
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
      if (!err) onboarding.complete('notify');
      setPhoneError(err);
      setPhone(err ? 'off' : 'on');
    }
  };
  const { can } = useAuth();
  const news = useWhatsNew();
  const allowed = (items: (typeof RELEASES)[number]['items']) => items.filter((i) => !i.permission || can(i.permission as PermissionKey));
  const NEWS = 'portal-whats-new-';
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
    // Every version's news, one note each (newest first), with its version number.
    ...RELEASES.map((r) => ({
      id: `${NEWS}${r.id}`,
      title: `${r.version ? `Version ${r.version}: ` : 'What’s new: '}${r.title}`,
      body: allowed(r.items)
        .slice(0, 3)
        .map((i) => i.title)
        .join(' · '),
      createdAt: `${r.date}T08:00:00+08:00`,
      read: news.read.includes(r.id) || whatsNew.isRead(r.id),
      portal: () => (whatsNew.markRead([r.id]), whatsNew.showNotes([r])),
    })),
  ];
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(readHidden()));
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const list: Note[] = (notes.status === 'success' ? [...portal, ...notes.data].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) : portal).filter(
    (n) => !hidden.has(n.id) && !gone.has(n.id),
  );
  // Delete: gone from the list at once; the server catches up (it comes back if that fails).
  const remove = async (ids: string[]) => {
    const local = ids.filter((id) => id.startsWith('portal-'));
    if (local.length) {
      const next = new Set([...hidden, ...local]);
      setHidden(next);
      writeHidden([...next]);
      const releases = local.filter((id) => id.startsWith(NEWS)).map((id) => id.slice(NEWS.length));
      if (releases.length) whatsNew.markRead(releases);
    }
    const server = ids.filter((id) => !id.startsWith('portal-'));
    if (!server.length) return;
    setGone((g) => new Set([...g, ...server]));
    try {
      await dashboardService.deleteNotifications(server);
      notes.reload();
    } catch {
      setGone((g) => new Set([...g].filter((id) => !server.includes(id))));
    }
  };
  const unread = list.filter((n) => !n.read);

  const markRead = async (ids: string[]) => {
    const releases = ids.filter((id) => id.startsWith(NEWS)).map((id) => id.slice(NEWS.length));
    if (releases.length) whatsNew.markRead(releases);
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
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink/[0.05] disabled:opacity-50"
                    disabled={!unread.length}
                    onClick={() => (void markRead(unread.map((n) => n.id)), setMore(false))}
                  >
                    <CheckCheck className="h-4 w-4" aria-hidden /> Mark all as read
                  </button>
                  {pushSupported() && (
                    <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink/[0.05]" disabled={phone === 'busy'} onClick={() => void togglePhone()}>
                      <Smartphone className="h-4 w-4" aria-hidden />
                      <span className="flex-1">Phone notifications</span>
                      <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${phone === 'on' ? 'bg-status-in/15 text-status-in' : 'bg-ink/[0.06] text-muted'}`}>
                        {phone === 'busy' ? '…' : phone === 'on' ? 'On' : 'Off'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink/[0.05]"
                    onClick={() => {
                      setOpen(false);
                      navigate('/tasks?view=myday');
                    }}
                  >
                    <Sun className="h-4 w-4" aria-hidden /> Open today’s tasks
                  </button>
                  {confirmClear ? (
                    <div className="flex items-center gap-2 rounded-xl bg-status-out/10 px-3 py-2">
                      <span className="flex-1 text-xs text-ink">Delete all notifications?</span>
                      <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:text-ink" onClick={() => setConfirmClear(false)}>
                        Keep them
                      </button>
                      <button type="button" className="rounded-lg bg-status-out/80 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => (void remove(list.map((n) => n.id)), setConfirmClear(false), setMore(false))}>
                        Delete all
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-status-out hover:bg-status-out/10 disabled:opacity-50" disabled={!list.length} onClick={() => setConfirmClear(true)}>
                      <Trash2 className="h-4 w-4" aria-hidden /> Clear all
                    </button>
                  )}
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
                className={`press rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${tab === t ? 'text-ink-soft' : 'bg-ink/[0.07] text-ink-soft hover:bg-ink/[0.1]'}`}
              >
                {t === 'all' ? 'All' : `Unread${unread.length ? ` (${unread.length})` : ''}`}
              </button>
            ))}
          </div>
          {notes.status === 'loading' && <Skeleton className="mx-3 mt-3 h-24" />}
          {notes.status === 'error' && <LoadError message={notes.error.message} onRetry={notes.reload} />}
          {notes.status === 'success' && <NoteGroups list={tab === 'unread' ? list.filter((n) => !n.read) : list} unreadTab={tab === 'unread'} onOpen={openNote} onRead={(n) => void markRead([n.id])} onDelete={(n) => void remove([n.id])} onMyDay={() => (setOpen(false), navigate('/tasks?view=myday'))} />}
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
  if (n.portal) return { icon: Gift, tint: 'text-ink-soft' };
  if (t.includes('nudged')) return { icon: BellRing, tint: 'text-ink-soft' };
  if (t.includes('accepted') || t.includes('kudos')) return { icon: ThumbsUp, tint: 'text-ink-soft' };
  if (t.includes('declined') || t.includes('sent back')) return { icon: Hand, tint: 'text-ink-soft' };
  if (t.includes('task') || t.includes('gave you') || t.includes('asks you')) return { icon: SquareCheckBig, tint: 'text-ink-soft' };
  if (t.includes('stock') || t.includes('release') || t.includes('item')) return { icon: Package, tint: 'text-ink-soft' };
  return { icon: Bell, tint: 'text-ink-soft' };
};

function NoteGroups({ list, unreadTab, onOpen, onRead, onDelete, onMyDay }: { list: Note[]; unreadTab: boolean; onOpen: (n: Note) => void; onRead: (n: Note) => void; onDelete: (n: Note) => void; onMyDay: () => void }) {
  if (list.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <CheckCheck className="h-7 w-7 text-status-in" aria-hidden />
        <p className="text-sm font-semibold text-ink">{unreadTab ? 'Nothing unread' : 'You’re all caught up'}</p>
        <p className="max-w-[16rem] text-xs text-muted">Tasks given to you, nudges and news from the IMS show here.</p>
        <button type="button" className="btn-ghost mt-1 min-h-9 px-4 text-xs" onClick={onMyDay}>
          Open today’s tasks
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
                <SwipeRow key={n.id} index={i} onDelete={() => onDelete(n)} menu={<NoteMenu note={n} onRead={() => onRead(n)} onDelete={() => onDelete(n)} />}>
                  <button type="button" onClick={() => onOpen(n)} className={`press flex w-full items-center gap-3 rounded-xl py-2.5 pl-3 pr-11 text-left transition-colors hover:bg-ink/[0.05] bg-surface-raised`}>
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${k.tint}`}>
                      <k.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`line-clamp-2 text-sm leading-snug ${n.read ? 'text-ink-soft' : 'font-semibold text-ink'}`}>
                        {n.title}
                        {!n.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      {n.body && <span className="line-clamp-1 text-xs text-muted">{n.body}</span>}
                      <span className={`text-xs ${n.read ? 'text-muted' : 'font-semibold text-ink'}`} title={formatTime(n.createdAt)}>
                        {ago(n.createdAt)}
                      </span>
                    </span>
                    {!n.read && (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ink" title="Unread">
                        <span className="sr-only">Unread</span>
                      </span>
                    )}
                  </button>
                </SwipeRow>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const HIDDEN_KEY = 'philrads.notes.hidden';
const readHidden = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};
const writeHidden = (ids: string[]) => {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids.slice(-50)));
  } catch {
    /* this visit only */
  }
};

/**
 * A notification you can swipe left to delete (phones): it follows the finger over a red Delete
 * area and slides away past the mark. Its own ... menu does the same with a mouse.
 */
function SwipeRow({ index, onDelete, menu, children }: { index: number; onDelete: () => void; menu: ReactNode; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const start = useRef<{ x: number; y: number; locked: 'x' | 'y' | null } | null>(null);
  const THRESHOLD = 96;
  const finish = () => {
    if (!start.current) return;
    start.current = null;
    if (dx <= -THRESHOLD) {
      setLeaving(true);
      setDx(-480);
      navigator.vibrate?.(15);
      setTimeout(onDelete, 260);
    } else setDx(0);
  };
  return (
    <li
      className="relative animate-fade-up overflow-hidden rounded-xl"
      style={{ animationDelay: `${Math.min(index, 8) * 35}ms`, maxHeight: leaving ? 0 : 200, opacity: leaving ? 0 : 1, transition: leaving ? 'max-height 260ms 120ms ease, opacity 200ms 120ms ease' : undefined }}
    >
      {/* Only the strip the note uncovers turns red (the note itself is see-through), with what letting go will do. */}
      {dx < 0 && (
        <span
          aria-hidden
          className={`absolute inset-y-0 right-0 flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl text-sm font-semibold text-white transition-colors ${dx <= -THRESHOLD ? 'bg-status-out' : 'bg-status-out/70'}`}
          style={{ width: -dx }}
        >
          <Trash2 className={`h-5 w-5 shrink-0 transition-transform ${dx <= -THRESHOLD ? 'scale-125' : ''}`} />
          {-dx >= THRESHOLD && 'Delete'}
        </span>
      )}
      <div
        className="relative"
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? 'none' : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        onTouchStart={(e) => (start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null })}
        onTouchMove={(e) => {
          const s = start.current;
          if (!s) return;
          const mx = e.touches[0].clientX - s.x;
          const my = e.touches[0].clientY - s.y;
          // Decide once whether this is a swipe or a scroll.
          if (!s.locked) s.locked = Math.abs(mx) > Math.abs(my) + 4 ? 'x' : Math.abs(my) > 6 ? 'y' : null;
          if (s.locked === 'x') setDx(Math.min(0, mx));
        }}
        onTouchEnd={finish}
        onTouchCancel={finish}
      >
        {children}
        {dx === 0 && <span className="absolute right-2 top-1/2 -translate-y-1/2">{menu}</span>}
      </div>
    </li>
  );
}

/** The three dots on one notification: mark as read, or delete it. */
function NoteMenu({ note, onRead, onDelete }: { note: Note; onRead: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState<{ top: number; right: number } | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node) && setOpen(null);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  return (
    <span ref={wrap} className="relative block">
      <button
        type="button"
        className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface-raised text-muted opacity-100 shadow-md transition hover:text-ink sm:opacity-0 sm:group-hover/note:opacity-100 sm:focus-visible:opacity-100 [li:hover_&]:opacity-100"
        aria-label={`Options for: ${note.title}`}
        aria-expanded={Boolean(open)}
        onClick={(e) => {
          e.stopPropagation();
          // Floats over the panel (the row itself clips, for swiping).
          const r = e.currentTarget.getBoundingClientRect();
          setOpen((o) => (o ? null : { top: r.bottom + 4, right: window.innerWidth - r.right }));
        }}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open &&
        createPortal(
        <span ref={pop} data-popover-child className="fixed z-[70] block w-48 origin-top-right animate-pop-in rounded-xl border border-line bg-surface-raised p-1 shadow-2xl shadow-black/60" style={{ top: open.top, right: open.right }}>
          {!note.read && (
            <button type="button" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink/[0.06]" onClick={() => (onRead(), setOpen(null))}>
              <Check className="h-4 w-4" aria-hidden /> Mark as read
            </button>
          )}
          <button type="button" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-status-out hover:bg-status-out/10" onClick={() => (onDelete(), setOpen(null))}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </button>
        </span>,
        document.body,
      )}
    </span>
  );
}
