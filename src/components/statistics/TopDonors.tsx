import { useMemo, useState, type CSSProperties } from 'react';
import { Crown, HandHeart, Lock } from 'lucide-react';
import { formatNumber, manilaDayKey } from '../../lib/format';
import { topDonors } from '../../lib/donors';
import type { ProgramActivity } from '../../services/activities/types';
import { EmptyState } from '../ui/Card';
import { SlidingPill } from '../ui/SlidingPill';

type Period = 'month' | 'year' | 'all';
type Rank = 'funding' | 'activities';

const peso = (n: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n);
const pesoShort = (n: number) => `₱${new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}`;
const MONTH = new Intl.DateTimeFormat('en-PH', { month: 'long', timeZone: 'UTC' });

/**
 * Top donors: who supported the most PHILRADS activities, this month, this year or since records
 * began. Shown only to administrators and coordinators (funding.read).
 */
export function TopDonors({ list }: { list: ProgramActivity[] }) {
  const today = manilaDayKey(new Date().toISOString());
  const year = Number(today.slice(0, 4));
  const month = today.slice(0, 7);
  const [period, setPeriod] = useState<Period>('year');
  const [rank, setRank] = useState<Rank>('funding');

  const inPeriod = useMemo(
    () => list.filter((a) => (period === 'all' ? true : period === 'year' ? a.year === year : (a.startDate ?? '').startsWith(month))),
    [list, period, year, month],
  );
  const donors = useMemo(() => topDonors(inPeriod, rank), [inPeriod, rank]);
  const shown = donors.slice(0, 8);
  const max = Math.max(1, ...shown.map((d) => (rank === 'funding' ? d.funding : d.activities)));
  const monthName = MONTH.format(new Date(`${month}-01T00:00:00Z`));
  const periodText = period === 'month' ? `${monthName} ${year}` : period === 'year' ? String(year) : 'all years';

  return (
    <section id="top-donors" className="card flex animate-fade-up flex-col gap-4 [animation-delay:140ms]" aria-labelledby="top-donors-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="top-donors-title" className="card-title flex flex-wrap items-center gap-2">
            Top donors
            <span className="badge gap-1 border-line bg-surface-raised text-ink-soft" title="Funding and donors are visible to administrators and coordinators only">
              <Lock className="h-3 w-3" aria-hidden /> Admins &amp; coordinators
            </span>
          </h3>
          <p className="card-note">Who supported the most activities in {periodText}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex gap-1 rounded-xl bg-surface-sunken p-1" role="group" aria-label="Period">
            <SlidingPill className="rounded-lg bg-surface-raised shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.06]" />
            {(
              [
                ['month', 'This month'],
                ['year', 'This year'],
                ['all', 'All years'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft relative z-10 transition-colors duration-500 hover:text-ink aria-pressed:text-ink">
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex gap-1 rounded-xl bg-surface-sunken p-1" role="group" aria-label="Rank by">
            <SlidingPill className="rounded-lg bg-surface-raised shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.06]" />
            {(
              [
                ['funding', 'By funding'],
                ['activities', 'By activities'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={rank === k} onClick={() => setRank(k)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft relative z-10 transition-colors duration-500 hover:text-ink aria-pressed:text-ink">
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={HandHeart} title={`No donors recorded for ${periodText}`}>
          Donors appear here once activities in this period list them.
        </EmptyState>
      ) : (
        <ol className="grid grid-cols-1 gap-x-8 gap-y-1 lg:grid-cols-2">
          {shown.map((d, i) => {
            const value = rank === 'funding' ? d.funding : d.activities;
            const top = i === 0;
            return (
              <li key={d.name} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${top ? 'kpi-tile' : ''}`} style={top ? ({ '--glow': 'rgba(236, 149, 42, 0.18)' } as CSSProperties) : undefined}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums ${top ? 'bg-uplift text-page' : 'bg-surface-raised text-ink-soft'}`}>
                  {top ? <Crown className="h-4 w-4" aria-label="Top donor" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-ink" title={d.name}>
                      {d.name}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink" title={rank === 'funding' ? peso(d.funding) : undefined}>
                      {rank === 'funding' ? (d.funding ? pesoShort(d.funding) : '—') : formatNumber(d.activities)}
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                    <span className={`block h-full rounded-full ${top ? 'bg-uplift' : 'bg-ink-mute/70'}`} style={{ width: `${(value / max) * 100}%` }} />
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {formatNumber(d.activities)} {d.activities === 1 ? 'activity' : 'activities'}
                    {rank === 'activities' && d.funding > 0 && ` · ${pesoShort(d.funding)}`}
                    {d.sole > 0 && d.sole < d.activities && ` · ${d.sole} on its own`}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-muted">
        Funding is each donor’s share of the amount recorded for an activity, split evenly where several donors are named, so it is an estimate.
        {donors.length > shown.length && ` ${donors.length - shown.length} more donors in ${periodText}.`}
      </p>
    </section>
  );
}
