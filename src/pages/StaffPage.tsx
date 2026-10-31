import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Loader2, MailPlus, RotateCw, Search, UsersRound, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { useOnboarding } from '../components/onboarding/OnboardingProvider';
import { InviteSheet } from '../components/staff/InviteSheet';
import { EmptyState, LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { SwipeToArchive } from '../components/ui/SwipeToArchive';
import { LeavingRow, useLeaving } from '../components/ui/LeavingRow';
import { useAsyncData } from '../hooks/useAsyncData';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatNumber, formatShortInstant } from '../lib/format';
import { staffService } from '../services';
import { STAFF_ROLES, StaffRuleError, roleLabel, type StaffMember, type StaffRoleKey } from '../services/staff/types';
import { PersonAvatar } from '../components/ui/PersonAvatar';
import { Switch } from '../components/ui/Switch';

type Filter = 'all' | 'active' | 'volunteers' | 'pending' | 'off' | 'archived';
const FILTERS: [Filter, string][] = [
  ['all', 'Everyone'],
  ['active', 'Active'],
  ['volunteers', 'Volunteers'],
  ['pending', 'Invite sent'],
  ['off', 'Switched off'],
  ['archived', 'Archived'],
];
const matches = (m: StaffMember, f: Filter) =>
  f === 'archived'
    ? Boolean(m.archivedAt)
    : !m.archivedAt &&
      (f === 'all' ||
        (f === 'active' && m.isActive && !m.invitePending) ||
        (f === 'volunteers' && m.roleKey === 'volunteer') ||
        (f === 'pending' && m.invitePending) ||
        (f === 'off' && !m.isActive));

/** Seconds to undo an archive before it's saved. */
const UNDO_MS = 3000;

type Toast = { text: string; error?: boolean };

/** Administrators invite people, choose their role, switch accounts on or off, and archive them. */
export function StaffPage() {
  const { can, profile } = useAuth();
  const online = useOnlineStatus();
  const list = useAsyncData(() => staffService.list());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const onboarding = useOnboarding();
  // "Invite a teammate" from Get started lands here with ?invite=1: open the invite form straight away.
  const [params, setParams] = useSearchParams();
  const [inviteOpen, setInviteOpen] = useState(() => params.get('invite') === '1');
  useEffect(() => {
    if (params.get('invite')) setParams((p) => (p.delete('invite'), p), { replace: true });
  }, [params, setParams]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  // An archive waiting out its undo window: hidden from the list, saved when the timer ends.
  const [pending, setPending] = useState<StaffMember | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout>>();
  const pendingRef = useRef<StaffMember | null>(null);
  pendingRef.current = pending;
  // Archived rows slide away (a swiped one has already moved, so it only closes up); undone ones glide back.
  const { leaving, leave } = useLeaving();
  const swiped = useRef(new Set<string>());
  const [returning, setReturning] = useState<string | null>(null);
  // A switched account shows its new state at once, while the change is saved.
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const report = useCallback((err: unknown) => {
    setToast({ text: err instanceof StaffRuleError ? err.message : 'Could not reach the server. Check the connection and try again.', error: true });
  }, []);

  /** Saves the archive now (timer ran out, another archive started, or the page is closing). */
  const commitArchive = useCallback(
    async (m: StaffMember, quiet = false) => {
      clearTimeout(pendingTimer.current);
      if (pendingRef.current?.id === m.id) setPending(null);
      try {
        await staffService.archive(m.id);
        if (!quiet) setToast({ text: `Archived ${m.name}. Find them under Archived.` });
      } catch (err) {
        if (!quiet) report(err);
      } finally {
        if (!quiet) list.refresh();
      }
    },
    [list, report],
  );

  // Leaving the page within the undo window still archives.
  useEffect(
    () => () => {
      const m = pendingRef.current;
      if (m) void commitArchive(m, true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const all = list.status === 'success' ? list.data : [];
  // The refreshed list now says the same as the switches.
  useEffect(() => setFlipped({}), [list.data]);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter(
      (m) =>
        m.id !== pending?.id && matches(m, filter) && (!needle || [m.name, m.email, roleLabel(m.roleKey)].some((s) => s.toLowerCase().includes(needle))),
    );
  }, [all, filter, search, pending]);

  if (!can('staff.manage'))
    return (
      <p className="card text-sm text-ink-soft" role="alert">
        Only administrators can manage staff and volunteer accounts.
      </p>
    );

  const run = async (m: StaffMember, change: () => Promise<void>, done: string) => {
    setBusyId(m.id);
    try {
      await change();
      setToast({ text: done });
      list.refresh();
      return true;
    } catch (err) {
      report(err);
      return false;
    } finally {
      setBusyId(null);
    }
  };
  const changeRole = (m: StaffMember, roleKey: StaffRoleKey) =>
    void run(m, () => staffService.setRole(m.id, roleKey), `${m.name} is now ${roleLabel(roleKey) === 'Administrator' ? 'an' : 'a'} ${roleLabel(roleKey)}.`);
  const toggle = (m: StaffMember) => {
    if (m.isActive && !window.confirm(`Switch off ${m.name}’s account? They can still sign in, but won’t see any portal data until it’s switched back on.`)) return;
    setFlipped((f) => ({ ...f, [m.id]: !m.isActive }));
    void run(m, () => staffService.setActive(m.id, !m.isActive), m.isActive ? `Switched off ${m.name}’s account.` : `Switched on ${m.name}’s account.`).then(
      (saved) => saved || setFlipped(({ [m.id]: _, ...rest }) => rest),
    );
  };
  const resend = (m: StaffMember) =>
    void run(
      m,
      () => staffService.invite({ email: m.email, fullName: '', roleKey: (STAFF_ROLES.find((r) => r.key === m.roleKey)?.key ?? 'staff') as StaffRoleKey }),
      `Sent the invitation to ${m.email} again.`,
    );
  const restore = (m: StaffMember) => void run(m, () => staffService.restore(m.id), `Restored ${m.name}. Their account is still switched off.`);

  const archive = (m: StaffMember, bySwipe = false) => {
    if (pendingRef.current) void commitArchive(pendingRef.current);
    setToast(null);
    if (bySwipe) swiped.current.add(m.id);
    void leave(
      [m.id],
      async () => undefined,
      () => {
        swiped.current.delete(m.id);
        setPending(m);
        clearTimeout(pendingTimer.current);
        pendingTimer.current = setTimeout(() => void commitArchive(m), UNDO_MS);
      },
    );
  };
  const undo = () => {
    clearTimeout(pendingTimer.current);
    setReturning(pendingRef.current?.id ?? null);
    setTimeout(() => setReturning(null), 700);
    setPending(null);
  };

  const canArchive = (m: StaffMember) => m.id !== profile?.id && m.roleKey !== 'admin' && !m.archivedAt;
  const counts = Object.fromEntries(FILTERS.map(([f]) => [f, all.filter((m) => m.id !== pending?.id && matches(m, f)).length])) as Record<Filter, number>;

  return (
    <div className="flex flex-col gap-4 pb-24 md:pb-0">
      <section className="card flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="card-title flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-uplift" aria-hidden /> Portal accounts
              {staffService.source === 'mock' && <SampleBadge />}
            </h2>
            <p className="card-note">
              Staff and volunteers who can sign in to the portal. Swipe someone to the right to archive them. PHILRADS IMS accounts are managed in the IMS.
            </p>
          </div>
          <button type="button" className="btn-primary hidden md:inline-flex" onClick={() => setInviteOpen(true)} disabled={!online}>
            <MailPlus className="h-4 w-4" aria-hidden /> Invite someone
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative">
            <label htmlFor="staff-search" className="sr-only">
              Search staff
            </label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="staff-search"
              type="search"
              className="field pl-10"
              placeholder="Search name, email or role"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              enterKeyHint="search"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show">
            {FILTERS.map(([f, label]) => (
              <button key={f} type="button" className="chip gap-1.5" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {label}
                {list.status === 'success' && <span className="font-normal opacity-80">{formatNumber(counts[f])}</span>}
              </button>
            ))}
          </div>
        </div>

        {list.status === 'loading' && (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        )}
        {list.status === 'error' && (
          <LoadError message={online ? 'Staff accounts could not be loaded.' : 'You’re offline. Staff accounts need a connection.'} onRetry={list.reload} />
        )}
        {list.status === 'success' && shown.length === 0 && (
          <EmptyState
            icon={filter === 'archived' ? Archive : UsersRound}
            title={filter === 'archived' ? 'Nobody is archived' : all.length === 0 ? 'No accounts yet' : 'Nobody matches'}
            action={
              search || filter !== 'all' ? (
                <button type="button" className="btn-ghost min-h-10 px-4 text-sm" onClick={() => (setSearch(''), setFilter('all'))}>
                  Show everyone
                </button>
              ) : (
                <button type="button" className="btn-primary min-h-10 px-4 text-sm" onClick={() => setInviteOpen(true)} disabled={!online}>
                  <MailPlus className="h-4 w-4" aria-hidden /> Invite someone
                </button>
              )
            }
          >
            {filter === 'archived'
              ? 'Swipe someone to the right in the list to archive them. They can be restored here.'
              : all.length === 0
                ? 'Invite staff and volunteers by email. They choose their own password.'
                : 'Try another name, email or role.'}
          </EmptyState>
        )}

        {shown.length > 0 && (
          <ul className="flex flex-col gap-2">
            {shown.map((m) => {
              const self = m.id === profile?.id;
              const busy = busyId === m.id;
              const swipeable = canArchive(m) && online;
              return (
                <LeavingRow key={m.id} as="li" gap="0.5rem" leaving={leaving.has(m.id)} slide={!swiped.current.has(m.id)} className={returning === m.id ? 'is-returning' : ''}>
                  <SwipeToArchive enabled={swipeable} onArchive={() => archive(m, true)}>
                    <div className={`tile flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4 ${m.isActive ? '' : 'text-ink-soft'}`}>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <PersonAvatar id={m.id} name={m.name} />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">
                            <span className="truncate">{m.name}</span>
                            {self && <span className="badge border-uplift/50 text-uplift">You</span>}
                            {m.archivedAt && <span className="badge border-line text-muted">{roleLabel(m.roleKey)}</span>}
                          </p>
                          <p className="truncate text-xs text-ink-soft">{m.email}</p>
                          <Status member={m} />
                        </div>
                      </div>
                      {m.archivedAt ? (
                        <button type="button" className="btn-ghost sm:shrink-0" onClick={() => restore(m)} disabled={busy || !online}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArchiveRestore className="h-4 w-4" aria-hidden />} Restore
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 sm:shrink-0">
                          {m.invitePending && (
                            <button type="button" className="icon-btn" onClick={() => resend(m)} disabled={busy || !online} title="Send the invitation again" aria-label={`Send ${m.name} the invitation again`}>
                              <RotateCw className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                          <label htmlFor={`role-${m.id}`} className="sr-only">
                            Role for {m.name}
                          </label>
                          <select
                            id={`role-${m.id}`}
                            className="field min-w-0 flex-1 py-2 sm:w-44 sm:flex-none"
                            value={m.roleKey}
                            disabled={self || busy || !online}
                            title={self ? 'Ask another administrator to change your role.' : undefined}
                            onChange={(e) => changeRole(m, e.target.value as StaffRoleKey)}
                          >
                            {!STAFF_ROLES.some((r) => r.key === m.roleKey) && <option value={m.roleKey}>{m.roleKey}</option>}
                            {STAFF_ROLES.map((r) => (
                              <option key={r.key} value={r.key}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                          <Switch
                            checked={flipped[m.id] ?? m.isActive}
                            label={`${m.name}’s account is ${m.isActive ? 'on' : 'off'}`}
                            title={self ? 'You can’t switch off your own account.' : m.isActive ? 'Switch off' : 'Switch on'}
                            disabled={self || busy || !online}
                            onChange={() => toggle(m)}
                          />
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => archive(m)}
                            disabled={!swipeable || busy}
                            title={canArchive(m) ? 'Archive' : m.roleKey === 'admin' ? 'Administrators can’t be archived' : 'You can’t archive your own account'}
                            aria-label={`Archive ${m.name}`}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                          </button>
                        </div>
                      )}
                    </div>
                  </SwipeToArchive>
                </LeavingRow>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => setInviteOpen(true)}
        disabled={!online}
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-uplift pl-4 pr-5 text-sm font-bold text-page shadow-xl shadow-black/50 transition active:scale-95 disabled:opacity-60 md:hidden"
      >
        <MailPlus className="h-6 w-6" aria-hidden /> Invite
      </button>

      <InviteSheet
        open={inviteOpen}
        existing={all}
        onClose={() => setInviteOpen(false)}
        onInvite={async (invite) => {
          await staffService.invite(invite);
          onboarding.complete('invite');
          list.reload();
        }}
        onDone={(text) => setToast({ text })}
      />

      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-6 md:left-auto md:right-6 md:justify-end">
        {pending ? (
          <div key={pending.id} className="pointer-events-auto relative flex max-w-md animate-pop-in items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface-raised py-2 pl-4 pr-2 text-sm shadow-2xl shadow-black/50">
            <Archive className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <span className="flex-1">Archived {pending.name}.</span>
            <button type="button" className="btn-ghost min-h-9 px-4 font-bold text-uplift" onClick={undo}>
              Undo
            </button>
            <span aria-hidden className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-uplift animate-undo-countdown" />
          </div>
        ) : (
          toast && (
            <p
              role={toast.error ? 'alert' : undefined}
              className={`pointer-events-auto flex max-w-md animate-pop-in items-start gap-3 rounded-2xl border bg-surface-raised px-4 py-3 text-sm shadow-2xl shadow-black/50 ${
                toast.error ? 'border-status-out/50' : 'border-status-in/40'
              }`}
            >
              <span className="flex-1">{toast.text}</span>
              <button type="button" className="-m-1 grid h-8 w-8 shrink-0 place-items-center text-muted hover:text-ink" onClick={() => setToast(null)} aria-label="Dismiss">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </p>
          )
        )}
      </div>
    </div>
  );
}

function Status({ member: m }: { member: StaffMember }) {
  if (m.archivedAt) return <p className="mt-0.5 text-xs text-muted">Archived {formatShortInstant(m.archivedAt)}, switched off</p>;
  if (m.invitePending)
    return (
      <p className="mt-0.5 text-xs text-status-low">
        Invite sent{m.invitedAt ? ` ${formatShortInstant(m.invitedAt)}` : ''}, waiting for them to choose a password
      </p>
    );
  if (!m.isActive) return <p className="mt-0.5 text-xs text-status-out">Switched off: can sign in but sees no data</p>;
  return <p className="mt-0.5 text-xs text-muted">{m.lastSignInAt ? `Last signed in ${formatShortInstant(m.lastSignInAt)}` : 'Hasn’t signed in yet'}</p>;
}
