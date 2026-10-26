import { useState } from 'react';
import { CheckCheck, CircleCheck, ExternalLink, ShieldCheck } from 'lucide-react';
import { formatDateTime, formatNumber } from '../../lib/format';
import { imsActionUrl, openImsAction } from '../../lib/imsActions';
import type { ImsPendingRelease } from '../../services/inventory/imsSnapshot';
import { EmptyState } from '../ui/Card';

interface Props {
  releases: ImsPendingRelease[];
  imsUrl: string;
  sample: boolean;
}

/**
 * Releases waiting in PHILRADS IMS for their two administrator approvals. "Review and approve"
 * opens the IMS window, where the administrator signs in with their own IMS account and decides;
 * the IMS deducts stock on the second approval and this list updates within seconds.
 */
export function ImsApprovalsPanel({ releases, imsUrl, sample }: Props) {
  const [blocked, setBlocked] = useState<string | null>(null);

  if (releases.length === 0)
    return (
      <EmptyState
        icon={CheckCheck}
        tone="text-status-in"
        title="Nothing waiting for approval"
        action={
          imsUrl ? (
            <a className="btn-ghost min-h-10 px-4 text-sm" href={`${imsUrl}/transactions.php`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden /> See all releases in the IMS
            </a>
          ) : undefined
        }
      >
        New releases from PHILRADS IMS appear here, and on your bell, as soon as they’re requested.
      </EmptyState>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 rounded-xl border border-line/70 px-4 py-3 text-xs text-ink-soft">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
        <span>
          Each release needs two different IMS administrators. Approving opens PHILRADS IMS, where you sign in with your IMS account and confirm. Stock is
          released on the second approval.
          {sample && ' Sample data: the IMS window works once the portal is connected to the live IMS.'}
        </span>
      </p>
      {blocked && (
        <p role="alert" className="rounded-xl border border-status-low/40 bg-status-low/10 px-4 py-3 text-sm">
          Your browser blocked the IMS window.{' '}
          <a className="font-semibold text-uplift underline" href={blocked} target="_blank" rel="opener">
            Open it here
          </a>
          , or allow pop-ups for this site.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {releases.map((r) => {
          const approved = r.approvals.filter((a) => a.decision === 'approved');
          return (
            <li key={r.id} className="tile flex flex-col gap-3 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.code} {r.recipient_org && <span className="font-normal text-ink-soft">· {r.recipient_org}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[r.purpose, r.event_name && `Event: ${r.event_name}`].filter(Boolean).join(' · ') || 'No purpose given'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold ${
                    approved.length ? 'border-status-low/40 bg-status-low/10 text-status-low' : 'border-line text-ink-soft'
                  }`}
                >
                  {approved.length} of 2 approvals
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-line/60 rounded-xl border border-line/60 text-sm">
                {r.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate">{l.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatNumber(l.qty)} <span className="text-xs font-normal text-muted">{l.unit}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Requested by {r.requested_by}
                {r.requested_at && ` · ${formatDateTime(r.requested_at)}`}
                {approved.map((a) => (
                  <span key={a.by} className="ml-2 inline-flex items-center gap-1 text-status-in">
                    <CircleCheck className="h-3 w-3" aria-hidden /> {a.by}
                  </span>
                ))}
              </p>
              <button
                type="button"
                className="btn-primary self-stretch sm:self-end"
                disabled={!imsUrl}
                onClick={() => {
                  setBlocked(null);
                  if (!openImsAction(imsUrl, { act: 'release', id: r.id })) setBlocked(imsActionUrl(imsUrl, { act: 'release', id: r.id }));
                }}
              >
                <ExternalLink className="h-4 w-4" aria-hidden /> Review and approve in IMS
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
