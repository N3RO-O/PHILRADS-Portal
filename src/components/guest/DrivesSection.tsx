import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ExternalLink, HandCoins, HandHeart, HeartHandshake, Shirt, Users } from 'lucide-react';
import { amount, daysLeft, peso, type DonationDrive, type MerchItem } from '../../services/guest/guestService';
import { formatShortDate, formatShortInstant } from '../../lib/format';
import type { AsyncState } from '../../hooks/useAsyncData';
import { useGuestAccount } from '../../services/guest/account';
import { SignInPrompt } from './SignInPrompt';
import { MerchCard, OrderSheet } from './MerchSection';
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
        {d.merchSold > 0 && <span>{d.merchSold.toLocaleString('en-PH')} merch sold for it</span>}
        {d.status === 'open' && left !== null && <span>{left === 0 ? 'Last day' : `${left} day${left === 1 ? '' : 's'} left`}</span>}
        {d.status === 'open' && d.endsOn && left === null && <span>Ended {formatShortDate(d.endsOn)}</span>}
        {d.raisedUpdatedAt && <span>Updated {formatShortInstant(d.raisedUpdatedAt)}</span>}
      </p>
    </div>
  );
}

function OpenDrive({ d, merch, onOrder }: { d: DonationDrive; merch: MerchItem[]; onOrder: (m: MerchItem) => void }) {
  const [giving, setGiving] = useState(false);
  // Items whose sales go to this fundraiser.
  const wear = merch.filter((m) => m.driveId === d.id && m.driveShare);
  return (
    <article id={`drive-${d.id}`} className="flex scroll-mt-24 flex-col gap-4 py-6 first:pt-0">
      {d.coverUrl && <Picture src={d.coverUrl} alt="" icon={HandCoins} className="aspect-[21/9] w-full rounded-xl" />}
      <div className="flex flex-col gap-4">
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
          <ShareButton title={d.title} path={`/guest/give?drive=${d.id}`} />
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
        {wear.length > 0 && (
          <div className="rounded-2xl border border-line p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Shirt className="h-4 w-4 text-uplift" aria-hidden /> Wear the cause
            </h4>
            <p className="mt-0.5 text-sm text-ink-soft">
              {wear.length === 1 ? `${peso(wear[0].driveShare ?? 0)} of every sale goes to this fundraiser.` : 'Part of every sale goes to this fundraiser.'}
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
              {wear.map((m) => (
                <MerchCard key={m.id} m={m} cause={d} onOrder={() => onOrder(m)} showCause={wear.length > 1} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

/** A finished drive's report: what the gifts did, in words, a number and photos. */
function DriveReport({ d }: { d: DonationDrive }) {
  const { unlocked } = useGuestAccount();
  return (
    <article id={`drive-${d.id}`} className="scroll-mt-24 py-5 first:pt-0">
      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-base font-semibold leading-snug text-ink">{d.title}</h4>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted">
            <span>{amount(d.raised, d.unit)} given</span>
            {d.reportReached !== null && d.reportReached > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-status-in">
                <Users className="h-3.5 w-3.5" aria-hidden /> {d.reportReached.toLocaleString('en-PH')} families reached
              </span>
            )}
            {d.endsOn && <span>Closed {formatShortDate(d.endsOn)}</span>}
          </p>
        </div>
        {!unlocked ? (
          <SignInPrompt
            compact
            title="See where the gifts went"
            body={`Sign in to read the report${d.reportPhotos.length ? ` and see ${d.reportPhotos.length === 1 ? 'the photo' : `all ${d.reportPhotos.length} photos`}` : ''}.`}
          />
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{d.report}</p>
        )}
        {unlocked && d.reportPhotos.length > 0 && (
          <ul className={`grid gap-2 ${d.reportPhotos.length === 1 ? 'grid-cols-1' : d.reportPhotos.length === 2 || d.reportPhotos.length === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {d.reportPhotos.map((src, i) => (
              <li key={src}>
                <a href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl" aria-label={`Photo ${i + 1} of ${d.reportPhotos.length}, opens full size`}>
                  <Picture src={src} alt="" icon={HandCoins} className="aspect-[4/3] w-full transition-transform duration-500 ease-glide hover:scale-[1.03]" />
                </a>
              </li>
            ))}
          </ul>
        )}
        <div>
          <ShareButton title={`What your gifts did: ${d.title}`} path={`/guest/give?drive=${d.id}`} />
        </div>
      </div>
    </article>
  );
}

/**
 * Fundraising: what each fundraiser is for, how close it is to its goal, what a gift does, and how
 * to give. Finished drives stay listed underneath, so donors can see their gift reached its goal.
 */
export function DrivesSection({ drives, merch, onRetry }: { drives: AsyncState<DonationDrive[]>; merch: MerchItem[]; onRetry: () => void }) {
  const [showDone, setShowDone] = useState(false);
  const [ordering, setOrdering] = useState<MerchItem | null>(null);
  const list = drives.data ?? [];
  const open = list.filter((d) => d.status === 'open');
  const done = list.filter((d) => d.status === 'closed');
  const reported = done.filter((d) => d.report).sort((a, b) => (b.reportedAt ?? '').localeCompare(a.reportedAt ?? ''));
  const quiet = done.filter((d) => !d.report);
  return (
    <GuestSection id="drives" title="Fundraising" lead="Every gift is counted here.">
      {drives.status === 'loading' ? (
        <RowsLoading rows={2} />
      ) : drives.status === 'error' ? (
        <SectionError message={drives.error.message} onRetry={onRetry} />
      ) : (
        <>
          {open.length ? (
            <div className="divide-y divide-line/70 border-b border-line/70">
              {open.map((d) => (
                <OpenDrive key={d.id} d={d} merch={merch} onOrder={setOrdering} />
              ))}
            </div>
          ) : (
            // No fundraiser open: still a way to give, and a way to help that isn't money.
            <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-sunken p-5">
              <div>
                <p className="font-semibold text-ink">No fundraiser is open right now</p>
                <p className="mt-1 text-sm text-ink-soft">When a disaster strikes, new fundraisers appear here first. You can still support PHILRADS’s ongoing relief and development work.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="https://philrads.org/" target="_blank" rel="noopener noreferrer" className="btn-primary">
                  <HandCoins className="h-4 w-4" aria-hidden /> Give on philrads.org
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                {merch.length > 0 && (
                  <Link to="/guest/merch" className="btn border border-line bg-surface text-ink hover:bg-surface-raised">
                    <Shirt className="h-4 w-4" aria-hidden /> Shop merch
                  </Link>
                )}
                <Link to="/guest/feedback?about=volunteer" className="btn border border-line bg-surface text-ink hover:bg-surface-raised">
                  <HandHeart className="h-4 w-4" aria-hidden /> Volunteer
                </Link>
              </div>
            </div>
          )}
          {reported.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-ink">What your gifts did</h3>
              <p className="mt-0.5 text-sm text-ink-soft">Fundraisers that finished, and what they made possible.</p>
              <div className="mt-3 divide-y divide-line/70 border-y border-line/70">
                {reported.map((d) => (
                  <DriveReport key={d.id} d={d} />
                ))}
              </div>
            </div>
          )}
          {quiet.length > 0 && (
            <div className="mt-6">
              <button type="button" className="flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}>
                <ChevronDown className={`h-4 w-4 transition-transform ${showDone ? 'rotate-180' : ''}`} aria-hidden />
                {reported.length ? 'Other completed fundraisers' : 'Completed fundraisers'} ({quiet.length})
              </button>
              {showDone && (
                <ul className="mt-3 divide-y divide-line/70">
                  {quiet.map((d) => (
                    <li key={d.id} id={`drive-${d.id}`} className="scroll-mt-24 py-3">
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
      <OrderSheet item={ordering} cause={ordering ? list.find((d) => d.id === ordering.driveId) ?? null : null} onClose={() => setOrdering(null)} />
    </GuestSection>
  );
}
