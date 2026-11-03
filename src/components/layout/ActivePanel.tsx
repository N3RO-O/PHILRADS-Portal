import { useEffect, useMemo, useState } from 'react';
import { ChevronsRight, Search, Users, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useAsyncData } from '../../hooks/useAsyncData';
import { STATUS_META, usePresence, type Status } from '../../lib/presence';
import { timeAgo } from '../../lib/geo';
import { staffBoardService } from '../../services';
import type { BoardPerson } from '../../services/tasks/staffBoard';
import { PersonTasks } from '../tasks/PersonTasksSheet';
import { PersonAvatar } from '../ui/PersonAvatar';
import { Skeleton } from '../ui/Card';
import { StatusDot } from '../ui/StatusDot';

/** Highest first, like the role hierarchy. */
const ROLES: { key: string; label: string; color: string }[] = [
  { key: 'admin', label: 'Administrator', color: '#ec952a' },
  { key: 'coordinator', label: 'Coordinator', color: '#7cb7f7' },
  { key: 'staff', label: 'Staff', color: '#5ad08c' },
  { key: 'volunteer', label: 'Volunteer', color: '#c4b5fd' },
  { key: 'viewer', label: 'Viewer', color: '#a3a3ad' },
];
const roleOf = (k: string) => ROLES.find((r) => r.key === k) ?? ROLES[2];

/** What shows under a name: the status when away or busy, otherwise what they're carrying. */
function lineOf(p: BoardPerson, status: Status) {
  if (status === 'dnd') return { text: 'Do not disturb', tone: 'text-[#f23f43]' };
  if (status === 'idle') return { text: 'Idle', tone: 'text-[#f0b232]' };
  if (p.overdue) return { text: `${p.overdue} overdue · ${p.open + p.inProgress} open`, tone: 'text-rose' };
  if (p.pending) return { text: `${p.pending} to accept`, tone: 'text-sky-300' };
  if (p.open + p.inProgress) return { text: `${p.open + p.inProgress} open${p.inProgress ? ` · ${p.inProgress} in progress` : ''}`, tone: 'text-muted' };
  return { text: p.doneWeek ? `All clear · ${p.doneWeek} done this week` : 'All clear', tone: 'text-muted' };
}

/**
 * "Active": everyone at PHILRADS, Discord-style, on the right of every page. People who are on
 * (online, idle or do not disturb) are grouped by role from the top of the hierarchy down; everyone
 * else is under Offline. Tap a person for the tasks they've been given (nudge, or accept your own).
 */
export function ActivePanel({ onClose, variant }: { onClose: () => void; variant: 'docked' | 'drawer' }) {
  const { profile } = useAuth();
  const presence = usePresence();
  const board = useAsyncData(() => staffBoardService.board());
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // Counts stay fresh: every minute, and when coming back to the portal.
  useEffect(() => {
    const again = () => document.visibilityState === 'visible' && board.reload();
    const t = setInterval(again, 60_000);
    document.addEventListener('visibilitychange', again);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', again);
    };
  }, [board.reload]);

  const people = useMemo(() => {
    const list = board.status === 'success' ? board.data : [];
    const needle = q.trim().toLowerCase();
    return list.filter((p) => !needle || p.name.toLowerCase().includes(needle) || (p.roleName ?? '').toLowerCase().includes(needle));
  }, [board.status, board.data, q]);

  const groups = useMemo(() => {
    const on = people.filter((p) => presence.statusOf(p.id) !== 'offline');
    const off = people.filter((p) => presence.statusOf(p.id) === 'offline');
    const byName = (a: BoardPerson, b: BoardPerson) => Number(b.id === profile?.id) - Number(a.id === profile?.id) || a.name.localeCompare(b.name);
    const known = new Set(ROLES.map((r) => r.key));
    return [
      ...ROLES.map((r) => ({
        key: r.key,
        label: r.label,
        people: on.filter((p) => (known.has(p.roleKey) ? p.roleKey : 'staff') === r.key).sort(byName),
        offline: false,
      })),
      { key: 'offline', label: 'Offline', people: off.sort(byName), offline: true },
    ].filter((g) => g.people.length);
  }, [people, presence, profile?.id]);

  const activeCount = presence.activeCount(people.map((p) => p.id));
  const person = people.find((p) => p.id === openId) ?? null;

  return (
    <aside aria-label="Active" className={`flex h-full w-64 flex-col border-l border-line/70 bg-page/95 backdrop-blur-xl ${variant === 'drawer' ? 'shadow-2xl shadow-black/60' : ''}`}>
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/[0.05] px-4">
        <Users className="h-[1.125rem] w-[1.125rem] text-uplift" aria-hidden />
        <h2 className="flex-1 font-display text-base tracking-wide text-ink">Active</h2>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#23a55a]" title="Online, idle or busy">
          <span className="h-2 w-2 rounded-full bg-[#23a55a]" aria-hidden />
          {activeCount}
        </span>
        <button type="button" className="icon-btn h-9 w-9" onClick={onClose} aria-label="Hide the Active list" title="Hide the Active list">
          {variant === 'drawer' ? <X className="h-[1.125rem] w-[1.125rem]" aria-hidden /> : <ChevronsRight className="h-[1.125rem] w-[1.125rem]" aria-hidden />}
        </button>
      </div>

      <div className="px-3 pb-1 pt-3">
        <label className="flex h-9 items-center gap-2 rounded-lg bg-surface-sunken px-2.5 text-muted focus-within:ring-1 focus-within:ring-uplift">
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="sr-only">Find someone</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find someone" className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none" />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4" data-no-pull>
        {board.status === 'loading' ? (
          <div className="flex flex-col gap-3 px-2 pt-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ) : board.status === 'error' ? (
          <p className="px-3 pt-4 text-xs text-muted">
            Couldn’t load the team.{' '}
            <button type="button" className="link" onClick={board.reload}>
              Try again
            </button>
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.key} aria-label={`${g.label}, ${g.people.length}`} className="pt-4">
              <h3 className="px-2 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">
                {g.label} — {g.people.length}
              </h3>
              <ul>
                {g.people.map((p, i) => {
                  const status = presence.statusOf(p.id);
                  const role = roleOf(p.roleKey);
                  const seen = status === 'offline' ? presence.lastSeen(p.id) : null;
                  const line = seen ? { text: `Last seen ${timeAgo(seen)}`, tone: 'text-muted' } : lineOf(p, status);
                  const me = p.id === profile?.id;
                  return (
                    <li key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
                      <button
                        type="button"
                        onClick={() => setOpenId(p.id)}
                        className={`press group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.06] ${g.offline ? 'opacity-45 hover:opacity-90' : ''}`}
                        aria-label={`${p.name}${me ? ' (you)' : ''}, ${role.label}, ${STATUS_META[status].label}, ${line.text}`}
                      >
                        <span className="relative shrink-0">
                          <PersonAvatar id={p.id} name={p.name} size="sm" ring="ring-0" />
                          <StatusDot status={status} size={14} ring="#1c1d21" className="absolute -bottom-0.5 -right-0.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold" style={{ color: g.offline ? undefined : role.color }}>
                              {p.name}
                            </span>
                            {me && <span className="shrink-0 text-[0.625rem] text-muted">(you)</span>}
                          </span>
                          <span className={`block truncate text-[0.6875rem] ${line.tone}`}>{line.text}</span>
                        </span>
                        {p.open + p.inProgress > 0 && !g.offline && (
                          <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums text-ink-soft group-hover:bg-white/[0.1]">{p.open + p.inProgress}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
        {board.status === 'success' && people.length === 0 && <p className="px-3 pt-6 text-xs text-muted">No one matches “{q.trim()}”.</p>}
      </div>

      {person && <PersonTasks person={person} status={presence.statusOf(person.id)} me={profile?.id ?? null} onClose={() => setOpenId(null)} onChanged={board.reload} />}
    </aside>
  );
}
