import { useState } from 'react';
import { ChevronDown, HandCoins, HeartHandshake } from 'lucide-react';
import { amount, daysLeft, type DonationDrive } from '../../services/guest/guestService';
import { formatShortDate, formatShortInstant } from '../../lib/format';
import type { AsyncState } from '../../hooks/useAsyncData';
import { CopyButton, GuestSection, Picture, RowsLoading, SectionError, ShareButton } from './guestUi';

const pct = (d: DonationDrive) => Math.min(100, Math.round((d.raised / d.goal) * 100));

function Progress({ d }: { d: DonationDrive }) {
  const p = pct(d);
  const left = daysLeft(d.endsOn);
  return (
    <div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span>
          <span className="text-xl font-bold tabular-nums text-ink">{amount(d.raised, d.unit)}</span>
          <span className="text-sm text-muted"> of {amount(d.goal, d.unit)}</span>
        </span>
        <span className="text-sm font-semibold tabular-nums text-ink-soft">{p}%</span>
      </p>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
        aria-label={`${d.title}: ${p}% of the goal`}
      >
        <div className={`h-full origin-left animate-grow-x rounded-full ${p >= 100 ? 'bg-status-in' : 'bg-uplift'}`} style={{ width: `${Math.max(p, 2)}%` }} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {d.donorCount !== null && d.donorCount > 0 && <span>{d.donorCount.toLocaleString('en-PH')} donors</span>}
        {d.status === 'open' && left !== null && <span>{left === 0 ? 'Last day' : `${left} day${left === 1 ? '' : 's'} left`}</span>}
        {d.status === 'open' && d.endsOn && left === null && <span>Ended {formatShortDate(d.endsOn)}</span>}
        {d.raisedUpdatedAt && <span>Updated {formatShortInstant(d.raisedUpdatedAt)}</span>}
      </p>
    </div>
  );
}

function OpenDrive({ d }: { d: DonationDrive }) {
  const [giving, setGiving] = useState(false);
  return (
    <article id={`drive-${d.id}`} className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface">
      {d.coverUrl && <Picture src={d.coverUrl} alt="" icon={HandCoins} className="aspect-[21/9] w-full" />}
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h3 className="text-lg font-semibold leading-snug text-ink">{d.title}</h3>
          {d.summary && <p className="mt-1 text-sm text-ink-soft">{d.summary}</p>}
        </div>
        <Progress d={d} />
        {d.impactNote && (
          <p className="flex items-start gap-2 rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink">
            <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
            {d.impactNote}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {d.howToGive && (
            <button type="button" className="btn-primary" onClick={() => setGiving((g) => !g)} aria-expanded={giving} aria-controls={`give-${d.id}`}>
              How to give
              <ChevronDown className={`h-4 w-4 transition-transform ${giving ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          )}
          <ShareButton title={d.title} path={`/guest/give#drive-${d.id}`} />
        </div>
        {giving && d.howToGive && (
          <div id={`give-${d.id}`} className="animate-fade-in rounded-xl border border-line bg-surface-sunken p-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{d.howToGive}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CopyButton text={d.howToGive} label="Copy the details" />
              <span className="text-xs text-muted">Give only through the details shown here, and keep your receipt.</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Donation Drives: what each drive is for, how close it is to its goal, what a gift does, and how
 * to give. Finished drives stay listed underneath, so donors can see their gift reached its goal.
 */
export function DrivesSection({ drives, onRetry }: { drives: AsyncState<DonationDrive[]>; onRetry: () => void }) {
  const [showDone, setShowDone] = useState(false);
  const list = drives.data ?? [];
  const open = list.filter((d) => d.status === 'open');
  const done = list.filter((d) => d.status === 'closed');
  return (
    <GuestSection id="drives" title="Donation Drives" lead="Each drive says what it's for and how close it is. Staff update the totals as gifts are counted.">
      {drives.status === 'loading' ? (
        <RowsLoading rows={2} />
      ) : drives.status === 'error' ? (
        <SectionError message={drives.error.message} onRetry={onRetry} />
      ) : (
        <>
          {open.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {open.map((d) => (
                <OpenDrive key={d.id} d={d} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink-soft">
              No drive is open right now. When a disaster strikes, new drives appear here first.
            </p>
          )}
          {done.length > 0 && (
            <div className="mt-6">
              <button type="button" className="flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}>
                <ChevronDown className={`h-4 w-4 transition-transform ${showDone ? 'rotate-180' : ''}`} aria-hidden />
                Completed drives ({done.length})
              </button>
              {showDone && (
                <ul className="mt-3 divide-y divide-line/70">
                  {done.map((d) => (
                    <li key={d.id} className="py-3">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold text-ink">{d.title}</span>
                        <span className="text-sm tabular-nums text-ink-soft">
                          {amount(d.raised, d.unit)} raised, {pct(d)}% of the goal
                        </span>
                      </p>
                      {d.endsOn && <p className="text-xs text-muted">Closed {formatShortDate(d.endsOn)}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </GuestSection>
  );
}
