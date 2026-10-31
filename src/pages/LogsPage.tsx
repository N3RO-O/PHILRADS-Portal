import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Download, Flag, Loader2, Lock, LogIn, RotateCcw, ScrollText, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { EmptyState, LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { Sheet } from '../components/ui/Sheet';
import { downloadCsv, toCsv } from '../lib/csv';
import { formatDateTime, formatDayHeading, formatNumber, formatTime, manilaDayKey } from '../lib/format';
import { auditService } from '../services';
import { FLAG_ACTIONS, LOG_CATEGORIES, type LogCategory, type LogCounts, type LogEntry, type LogPeriod, type LogQuery } from '../services/audit/auditService';
import { PersonAvatar } from '../components/ui/PersonAvatar';

const PERIODS: [LogPeriod, string][] = [
  ['today', 'Today'],
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['all', 'All time'],
];

const AREA: Record<string, string> = {
  tasks: 'Tasks',
  inventory: 'Stock',
  'live-map': 'Live Map',
  resources: 'Resources',
  system: 'Portal',
  response: 'Response',
  projects: 'Projects',
};

/** Plain words for the keys stored with an entry. */
const DETAIL_LABEL: Record<string, string> = {
  points: 'XP',
  points_removed: 'XP taken back',
  self_set: 'Their own task',
  seconds: 'Seconds after adding',
  reason: 'Reason',
  message: 'Message',
  device: 'Device',
  priority: 'Priority',
  due_date: 'Due',
  was: 'Was',
  from: 'From',
  to: 'To',
  earner: 'Earned by',
  given_by: 'Given by',
  assignee: 'Assigned to',
};

const isFlag = (e: LogEntry) => FLAG_ACTIONS.includes(e.action);

/** Administrators: everything that happened in the portal. Written by the database only; nothing can be edited or deleted. */
export function LogsPage() {
  const { can } = useAuth();
  const [query, setQuery] = useState<LogQuery>({ category: 'all', search: '', period: '7d', actorId: null });
  const [searchText, setSearchText] = useState('');
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<LogCounts | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState<LogEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const allowed = can('audit.read');

  // Typing waits a moment before searching.
  useEffect(() => {
    const t = setTimeout(() => setQuery((q) => (q.search === searchText ? q : { ...q, search: searchText })), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const latest = useRef(0);
  const load = useCallback(async (q: LogQuery) => {
    const run = ++latest.current;
    setEntries(null);
    setError(null);
    try {
      const page = await auditService.list(q);
      if (run !== latest.current) return;
      setEntries(page.entries);
      setMore(page.more);
    } catch (e) {
      if (run === latest.current) setError(e instanceof Error ? e.message : 'The log could not be loaded.');
    }
  }, []);
  useEffect(() => {
    if (allowed) void load(query);
  }, [allowed, query, load]);
  useEffect(() => {
    if (!allowed) return;
    auditService.counts().then(setCounts, () => setCounts(null));
    auditService.people().then(setPeople, () => setPeople([]));
  }, [allowed]);

  const loadMore = async () => {
    if (!entries?.length) return;
    setLoadingMore(true);
    try {
      const page = await auditService.list(query, entries[entries.length - 1].id);
      setEntries((list) => [...(list ?? []), ...page.entries]);
      setMore(page.more);
    } catch {
      setError('Older entries could not be loaded. Check the connection and try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  /** Everything matching the filters (up to 5,000 lines), for Excel or Google Sheets. */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: LogEntry[] = [];
      let before: number | undefined;
      for (let i = 0; i < 5; i++) {
        const page = await auditService.list(query, before, 1000);
        rows.push(...page.entries);
        if (!page.more || !page.entries.length) break;
        before = page.entries[page.entries.length - 1].id;
      }
      const names = new Map(people.map((p) => [p.id, p.name]));
      const csv = toCsv(rows, [
        { header: 'When (Manila)', value: (e) => formatDateTime(e.at) },
        { header: 'Who', value: (e) => e.actorName },
        { header: 'Area', value: (e) => AREA[e.module] ?? e.module },
        { header: 'What happened', value: (e) => e.summary },
        { header: 'Action', value: (e) => e.action },
        { header: 'Seen by', value: (e) => (e.audience === 'admins' ? 'Admins only' : 'Everyone') },
        { header: 'Details', value: (e) => detailLines(e, names).map(([k, v]) => `${k}: ${v}`).join('; ') },
      ]);
      downloadCsv(`philrads-log-${manilaDayKey(new Date().toISOString())}.csv`, csv);
    } catch {
      setError('The export could not be made. Check the connection and try again.');
    } finally {
      setExporting(false);
    }
  };

  const days = useMemo(() => {
    const groups: { day: string; items: LogEntry[] }[] = [];
    for (const e of entries ?? []) {
      const day = manilaDayKey(e.at);
      const g = groups[groups.length - 1];
      if (g && g.day === day) g.items.push(e);
      else groups.push({ day, items: [e] });
    }
    return groups;
  }, [entries]);

  if (!allowed)
    return (
      <p className="card text-sm text-ink-soft" role="alert" data-quiet>
        The admin log is for administrators. Ask an administrator if you need something from it.
      </p>
    );

  const set = (patch: Partial<LogQuery>) => setQuery((q) => ({ ...q, ...patch }));
  const filtered = query.category !== 'all' || query.search || query.actorId || query.period !== '7d';

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-2xl border border-line/70 bg-surface px-4 py-3 text-sm text-ink-soft">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
        <span>
          Newest first. Entries are written by the database itself, so nobody, admins included, can add, change or delete them.{' '}
          {auditService.source === 'mock' && <SampleBadge />}
        </span>
      </p>

      {/* The last 7 days at a glance; each opens its entries. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountTile icon={<Flag className="h-4 w-4" aria-hidden />} tone="text-status-low" label="Flags to look at" value={counts?.flags} onClick={() => set({ category: 'flags', period: '7d' })} />
        <CountTile icon={<LogIn className="h-4 w-4" aria-hidden />} tone="text-sky-300" label="Sign-ins" value={counts?.signIns} onClick={() => set({ category: 'signins', period: '7d' })} />
        <CountTile icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} tone="text-status-in" label="Tasks finished" value={counts?.finished} onClick={() => set({ category: 'tasks', period: '7d', search: '' })} />
        <CountTile icon={<RotateCcw className="h-4 w-4" aria-hidden />} tone="text-uplift" label="Tasks sent back" value={counts?.sentBack} onClick={() => (setSearchText('sent back'), set({ category: 'tasks', period: '7d' }))} />
      </div>

      <section className="card flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Show">
          {LOG_CATEGORIES.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={query.category === c.key} className="chip" aria-pressed={query.category === c.key} onClick={() => set({ category: c.key as LogCategory })}>
              {c.key === 'flags' && <Flag className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_13rem_auto]">
          <label className="relative block sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Search the log</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" className="field pl-10" placeholder="Search: a name, a task, an item…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </label>
          <select className="field" aria-label="When" value={query.period} onChange={(e) => set({ period: e.target.value as LogPeriod })}>
            {PERIODS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className="field" aria-label="Who" value={query.actorId ?? ''} onChange={(e) => set({ actorId: e.target.value || null })}>
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ghost min-h-11 whitespace-nowrap px-4" onClick={() => void exportCsv()} disabled={exporting || !entries?.length}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />} Export CSV
          </button>
        </div>
        {filtered && (
          <button
            type="button"
            className="link self-start"
            onClick={() => {
              setSearchText('');
              setQuery({ category: 'all', search: '', period: '7d', actorId: null });
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
          </button>
        )}

        {error ? (
          <LoadError message={error} onRetry={() => void load(query)} />
        ) : entries === null ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading the log">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon={ScrollText} title={query.category === 'flags' ? 'No flags in this period' : 'Nothing matches'}>
            {query.category === 'flags' ? 'Nobody ticked off their own tasks suspiciously fast, added finished tasks or hit the daily limit.' : 'Try another word, a longer period, or Everything.'}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-5">
            {days.map((g) => (
              <section key={g.day} aria-label={formatDayHeading(g.items[0].at)}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{dayLabel(g.day, g.items[0].at)}</h3>
                <ul className="flex flex-col divide-y divide-line/50">
                  {g.items.map((e) => (
                    <li key={e.id}>
                      <button type="button" className="tap flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/[0.03]" onClick={() => setOpen(e)}>
                        <PersonAvatar id={e.actorId} name={e.actorName} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug">{e.summary}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-muted">
                            <span className="tabular-nums">{formatTime(e.at)}</span>
                            <span aria-hidden>·</span>
                            <span>{AREA[e.module] ?? e.module}</span>
                            {isFlag(e) && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-status-low/15 px-1.5 py-0.5 font-semibold text-status-low">
                                <Flag className="h-3 w-3" aria-hidden /> Flag
                              </span>
                            )}
                            {e.audience === 'admins' && !isFlag(e) && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-semibold text-ink-soft">
                                <Lock className="h-3 w-3" aria-hidden /> Admins only
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {more && (
              <button type="button" className="btn-ghost min-h-11 self-center px-5" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Show older entries
              </button>
            )}
          </div>
        )}
      </section>

      {open && <EntrySheet entry={open} people={people} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CountTile({ icon, tone, label, value, onClick }: { icon: ReactNode; tone: string; label: string; value: number | undefined; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="tile tap flex flex-col items-start gap-1 p-4 text-left transition hover:border-uplift/40">
      <span className={`flex items-center gap-2 text-xs font-semibold ${tone}`}>
        {icon} {label}
      </span>
      {value === undefined ? <Skeleton className="mt-1 h-7 w-12" /> : <span className="text-2xl font-bold tabular-nums">{formatNumber(value)}</span>}
      <span className="text-[0.6875rem] text-muted">Last 7 days</span>
    </button>
  );
}

function dayLabel(day: string, iso: string) {
  const today = manilaDayKey(new Date().toISOString());
  const yesterday = manilaDayKey(new Date(Date.now() - 86_400_000).toISOString());
  return day === today ? 'Today' : day === yesterday ? 'Yesterday' : formatDayHeading(iso);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The stored details in plain words (people's ids shown as names). */
function detailLines(e: LogEntry, names: Map<string, string>): [string, string][] {
  return Object.entries(e.metadata)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const label = DETAIL_LABEL[k] ?? k.replace(/_/g, ' ');
      const text = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'string' && UUID.test(v) ? names.get(v) ?? 'Someone' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return [label, text];
    });
}

function EntrySheet({ entry, people, onClose }: { entry: LogEntry; people: { id: string; name: string }[]; onClose: () => void }) {
  const names = new Map(people.map((p) => [p.id, p.name]));
  const lines = detailLines(entry, names);
  return (
    <Sheet open onClose={onClose} title="Log entry" subtitle={formatDateTime(entry.at)}>
      <div className="flex flex-col gap-4">
        <p className="text-base leading-relaxed">{entry.summary}</p>
        {isFlag(entry) && (
          <p className="flex items-start gap-2 rounded-xl border border-status-low/40 bg-status-low/10 px-3 py-2 text-xs text-ink-soft">
            <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-low" aria-hidden />
            {entry.action === 'task.quick_tick'
              ? 'Ticked off very soon after being added. Often fine (a quick job, or synced after working offline); worth a look if it happens a lot.'
              : entry.action === 'task.added_done'
                ? 'Added already finished, which the app itself never does: it earned nothing.'
                : entry.action === 'task.xp_capped'
                  ? 'Hit the daily limit for XP from their own tasks.'
                  : 'A task was deleted for good.'}
          </p>
        )}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Who</dt>
          <dd>{entry.actorName}</dd>
          <dt className="text-muted">Area</dt>
          <dd>{AREA[entry.module] ?? entry.module}</dd>
          <dt className="text-muted">Seen by</dt>
          <dd>{entry.audience === 'admins' ? 'Admins only' : 'Everyone (activity feed)'}</dd>
          {lines.map(([k, v]) => (
            <Fragmentish key={k} label={k} value={v} />
          ))}
          <dt className="text-muted">Action</dt>
          <dd className="font-mono text-xs text-ink-soft">{entry.action}</dd>
        </dl>
        {entry.entityType === 'task' && entry.entityId && (
          <Link to={`/tasks?task=${encodeURIComponent(entry.entityId)}`} className="link self-start">
            Open the task
          </Link>
        )}
      </div>
    </Sheet>
  );
}

function Fragmentish({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </>
  );
}
