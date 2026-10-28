import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HandHeart, Handshake, MapPin } from 'lucide-react';
import { formatNumber } from '../../lib/format';
import { programMeta, siteKey, type ProgramActivity } from '../../services/activities/types';

const peso = (n: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n);
const SOURCES: Record<string, string> = { DB: 'Statistics database', TR: 'Activity tracker', SR: 'Statistical report' };

/** Everything recorded about one activity: served against target, men and women, funding, donors, partner, notes. */
export function RecordDetails({ a, showMapLink = true, className = '' }: { a: ProgramActivity; showMapLink?: boolean; className?: string }) {
  const rows: [string, ReactNode][] = [];
  const nf = formatNumber;
  const pair = (served: number | null, target: number | null) =>
    served === null && target === null ? null : (
      <>
        {served !== null ? nf(served) : '—'}
        {target !== null && <span className="text-muted"> of {nf(target)} targeted</span>}
      </>
    );
  const hh = pair(a.householdsServed, a.householdsTarget);
  const ind = pair(a.individualsServed, a.individualsTarget);
  if (hh) rows.push(['Households', hh]);
  if (ind) rows.push(['Individuals', ind]);
  if (a.servedNote) rows.push(['Reached', a.servedNote]);
  if (a.male !== null || a.female !== null) rows.push(['Men / women', `${a.male !== null ? nf(a.male) : '—'} / ${a.female !== null ? nf(a.female) : '—'}`]);
  if (a.funding !== null || a.fundingNote) rows.push(['Funding', <>{a.funding !== null && peso(a.funding)} {a.fundingNote && <span className="text-muted">{a.funding !== null ? `(${a.fundingNote})` : a.fundingNote}</span>}</>]);
  rows.push(['Program', programMeta(a.program).label]);
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3">
            <dt className="w-28 shrink-0 text-xs text-muted">{k}</dt>
            <dd className="min-w-0 text-ink-soft">{v}</dd>
          </div>
        ))}
      </dl>
      {(a.donors || a.partner || a.contactPerson) && (
        <div className="tile flex flex-col gap-1.5 p-3 text-sm">
          {a.donors && (
            <p className="flex gap-2">
              <HandHeart className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
              <span>
                <span className="text-xs text-muted">Donors: </span>
                {a.donors}
              </span>
            </p>
          )}
          {(a.partner || a.contactPerson) && (
            <p className="flex gap-2">
              <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
              <span>
                <span className="text-xs text-muted">Partner: </span>
                {[a.partner, a.contactPerson].filter(Boolean).join(' · ')}
              </span>
            </p>
          )}
        </div>
      )}
      {a.notes && <p className="text-xs text-muted">{a.notes}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {a.source && <span>Source: {a.source.replace(/\b(DB|TR|SR)\b/g, (k) => SOURCES[k])}</span>}
        {showMapLink && a.lat !== null && a.lng !== null && (
          <Link className="link" to={`/live-map?site=${siteKey({ lat: a.lat, lng: a.lng })}`}>
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Show on the Live Map
            {a.geoPrecision && a.geoPrecision !== 'barangay' && <span className="font-normal text-muted">({a.geoPrecision === 'approximate' ? 'approximate' : `${a.geoPrecision} centre`})</span>}
          </Link>
        )}
      </div>
    </div>
  );
}
