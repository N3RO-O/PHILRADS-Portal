import { useEffect, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ChartColumn,
  ChevronRight,
  Crown,
  FileSpreadsheet,
  FolderKanban,
  FolderOpen,
  Gift,
  KeyRound,
  LifeBuoy,
  Lock,
  Map,
  MessagesSquare,
  Printer,
  RefreshCw,
  Smartphone,
  Sparkles,
  ToggleRight,
  UserRound,
  UsersRound,
  Volume2,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionKey } from '../../config/permissions';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useWhatsNew, whatsNew, type Release } from '../../lib/whatsNew';
import { useAuth } from '../auth/AuthProvider';
import { useBackdropClose } from '../ui/Sheet';

const ICONS: Record<string, LucideIcon> = {
  bell: Bell,
  calendar: CalendarDays,
  chart: ChartColumn,
  crown: Crown,
  'file-spreadsheet': FileSpreadsheet,
  folder: FolderOpen,
  gift: Gift,
  kanban: FolderKanban,
  'key-round': KeyRound,
  'life-buoy': LifeBuoy,
  lock: Lock,
  map: Map,
  messages: MessagesSquare,
  printer: Printer,
  smartphone: Smartphone,
  sparkles: Sparkles,
  'toggle-right': ToggleRight,
  user: UserRound,
  users: UsersRound,
  volume: Volume2,
};
const DAY = new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const dayOf = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));

/**
 * The What's new popup. Before an update ("update"): what the new version brings, with Update now
 * and Later. After one, or from the bell or account menu ("notes"): what changed, with links to it.
 */
export function WhatsNew() {
  const { view } = useWhatsNew();
  const { can } = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const ref = useRef<HTMLDialogElement>(null);
  const backdrop = useBackdropClose(ref, whatsNew.close);

  // Updated since the notes last seen here (they reopened the app on a new version): show them once.
  useEffect(() => {
    if (!whatsNew.updatedSinceSeen) return;
    const t = setTimeout(() => whatsNew.showNotes(), 900);
    return () => clearTimeout(t);
    // Only on first load: `seen` changes when the notes are closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (view && !el.open) el.showModal();
    if (!view && el.open) el.close();
  }, [view]);

  const updating = view?.mode === 'update';
  // Only what this person can use (a permission an older version doesn't know counts as no).
  const releases: Release[] = (view?.releases ?? [])
    .map((r) => ({ ...r, items: r.items.filter((i) => !i.permission || can(i.permission as PermissionKey)) }))
    .filter((r) => r.items.length);
  const lead = releases[0];
  let n = 0;

  return (
    <dialog
      ref={ref}
      aria-labelledby="whats-new-title"
      onClose={() => view && whatsNew.close()}
      {...backdrop.handlers}
      className="popover w-[min(34rem,calc(100vw-1.5rem))] animate-pop-in overflow-hidden p-0 text-ink backdrop:animate-fade-in backdrop:bg-black/65"
    >
      {view && (
        <div className="flex max-h-[min(44rem,calc(100dvh-2rem))] flex-col">
          {/* Header: a soft orange glow behind the gift */}
          <div className="relative shrink-0 overflow-hidden border-b border-line/70 px-6 pb-5 pt-6">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-uplift/25 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <span className="icon-chip h-12 w-12 animate-pop-in rounded-xl" style={{ '--glow': 'rgba(236, 149, 42, 0.38)' } as CSSProperties}>
                {updating ? <RefreshCw className="h-6 w-6 text-uplift" aria-hidden /> : <Gift className="h-6 w-6 text-uplift" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-uplift">{updating ? 'Update ready' : 'What’s new'}</p>
                <h2 id="whats-new-title" className="mt-1 text-lg font-bold leading-snug text-balance">
                  {lead ? lead.title : 'A new version of the portal'}
                </h2>
                {lead && <p className="mt-0.5 text-xs text-muted">{dayOf(lead.date)}
                    {releases.length > 1 && ` · plus ${releases.length - 1} earlier ${releases.length === 2 ? 'update' : 'updates'}`}</p>}
              </div>
              <button type="button" className="icon-btn -mr-2 -mt-2 h-9 w-9" onClick={whatsNew.close} aria-label={updating ? 'Later' : 'Close'}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* The notes */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {releases.length === 0 ? (
              <p className="text-sm text-ink-soft">
                {online ? 'This update brings fixes and improvements.' : 'You’re offline, so the list of changes can’t be shown. You can still update now.'}
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {releases.map((r, ri) => (
                  <section key={r.id} aria-label={r.title} className="flex flex-col gap-3">
                    {ri > 0 && (
                      <h3 className="flex items-baseline justify-between gap-3 border-t border-line/60 pt-4 text-sm font-semibold text-ink">
                        {r.title}
                        <span className="shrink-0 text-xs font-normal text-muted">{dayOf(r.date)}</span>
                      </h3>
                    )}
                    <ul className="flex flex-col gap-1">
                      {r.items.map((i) => {
                        const Icon = ICONS[i.icon] ?? Sparkles;
                        const go = !updating && i.path;
                        const body = (
                          <>
                            <span className="icon-chip h-9 w-9">
                              <Icon className="h-[1.05rem] w-[1.05rem] text-ink" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-ink">{i.title}</span>
                              <span className="block text-[0.8125rem] leading-snug text-ink-soft">{i.body}</span>
                            </span>
                            {go && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />}
                          </>
                        );
                        return (
                          <li key={i.title} className="animate-fade-up" style={{ animationDelay: `${Math.min(n++, 10) * 55 + 120}ms` }}>
                            {go ? (
                              <button
                                type="button"
                                className="group flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                                onClick={() => {
                                  whatsNew.close();
                                  navigate(i.path!);
                                }}
                              >
                                {body}
                              </button>
                            ) : (
                              <div className="flex items-start gap-3 px-2 py-2.5">{body}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-line/70 px-6 py-4">
            {updating ? (
              <>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost flex-1" onClick={whatsNew.close}>
                    Later
                  </button>
                  <button type="button" className="btn-primary flex-[2]" onClick={whatsNew.update} data-autofocus>
                    <RefreshCw className="h-4 w-4" aria-hidden /> Update now
                  </button>
                </div>
                <p className="text-center text-xs text-muted">Save any open work first: the portal restarts to update.</p>
              </>
            ) : (
              <button type="button" className="btn-primary w-full" onClick={whatsNew.close} data-autofocus>
                Got it
              </button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
