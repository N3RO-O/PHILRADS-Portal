import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, FileSpreadsheet, Home, MapPin, Search, UsersRound, Wallet, X } from 'lucide-react';
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
import { RollingNumber } from '../components/ui/RollingNumber';
import { todayKey } from '../lib/inventory';
import { previousPeriod, totals } from '../lib/kpi';

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
  const matches = (a: ProgramActivity) => !needle || [a.activity, a.site, a.response, canFunding ? a.donors : null, a.partner, a.contactPerson, a.dateLabel].some((s) => s?.toLowerCase().includes(needle));
  const shown = useMemo(
    () => all.filter((a) => (year === 'all' || a.year === year) && (program === 'all' || a.program === program) && matches(a)),
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
  // With one year picked, each figure also shows its change from the year before (the same stretch of it, for this year).
  const today = todayKey();
  const before =
    year !== 'all' && all.some((a) => a.year === year - 1)
      ? totals(previousPeriod(all.filter((a) => (program === 'all' || a.program === program) && matches(a)), year, today))
      : null;
  const vs = year === Number(today.slice(0, 4)) ? `vs this time in ${Number(year) - 1}` : `vs ${Number(year) - 1}`;

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
        {/* Two dropdowns instead of rows of chips: side by side, stacked on the narrowest phones. */}
        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:max-w-xl">
          <Picker label="Year" value={String(year)} onChange={(v) => setYear(v === 'all' ? 'all' : Number(v))}>
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Picker>
          <Picker label="Program" value={program} onChange={(v) => setProgram(v as ProgramKey | 'all')}>
            <option value="all">All programs</option>
            {PROGRAMS.filter((p) => all.some((a) => a.program === p.key)).map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Picker>
        </div>
      </section>

      {/* The totals in one plain sentence. */}
      <p className="animate-fade-up text-base leading-relaxed text-ink-soft [animation-delay:40ms]" aria-live="polite">
        {summary({ year, firstYear: years[years.length - 1] ?? 2023, program, needle: search.trim(), activities: done.length, people: sum(done, (a) => a.individualsServed), households: sum(done, (a) => a.householdsServed), places })}
      </p>

      {/* Totals */}
      <section className={`grid animate-fade-up grid-cols-2 gap-x-6 gap-y-5 [animation-delay:60ms] ${canFunding ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`} aria-label="Totals">
        <Kpi icon={UsersRound} label="people helped" value={formatNumber(sum(done, (a) => a.individualsServed))} note="where recorded" change={before && { by: sum(done, (a) => a.individualsServed) - before.people, vs }} />
        <Kpi icon={Home} label="households reached" value={formatNumber(sum(done, (a) => a.householdsServed))} note="where recorded" change={before && { by: sum(done, (a) => a.householdsServed) - before.households, vs }} />
        <Kpi icon={CalendarDays} label="activities done" value={formatNumber(done.length)} note={shown.length > done.length ? `+${shown.length - done.length} scheduled` : 'completed or ongoing'} change={before && { by: done.length - before.activities, vs }} />
        <Kpi icon={MapPin} label="places visited" value={formatNumber(places)} note="barangays, towns and provinces" change={before && { by: places - before.places, vs }} />
        {canFunding && (
          <Kpi
            icon={Wallet}
            label="funding recorded"
            value={funded.length ? `₱${compact(sum(funded, (a) => a.funding))}` : '—'}
            note={funded.length ? `for ${funded.length} of ${done.length} activities` : 'none recorded'}
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
                    <span className="h-2 overflow-hidden rounded-full bg-ink/[0.06]">
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
            <div className="flex flex-col gap-2">
              <p className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-ink-soft">Men and women served</span>
                <span className="text-muted">{formatNumber(sexed.length)} activities with a breakdown</span>
              </p>
              <span className="flex h-2.5 overflow-hidden rounded-full">
                <span className="bg-ink-soft" style={{ width: `${(men / (men + women)) * 100}%` }} />
                <span className="bg-ink-mute/60" style={{ width: `${(women / (men + women)) * 100}%` }} />
              </span>
              <p className="flex justify-between text-xs tabular-nums">
                <span className="text-ink">Men {formatNumber(men)} ({Math.round((men / (men + women)) * 100)}%)</span>
                <span className="text-ink-soft">Women {formatNumber(women)} ({Math.round((women / (men + women)) * 100)}%)</span>
              </p>
            </div>
          )}
        </section>
      </div>

      <Responses list={done} onSearch={setSearch} />

      {canFunding && <TopDonors list={program === 'all' && !needle ? all.filter((a) => a.status !== 'scheduled') : done} />}

      {/* Every record */}
      <section className="card flex animate-fade-up flex-col gap-1 [animation-delay:180ms]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
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
          <p className="pb-6 text-sm text-muted">No records match. Try another word or year.</p>
        ) : (
          [...new Set(shown.map((a) => a.year))].map((y) => (
            <div key={y}>
              <h4 className="sticky top-16 z-10 border-y border-line bg-page py-2 text-xs font-semibold uppercase tracking-wider text-muted">
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

/** A key figure in plain words: an icon, the number, what it counts and a note. */
function Kpi({ icon: Icon, label, value, note, change, className = '' }: { icon: typeof Home; label: string; value: string; note: string; change?: { by: number; vs: string } | null; className?: string }) {
  return (
    <div className={`flex items-start gap-3 border-t border-line pt-4 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-soft" aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <p className="font-display text-2xl tabular-nums leading-tight tracking-wide sm:text-3xl">{/\d/.test(value) ? <RollingNumber value={value} /> : value}</p>
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        <p className="text-xs text-muted">{note}</p>
        {change && (
          <p className={`mt-0.5 text-xs font-semibold tabular-nums ${change.by > 0 ? 'text-status-in' : change.by < 0 ? 'text-status-out' : 'text-muted'}`}>
            {change.by > 0 ? <ArrowUpRight className="-mt-0.5 mr-0.5 inline h-3.5 w-3.5" aria-hidden /> : change.by < 0 ? <ArrowDownRight className="-mt-0.5 mr-0.5 inline h-3.5 w-3.5" aria-hidden /> : null}
            {change.by > 0 ? '+' : change.by < 0 ? '−' : ''}
            {change.by === 0 ? 'No change' : formatNumber(Math.abs(change.by))} <span className="font-medium text-muted">{change.vs}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** A labelled dropdown: the label sits small above the value, inside the field. */
function Picker({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-4 top-2 text-[0.625rem] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <select className="field appearance-none pb-2 pr-10 pt-6 font-semibold" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </label>
  );
}

/** "In 2026, PHILRADS ran 142 activities and served 18,400 people in 63 places." */
function summary({ year, firstYear, program, needle, activities, people, households, places }: { year: number | 'all'; firstYear: number; program: ProgramKey | 'all'; needle: string; activities: number; people: number; households: number; places: number }) {
  const when = year === 'all' ? `Since ${firstYear}` : `In ${year}`;
  const who = program === 'all' ? 'PHILRADS' : programMeta(program).label;
  const match = needle ? ` matching “${needle}”` : '';
  if (!activities) return `${when}, there are no activities${match} for ${program === 'all' ? 'PHILRADS' : who} yet.`;
  const served = people ? ` and served ${formatNumber(people)} ${people === 1 ? 'person' : 'people'}` : households ? ` and reached ${formatNumber(households)} ${households === 1 ? 'household' : 'households'}` : '';
  const where = places ? ` in ${formatNumber(places)} ${places === 1 ? 'place' : 'places'}` : '';
  return `${when}, ${who} ran ${formatNumber(activities)} ${activities === 1 ? 'activity' : 'activities'}${match}${served}${where}.`;
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
              <span className="flex w-full max-w-[4.5rem] flex-col-reverse overflow-hidden rounded-t-lg ring-1 ring-inset ring-ink/5 transition-[height] duration-500" style={{ height: `${(inYear.length / max) * 100}%` }}>
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
              <button type="button" className="tile flex h-full w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-ink/[0.06]" onClick={() => onSearch(name)}>
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
      <button type="button" className="flex w-full items-start gap-3 py-3.5 text-left transition-colors hover:bg-ink/[0.03]" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold leading-snug">{a.activity}</span>
            {a.status === 'scheduled' && <span className="badge border-line text-ink-soft">Scheduled</span>}
            {a.status === 'ongoing' && <span className="badge border-line text-ink-soft">Ongoing</span>}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {a.response && <span className="text-ink-soft">{a.response} · </span>}
            {a.site} · {a.dateLabel}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-xs tabular-nums text-ink-soft sm:block">{served}</span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <div className={`expand ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div>{open && <RecordDetails a={a} className="pb-4 pl-[1.375rem]" />}</div>
      </div>
    </li>
  );
}
