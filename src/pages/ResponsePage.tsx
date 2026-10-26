import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, CircleCheck, Database, ExternalLink, MapPin, Plus, Users, X } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { QuantityStepper } from '../components/inventory/QuantityStepper';
import { EmptyState, LoadError, Skeleton } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { SampleBadge } from '../components/ui/SampleBadge';
import { env } from '../config/env';
import { formatDateTime, formatNumber, formatShortDate } from '../lib/format';
import { imsActionUrl, openImsAction, useImsActionResults, useLiveRefresh } from '../lib/imsActions';
import { inventoryStore } from '../services';
import type { ImsEvent } from '../services/inventory/imsSnapshot';
import { useInventoryState } from '../services/inventory/inventoryStore';

const TYPE_LABEL: Record<string, string> = {
  disaster_relief: 'Disaster relief',
  medical_mission: 'Medical mission',
  livelihood: 'Livelihood',
  feeding: 'Feeding',
  other: 'Other',
};
const STATUS_TONE: Record<ImsEvent['status'], string> = {
  active: 'border-status-in/40 bg-status-in/10 text-status-in',
  upcoming: 'border-sky-300/40 bg-sky-300/10 text-sky-300',
  planned: 'border-line text-ink-soft',
  completed: 'border-line text-muted',
  cancelled: 'border-status-out/40 text-status-out',
};
type Filter = 'open' | 'all' | 'completed';

/**
 * Response: relief events from PHILRADS IMS with their beneficiary targets, and served counts
 * added area by area until the target is met. Counts are added through the IMS window
 * (administrators and warehouse managers), so the IMS stays the single record.
 */
export function ResponsePage() {
  return <ImsEvents />;
}

function ImsEvents() {
  const { profile, can } = useAuth();
  const state = useInventoryState(inventoryStore);
  const { snapshot } = state;
  const canRecord = can('beneficiaries.record');
  const imsUrl = snapshot?.imsUrl || env.imsUrl;
  const [filter, setFilter] = useState<Filter>('open');
  const [adding, setAdding] = useState<ImsEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    void inventoryStore.start({ id: profile.id, name: profile.displayName });
    return () => inventoryStore.stop();
  }, [profile]);
  useImsActionResults(imsUrl, setToast, () => void inventoryStore.refresh());
  useLiveRefresh(true, () => void inventoryStore.refresh());
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const events = snapshot?.imsEvents ?? [];
  const shown = useMemo(
    () =>
      events.filter((e) =>
        filter === 'all' ? true : filter === 'completed' ? e.status === 'completed' || e.status === 'cancelled' : e.status !== 'completed' && e.status !== 'cancelled',
      ),
    [events, filter],
  );
  const open = events.filter((e) => e.status === 'active' || e.status === 'upcoming' || e.status === 'planned');
  const target = open.reduce((s, e) => s + e.target, 0);
  const served = open.reduce((s, e) => s + Math.min(e.served, e.target || e.served), 0);

  return (
    <div className="flex flex-col gap-4 pb-6">
      {snapshot && (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line/70 bg-surface px-4 py-3 text-sm">
          <Database className="h-5 w-5 shrink-0 text-uplift" aria-hidden />
          <p className="min-w-0 flex-1">
            <strong className="font-semibold">{snapshot.sample ? 'Sample data in the PHILRADS IMS format' : 'Live from PHILRADS IMS'}</strong>, updated{' '}
            {formatDateTime(snapshot.fetchedAt)}. Served counts are added in the IMS, area by area, until each target is met.
          </p>
          {snapshot.sample && <SampleBadge />}
        </div>
      )}

      {!snapshot && state.loading && <Skeleton className="h-72" />}
      {!snapshot && !state.loading && state.loadError && <LoadError message={state.loadError} onRetry={() => void inventoryStore.refresh()} />}

      {snapshot && (
        <>
          <section aria-label="Summary" className="grid grid-cols-3 gap-2">
            {(
              [
                ['Open events', formatNumber(open.length), 'text-ink'],
                ['Served so far', formatNumber(served), 'text-status-in'],
                ['Target', formatNumber(target), 'text-uplift'],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className="rounded-2xl border border-line/70 bg-surface px-3 py-3">
                <p className="text-[0.6875rem] font-semibold text-muted">{label}</p>
                <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
              </div>
            ))}
          </section>

          <section className="card flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="card-title flex items-center gap-2">
                <Users className="h-4 w-4 text-uplift" aria-hidden /> Relief events and beneficiaries
              </h2>
              <div role="group" aria-label="Show" className="flex gap-1 rounded-xl bg-surface-sunken p-1">
                {(
                  [
                    ['open', 'Open'],
                    ['completed', 'Completed'],
                    ['all', 'All'],
                  ] as const
                ).map(([f, label]) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className="tap min-h-9 rounded-lg px-3 text-sm font-semibold text-ink-soft aria-pressed:bg-surface-raised aria-pressed:text-ink"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <EmptyState
                icon={Users}
                title={filter === 'completed' ? 'No completed events yet' : filter === 'open' ? 'No open relief events' : 'No relief events yet'}
                action={
                  filter !== 'all' ? (
                    <button type="button" className="btn-ghost min-h-10 px-4 text-sm" onClick={() => setFilter('all')}>
                      Show all events
                    </button>
                  ) : imsUrl ? (
                    <a className="btn-primary min-h-10 px-4 text-sm" href={`${imsUrl}/events.php`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" aria-hidden /> Plan an event in the IMS
                    </a>
                  ) : undefined
                }
              >
                Relief events planned in PHILRADS IMS show here with how many people were served.
              </EmptyState>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {shown.map((e) => (
                  <EventCard key={e.id} event={e} canRecord={canRecord && Boolean(imsUrl)} onAdd={() => setAdding(e)} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {adding && imsUrl && <AddServed event={adding} imsUrl={imsUrl} onClose={() => setAdding(null)} onOpened={setToast} />}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center md:left-auto md:right-6 md:justify-end">
        {toast && (
          <p className="pointer-events-auto flex max-w-md animate-pop-in items-start gap-3 rounded-2xl border border-status-in/40 bg-surface-raised px-4 py-3 text-sm shadow-2xl shadow-black/50">
            <span className="flex-1">{toast}</span>
            <button type="button" className="-m-1 grid h-8 w-8 shrink-0 place-items-center text-muted hover:text-ink" onClick={() => setToast(null)} aria-label="Dismiss">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function EventCard({ event: e, canRecord, onAdd }: { event: ImsEvent; canRecord: boolean; onAdd: () => void }) {
  const pct = e.target ? Math.min(100, Math.round((e.served / e.target) * 100)) : 0;
  const reached = e.target > 0 && e.served >= e.target;
  const closed = e.status === 'completed' || e.status === 'cancelled';
  return (
    <li className="tile flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{e.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{TYPE_LABEL[e.type] ?? e.type}</span>
            {e.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden /> {e.location}
              </span>
            )}
            {e.start_date && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" aria-hidden /> {formatShortDate(e.start_date)}
                {e.end_date && ` – ${formatShortDate(e.end_date)}`}
              </span>
            )}
          </p>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold capitalize ${STATUS_TONE[e.status]}`}>{e.status}</span>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span>
            <strong className="text-lg tabular-nums">{formatNumber(e.served)}</strong> <span className="text-muted">of {e.target ? formatNumber(e.target) : '—'} served</span>
          </span>
          {reached ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-in">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Target reached
            </span>
          ) : (
            e.target > 0 && <span className="text-xs text-muted">{formatNumber(e.target - e.served)} to go</span>
          )}
        </div>
        <div
          className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`${pct}% of target served`}
        >
          <div className={`h-full rounded-full ${reached ? 'bg-status-in' : 'bg-uplift'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {e.areas.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm" aria-label="Served by area">
          {[...e.areas]
            .sort((a, b) => b.served - a.served)
            .map((a) => (
              <li key={a.area} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-ink-soft">{a.area}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatNumber(a.served)}</span>
              </li>
            ))}
        </ul>
      )}

      {e.updates.length > 0 && (
        <details className="text-xs">
          <summary className="tap flex min-h-9 cursor-pointer items-center font-semibold text-ink-soft">Who added what ({e.updates.length})</summary>
          <ol className="mt-1 flex flex-col gap-1.5">
            {e.updates.map((u, i) => (
              <li key={i} className="flex justify-between gap-3 text-muted">
                <span className="min-w-0">
                  <span className="font-semibold text-status-in">+{formatNumber(u.served)}</span> {u.area} · {u.by}
                  {u.note && ` · ${u.note}`}
                </span>
                {u.at && <time className="shrink-0">{formatDateTime(u.at)}</time>}
              </li>
            ))}
          </ol>
        </details>
      )}

      {canRecord && !closed && (
        <button type="button" className="btn-primary mt-auto self-stretch sm:self-end" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden /> Add served
        </button>
      )}
    </li>
  );
}

function AddServed({ event, imsUrl, onClose, onOpened }: { event: ImsEvent; imsUrl: string; onClose: () => void; onOpened: (m: string) => void }) {
  const uid = useId();
  const [area, setArea] = useState('');
  const [served, setServed] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number.parseInt(served, 10);
    if (!area.trim()) return setError('Enter the area: barangay, municipality or site.');
    if (!Number.isInteger(n) || n < 1 || n > 100_000) return setError('Enter how many were served: a whole number from 1 to 100,000.');
    const action = { act: 'served' as const, event: event.id, area: area.trim(), served: n, note: note.trim() || undefined };
    if (openImsAction(imsUrl, action)) {
      onOpened('Confirm in the PHILRADS IMS window. This page updates when it’s saved.');
      onClose();
    } else setBlocked(imsActionUrl(imsUrl, action));
  };

  return (
    <Dialog open title="Add served beneficiaries" onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="-mt-2 text-sm text-muted">{event.name}</p>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-soft">
          Area
          <input className="field" list={`${uid}-areas`} value={area} onChange={(e) => setArea(e.target.value)} maxLength={150} placeholder="e.g. Brgy. San Roque, Tacloban" data-autofocus />
          <datalist id={`${uid}-areas`}>
            {event.areas.map((a) => (
              <option key={a.area} value={a.area} />
            ))}
          </datalist>
        </label>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-n`} className="text-sm font-semibold text-ink-soft">
            Served now
          </label>
          <QuantityStepper id={`${uid}-n`} value={served} onChange={setServed} max={100_000} unit="people" />
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-soft">
          Note <span className="text-xs font-normal text-muted">Optional</span>
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
        </label>
        {error && (
          <p role="alert" className="text-xs font-medium text-status-out">
            {error}
          </p>
        )}
        {blocked && (
          <p role="alert" className="text-sm">
            Your browser blocked the IMS window.{' '}
            <a className="font-semibold text-uplift underline" href={blocked} target="_blank" rel="opener">
              Open it here
            </a>
            .
          </p>
        )}
        <button type="submit" className="btn-primary h-12 text-base">
          <ExternalLink className="h-4 w-4" aria-hidden /> Continue in PHILRADS IMS
        </button>
        <p className="text-xs text-muted">You’ll sign in to the IMS with your own account and confirm. The total and the per-area list here update right after.</p>
      </form>
    </Dialog>
  );
}
