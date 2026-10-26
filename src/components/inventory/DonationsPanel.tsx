import { useMemo, useState } from 'react';
import { ArrowRight, Download, Gift, HandHeart, PackageCheck, Search, Users } from 'lucide-react';
import { env } from '../../config/env';
import { useIncrementalList } from '../../hooks/useIncrementalList';
import { EmptyState } from '../ui/Card';
import { downloadCsv, toCsv } from '../../lib/csv';
import { formatNumber, formatShortDate, manilaDayKey } from '../../lib/format';
import type { ImsDonation } from '../../services/inventory/imsSnapshot';

type Progress = 'all' | 'given' | 'partly' | 'waiting';

/** How much of each line went out, from the releases that drew on this donation. */
function trace(d: ImsDonation) {
  const lines = d.lines.map((l) => {
    const given = d.given.filter((g) => g.item_id === l.item_id).reduce((s, g) => s + g.qty, 0);
    return { ...l, given: Math.min(given, l.qty) };
  });
  const share = lines.length ? lines.reduce((s, l) => s + (l.qty ? l.given / l.qty : 0), 0) / lines.length : 0;
  const releases = new Map<string, ImsDonation['given']>();
  for (const g of d.given) releases.set(g.release_id, [...(releases.get(g.release_id) ?? []), g]);
  const served = [...releases.values()].reduce((s, gs) => s + (gs[0].beneficiaries_served ?? 0), 0);
  const progress: Exclude<Progress, 'all'> = share >= 0.999 ? 'given' : share > 0 ? 'partly' : 'waiting';
  return { lines, share, releases, served, progress };
}

const PROGRESS_LABEL: Record<Exclude<Progress, 'all'>, { label: string; cls: string }> = {
  given: { label: 'Fully given out', cls: 'border-status-in/40 bg-status-in/10 text-status-in' },
  partly: { label: 'Partly given out', cls: 'border-status-low/40 bg-status-low/10 text-status-low' },
  waiting: { label: 'Not given out yet', cls: 'border-line text-ink-soft' },
};

/**
 * Donation tracking: every donation recorded in PHILRADS IMS, traced through the releases that
 * gave it out (recipient, event, date, people served), so staff can show donors where their
 * goods went.
 */
export function DonationsPanel({ donations, sample }: { donations: ImsDonation[]; sample: boolean }) {
  const [q, setQ] = useState('');
  const [progress, setProgress] = useState<Progress>('all');
  const traced = useMemo(() => donations.map((d) => ({ d, t: trace(d) })), [donations]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return traced.filter(({ d, t }) => {
      if (progress !== 'all' && t.progress !== progress) return false;
      if (!needle) return true;
      return [d.record_id, d.donor, ...d.lines.map((l) => l.name), ...d.given.flatMap((g) => [g.recipient_org, g.event_name, g.release_code])]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle));
    });
  }, [traced, q, progress]);
  const { visible, hasMore, sentinel, showMore } = useIncrementalList(filtered, `${q}|${progress}`, 20);

  const reached = new Map<string, number>();
  for (const { d } of traced) for (const g of d.given) if (g.beneficiaries_served) reached.set(g.release_id, g.beneficiaries_served);
  const recipients = new Set(traced.flatMap(({ d }) => d.given.map((g) => g.recipient_org).filter(Boolean)));

  const exportCsv = () => {
    const rows = filtered.flatMap(({ d }) =>
      d.given.length
        ? d.given.map((g) => ({ d, g }))
        : [{ d, g: null as ImsDonation['given'][number] | null }],
    );
    const csv = toCsv(rows, [
      { header: 'Donation record', value: (r) => r.d.record_id },
      { header: 'Donor', value: (r) => r.d.donor },
      { header: 'Date received', value: (r) => r.d.date_received },
      { header: 'Item', value: (r) => r.g?.name ?? r.d.lines.map((l) => l.name).join('; ') },
      { header: 'Quantity given', value: (r) => r.g?.qty ?? 0 },
      { header: 'Unit', value: (r) => r.g?.unit ?? '' },
      { header: 'Release', value: (r) => r.g?.release_code ?? 'Not given out yet' },
      { header: 'Date released', value: (r) => r.g?.date_released ?? '' },
      { header: 'Given to', value: (r) => r.g?.recipient_org ?? '' },
      { header: 'Event', value: (r) => r.g?.event_name ?? '' },
      { header: 'People served (whole release)', value: (r) => r.g?.beneficiaries_served ?? '' },
    ]);
    downloadCsv(`philrads-donation-tracking-${manilaDayKey(new Date().toISOString())}.csv`, csv);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['Donations', formatNumber(donations.length), Gift],
            ['Recipients reached', formatNumber(recipients.size), HandHeart],
            ['People served', formatNumber([...reached.values()].reduce((s, n) => s + n, 0)), Users],
          ] as const
        ).map(([label, value, Icon]) => (
          <div key={label} className="tile flex items-center gap-3 px-3 py-3">
            <Icon className="hidden h-5 w-5 shrink-0 text-uplift sm:block" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-[0.6875rem] font-semibold text-muted">{label}</p>
              <p className="text-lg font-bold tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="don-q" className="sr-only">
            Search donations
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input id="don-q" type="search" className="field pl-10" placeholder="Donor, record no., item, recipient or event" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="button" className="btn-ghost shrink-0" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4" aria-hidden /> Donor report (.csv)
        </button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Progress">
        {(
          [
            ['all', 'All'],
            ['given', 'Fully given out'],
            ['partly', 'Partly given out'],
            ['waiting', 'Not given out yet'],
          ] as const
        ).map(([p, label]) => (
          <button key={p} type="button" className="chip" aria-pressed={progress === p} onClick={() => setProgress(p)}>
            {label}
          </button>
        ))}
      </div>
      {sample && <p className="text-xs text-muted">Sample data: donors, recipients and quantities are invented.</p>}

      {filtered.length === 0 ? (
        q || progress !== 'all' ? (
          <EmptyState
            icon={Gift}
            title="No donations match"
            action={
              <button type="button" className="btn-ghost min-h-10 px-4 text-sm" onClick={() => (setQ(''), setProgress('all'))}>
                Clear filters
              </button>
            }
          >
            Try another donor, record number or item.
          </EmptyState>
        ) : (
          <EmptyState
            icon={Gift}
            title="No donations recorded yet"
            action={
              env.imsUrl ? (
                <a className="btn-primary min-h-10 px-4 text-sm" href={`${env.imsUrl}/donations.php`} target="_blank" rel="noopener noreferrer">
                  Record a donation in the IMS
                </a>
              ) : undefined
            }
          >
            Each donation and where its goods went shows here once it’s in PHILRADS IMS.
          </EmptyState>
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map(({ d, t }) => {
            const P = PROGRESS_LABEL[t.progress];
            return (
              <li key={d.id} className="tile flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{d.donor}</p>
                    <p className="text-xs text-muted">
                      {d.record_id} · received {formatShortDate(d.date_received)}
                      {d.received_by && ` by ${d.received_by}`}
                    </p>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold ${P.cls}`}>{P.label}</span>
                </div>

                <div
                  className="h-2 overflow-hidden rounded-full bg-white/[0.06]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(t.share * 100)}
                  aria-label={`${Math.round(t.share * 100)}% given out`}
                >
                  <div className={`h-full rounded-full ${t.progress === 'given' ? 'bg-status-in' : 'bg-uplift'}`} style={{ width: `${Math.round(t.share * 100)}%` }} />
                </div>

                <ul className="flex flex-col gap-1 text-sm">
                  {t.lines.map((l, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-x-3">
                      <span className="min-w-0 text-ink-soft">
                        {l.name} <span className="text-xs text-muted">· {formatNumber(l.qty)} {l.unit}</span>
                      </span>
                      <span className="text-xs tabular-nums">
                        <span className="font-semibold text-status-in">{formatNumber(l.given)} given</span>
                        <span className="text-muted"> · {formatNumber(l.remaining)} in stock</span>
                      </span>
                    </li>
                  ))}
                </ul>

                {t.releases.size > 0 ? (
                  <details className="rounded-xl border border-line/60 px-3">
                    <summary className="tap flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
                      <PackageCheck className="h-4 w-4 text-status-in" aria-hidden /> Where it went ({t.releases.size} {t.releases.size === 1 ? 'release' : 'releases'}
                      {t.served ? `, ${formatNumber(t.served)} people served` : ''})
                    </summary>
                    <ol className="flex flex-col gap-2 pb-3">
                      {[...t.releases.values()].map((gs) => {
                        const g = gs[0];
                        return (
                          <li key={g.release_id} className="text-sm">
                            <p className="flex flex-wrap items-center gap-x-1.5">
                              <span className="font-semibold">{g.release_code}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-uplift" aria-label="to" />
                              <span>{g.recipient_org ?? 'Recipient not recorded'}</span>
                            </p>
                            <p className="text-xs text-muted">
                              {[g.date_released && formatShortDate(g.date_released), g.event_name && `Event: ${g.event_name}`, g.beneficiaries_served != null && `${formatNumber(g.beneficiaries_served)} served`]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            <p className="text-xs text-ink-soft">{gs.map((x) => `${formatNumber(x.qty)} ${x.unit} ${x.name}`).join(', ')}</p>
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                ) : (
                  <p className="text-xs text-muted">Not given out yet. It will show here once a release using these goods is fully approved in the IMS.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <div ref={sentinel} className="flex justify-center">
          <button type="button" className="btn-ghost" onClick={showMore}>
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
