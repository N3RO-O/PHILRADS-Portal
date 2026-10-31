import { useMemo, useState, type CSSProperties } from 'react';
import { CalendarDays, ChevronDown, FileSpreadsheet, Home, MapPin, Search, UsersRound, Wallet, X } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { RecordDetails } from '../components/statistics/RecordDetails';
import { SyncSheet } from '../components/statistics/SyncSheet';
import { TopDonors } from '../components/statistics/TopDonors';
import { LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatNumber } from '../lib/format';
import { activitiesService } from '../services';
import { byNewest, PROGRAMS, programMeta, servedText, siteKey, withoutFunding, type ProgramActivity, type ProgramKey } from '../services/activities/types';

const compact = (n: number) => new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
/** The program most of these activities belong to. */
const mostCommon = (list: ProgramActivity[]): ProgramKey => {
  const n = new Map<ProgramKey, number>();
  for (const a of list) n.set(a.program, (n.get(a.program) ?? 0) + 1);
  return [...n.entries()].sort((x, y) => y[1] - x[1])[0][0];
};
const sum = (list: ProgramActivity[], f: (a: ProgramActivity) => number | null) => list.reduce((t, a) => t + (f(a) ?? 0), 0);

/**
 * Statistics: every PHILRADS project and activity on record since 2023, with totals, a year-by-year
 * view, what each program and response reached, and the full details of each record (target and
 * served, men and women, partners). Mapped records open on the Live Map. Funding, donors and the top
 * donors are for administrators and coordinators only (funding.read); people who manage projects can
 * sync the records from the statistics workbook.
 */
export function StatisticsPage() {
  const { can } = useAuth();
  const canFunding = can('funding.read');
  const canSync = can('projects.manage');
  const q = useAsyncData(() => activitiesService.list());
  const [year, setYear] = useState<number | 'all'>('all');
  const [program, setProgram] = useState<ProgramKey | 'all'>('all');
  const [search, setSearch] = useState('');
  const [syncOpen, setSyncOpen] = useState(false);
  const [synced, setSynced] = useState(false);
  // The database already withholds funding from other roles; this does the same for the sample data.
  const all = useMemo(() => (q.status === 'success' ? q.data.map((a) => (canFunding ? a : withoutFunding(a))).sort(byNewest) : []), [q.status, q.data, canFunding]);
  const years = useMemo(() => [...new Set(all.map((a) => a.year))].sort((a, b) => b - a), [all]);

  const needle = search.trim().toLowerCase();
  const shown = useMemo(
    () =>
      all.filter(
        (a) =>
          (year === 'all' || a.year === year) &&
          (program === 'all' || a.program === program) &&
          (!needle || [a.activity, a.site, a.response, canFunding ? a.donors : null, a.partner, a.contactPerson, a.dateLabel].some((s) => s?.toLowerCase().includes(needle))),
      ),
    [all, year, program, needle, canFunding],
  );

  if (q.status === 'error') return <LoadError message={q.error.message} onRetry={q.reload} />;
  if (q.status === 'loading')
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
      </div>
    );

  const done = shown.filter((a) => a.status !== 'scheduled');
  const places = new Set(done.filter((a) => a.lat !== null).map((a) => siteKey({ lat: a.lat!, lng: a.lng! }))).size;
  const funded = done.filter((a) => a.funding !== null);
  const sexed = done.filter((a) => a.male !== null || a.female !== null);
  const men = sum(sexed, (a) => a.male);
  const women = sum(sexed, (a) => a.female);
  const filtered = year !== 'all' || program !== 'all' || needle;

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <section className="card flex animate-fade-up flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="card-title flex items-center gap-2">
              Projects and activities since {years[years.length - 1] ?? 2023} {activitiesService.source === 'mock' && <SampleBadge />}
            </h2>
            <p className="card-note">From the PHILRADS statistics database, activity tracker and statistical report.</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search records</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input className="field py-2.5 pl-9 pr-9" placeholder={canFunding ? 'Search place, donor, partner…' : 'Search place, partner, response…'} value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink" onClick={() => setSearch('')} aria-label="Clear search">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </label>
            {canSync && (
              <button type="button" className="btn-ghost w-full gap-2 sm:w-auto" onClick={() => setSyncOpen(true)}>
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
                Sync from spreadsheet
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Year">
          {(['all', ...years] as const).map((y) => (
            <button key={y} type="button" className="chip" aria-pressed={year === y} onClick={() => setYear(y)}>
              {y === 'all' ? 'All years' : y}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Program">
          <button type="button" className="chip" aria-pressed={program === 'all'} onClick={() => setProgram('all')}>
            All programs
          </button>
          {PROGRAMS.filter((p) => all.some((a) => a.program === p.key)).map((p) => (
            <button key={p.key} type="button" className="chip gap-1.5" aria-pressed={program === p.key} onClick={() => setProgram(p.key)}>
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
              {p.short}
            </button>
          ))}
        </div>
      </section>

      {/* Totals */}
      <section className={`grid animate-fade-up grid-cols-2 gap-3 [animation-delay:60ms] ${canFunding ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`} aria-label="Totals">
        <Kpi icon={CalendarDays} label="Activities" value={formatNumber(done.length)} note={shown.length > done.length ? `+${shown.length - done.length} scheduled` : 'completed or ongoing'} />
        <Kpi icon={Home} label="Households served" value={formatNumber(sum(done, (a) => a.householdsServed))} note="where recorded" glow="rgba(96,165,250,.2)" />
        <Kpi icon={UsersRound} label="People served" value={formatNumber(sum(done, (a) => a.individualsServed))} note="individuals, where recorded" glow="rgba(74,222,128,.18)" />
        <Kpi icon={MapPin} label="Places reached" value={formatNumber(places)} note="barangays, towns and provinces" glow="rgba(224,122,122,.2)" />
        {canFunding && (
          <Kpi
            icon={Wallet}
            label="Funding recorded"
            value={funded.length ? `₱${compact(sum(funded, (a) => a.funding))}` : '—'}
            note={funded.length ? `for ${funded.length} of ${done.length} activities` : 'none recorded'}
            glow="rgba(196,181,253,.2)"
            className="col-span-2 lg:col-span-1"
          />
        )}
      </section>

      <div className="grid animate-fade-up grid-cols-1 gap-5 [animation-delay:120ms] xl:grid-cols-12">
        <YearChart list={filtered ? done : all.filter((a) => a.status !== 'scheduled')} active={year} onPick={setYear} />
        <section className="card flex flex-col gap-4 xl:col-span-5">
          <div>
            <h3 className="card-title">By program</h3>
            <p className="card-note">Activities, and households and people served</p>
          </div>
          <ul className="flex flex-col gap-3">
            {PROGRAMS.map((p) => {
              const list = done.filter((a) => a.program === p.key);
              if (!list.length) return null;
              return (
                <li key={p.key}>
                  <button type="button" className="group flex w-full flex-col gap-1.5 text-left" onClick={() => setProgram(program === p.key ? 'all' : p.key)} aria-pressed={program === p.key}>
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium group-hover:text-ink">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
                        {p.label}
                      </span>
                      <span className="tabular-nums text-muted">{formatNumber(list.length)}</span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${(list.length / done.length) * 100}%`, background: p.color }} />
                    </span>
                    <span className="text-xs text-muted">
                      {formatNumber(sum(list, (a) => a.householdsServed))} households · {formatNumber(sum(list, (a) => a.individualsServed))} people
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {sexed.length > 0 && men + women > 0 && (
            <div className="tile flex flex-col gap-2 p-3">
              <p className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-ink-soft">Men and women served</span>
                <span className="text-muted">{formatNumber(sexed.length)} activities with a breakdown</span>
              </p>
              <span className="flex h-2.5 overflow-hidden rounded-full">
                <span className="bg-sky-400" style={{ width: `${(men / (men + women)) * 100}%` }} />
                <span className="bg-pink-400" style={{ width: `${(women / (men + women)) * 100}%` }} />
              </span>
              <p className="flex justify-between text-xs tabular-nums">
                <span className="text-sky-300">Men {formatNumber(men)} ({Math.round((men / (men + women)) * 100)}%)</span>
                <span className="text-pink-300">Women {formatNumber(women)} ({Math.round((women / (men + women)) * 100)}%)</span>
              </p>
            </div>
          )}
        </section>
      </div>

      <Responses list={done} onSearch={setSearch} />

      {canFunding && <TopDonors list={program === 'all' && !needle ? all.filter((a) => a.status !== 'scheduled') : done} />}

      {/* Every record */}
      <section className="card flex animate-fade-up flex-col gap-1 p-0 [animation-delay:180ms]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-2 pt-5">
          <h3 className="card-title">Records</h3>
          <p className="text-xs text-muted">
            {formatNumber(shown.length)} {shown.length === 1 ? 'record' : 'records'}
            {filtered && (
              <button
                type="button"
                className="link ml-2"
                onClick={() => {
                  setYear('all');
                  setProgram('all');
                  setSearch('');
                }}
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
        {shown.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted">No records match. Try another word or year.</p>
        ) : (
          [...new Set(shown.map((a) => a.year))].map((y) => (
            <div key={y}>
              <h4 className="sticky top-0 z-10 border-y border-line/60 bg-surface/95 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted backdrop-blur">
                {y} <span className="font-normal normal-case tracking-normal">· {shown.filter((a) => a.year === y).length} records</span>
              </h4>
              <ul>
                {shown
                  .filter((a) => a.year === y)
                  .map((a) => (
                    <Record key={a.id} a={a} />
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {canSync && (
        <SyncSheet
          open={syncOpen}
          onClose={() => {
            setSyncOpen(false);
            // Reloading shows the page's loading state, so it waits until the summary has been read.
            if (synced) q.refresh();
            setSynced(false);
          }}
          records={all}
          withFunding={canFunding}
          onSynced={() => setSynced(true)}
        />
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, note, glow, className = '' }: { icon: typeof Home; label: string; value: string; note: string; glow?: string; className?: string }) {
  return (
    <div className={`card flex flex-col gap-3 p-4 ${className}`}>
      <span className="icon-chip" style={glow ? ({ '--glow': glow } as CSSProperties) : undefined}>
        <Icon className="h-[1.125rem] w-[1.125rem] text-ink" aria-hidden />
      </span>
      <div>
        <p className="font-display text-2xl tabular-nums tracking-wide sm:text-3xl">{value}</p>
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        <p className="text-xs text-muted">{note}</p>
      </div>
    </div>
  );
}

/** Activities per year, stacked by program; a year can be picked to filter everything. */
function YearChart({ list, active, onPick }: { list: ProgramActivity[]; active: number | 'all'; onPick: (y: number | 'all') => void }) {
  const years = [...new Set(list.map((a) => a.year))].sort();
  const max = Math.max(1, ...years.map((y) => list.filter((a) => a.year === y).length));
  return (
    <section className="card flex flex-col gap-4 xl:col-span-7">
      <div>
        <h3 className="card-title">Year by year</h3>
        <p className="card-note">Activities each year by program. Pick a year to see only that year.</p>
      </div>
      <div className="flex h-56 items-end gap-3 sm:gap-6" role="list">
        {years.map((y) => {
          const inYear = list.filter((a) => a.year === y);
          return (
            <button
              key={y}
              type="button"
              role="listitem"
              onClick={() => onPick(active === y ? 'all' : y)}
              aria-pressed={active === y}
              aria-label={`${y}: ${inYear.length} activities`}
              className={`group flex h-full flex-1 flex-col items-center justify-end gap-2 rounded-xl px-1 pt-2 transition-opacity ${active !== 'all' && active !== y ? 'opacity-40 hover:opacity-80' : ''}`}
            >
              <span className="text-sm font-semibold tabular-nums">{inYear.length}</span>
              <span className="flex w-full max-w-[4.5rem] flex-col-reverse overflow-hidden rounded-t-lg ring-1 ring-inset ring-white/5 transition-[height] duration-500" style={{ height: `${(inYear.length / max) * 100}%` }}>
                {PROGRAMS.map((p) => {
                  const n = inYear.filter((a) => a.program === p.key).length;
                  return n ? <span key={p.key} title={`${p.short}: ${n}`} style={{ height: `${(n / inYear.length) * 100}%`, background: p.color }} /> : null;
                })}
              </span>
              <span className={`text-xs font-semibold ${active === y ? 'text-uplift' : 'text-ink-soft'}`}>{y}</span>
              <span className="hidden text-center text-[0.6875rem] leading-tight text-muted sm:block">
                {compact(sum(inYear, (a) => a.householdsServed))} HH
                <br />
                {compact(sum(inYear, (a) => a.individualsServed))} people
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The disasters and initiatives with the most activities. */
function Responses({ list, onSearch }: { list: ProgramActivity[]; onSearch: (s: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, ProgramActivity[]>();
    for (const a of list) if (a.response) m.set(a.response, [...(m.get(a.response) ?? []), a]);
    return [...m.entries()].sort((x, y) => y[1].length - x[1].length).slice(0, 8);
  }, [list]);
  if (!groups.length) return null;
  return (
    <section className="card flex animate-fade-up flex-col gap-4 [animation-delay:150ms]">
      <div>
        <h3 className="card-title">Responses and initiatives</h3>
        <p className="card-note">The disasters and projects with the most activities. Pick one to see its records.</p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map(([name, acts]) => {
          const sites = new Set(acts.map((a) => a.site)).size;
          const years = [...new Set(acts.map((a) => a.year))].sort();
          return (
            <li key={name}>
              <button type="button" className="tile flex h-full w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-white/[0.06]" onClick={() => onSearch(name)}>
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold leading-snug">{name}</span>
                  <span className="h-2.5 w-2.5 shrink-0 translate-y-1 rounded-full" style={{ background: programMeta(mostCommon(acts)).color }} aria-hidden />
                </span>
                <span className="text-xs text-muted">
                  {years.join('–')} · {acts.length} {acts.length === 1 ? 'activity' : 'activities'} · {sites} {sites === 1 ? 'site' : 'sites'}
                </span>
                <span className="mt-auto flex gap-4 text-xs tabular-nums text-ink-soft">
                  <span>
                    <strong className="font-display text-base tracking-wide text-ink">{formatNumber(sum(acts, (a) => a.householdsServed))}</strong> HH
                  </span>
                  <span>
                    <strong className="font-display text-base tracking-wide text-ink">{formatNumber(sum(acts, (a) => a.individualsServed))}</strong> people
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** One record: the summary line, and everything else when opened. */
function Record({ a }: { a: ProgramActivity }) {
  const [open, setOpen] = useState(false);
  const p = programMeta(a.program);
  const served = servedText(a);
  return (
    <li className="border-b border-line/50 last:border-b-0">
      <button type="button" className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03]" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold leading-snug">{a.activity}</span>
            {a.status === 'scheduled' && <span className="badge border-sky-400/40 bg-sky-400/10 text-sky-300">Scheduled</span>}
            {a.status === 'ongoing' && <span className="badge border-uplift/40 bg-uplift/10 text-uplift">Ongoing</span>}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {a.response && <span className="text-ink-soft">{a.response} · </span>}
            {a.site} · {a.dateLabel}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-xs tabular-nums text-ink-soft sm:block">{served}</span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <RecordDetails a={a} className="px-5 pb-4 pl-[2.625rem]" />}
    </li>
  );
}
