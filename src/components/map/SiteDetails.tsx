import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartColumn, ChevronDown, Crosshair } from 'lucide-react';
import { formatNumber } from '../../lib/format';
import { programMeta, servedText, type ActivitySite } from '../../services/activities/types';
import { RecordDetails } from '../statistics/RecordDetails';
import { Sheet } from '../ui/Sheet';

/** What PHILRADS has done at one site (Statistics layer): totals, then each activity, newest first. */
export function SiteDetails({ site, onClose, onCenter }: { site: ActivitySite; onClose: () => void; onCenter: () => void }) {
  const [open, setOpen] = useState<string | null>(site.activities.length === 1 ? site.activities[0].id : null);
  const years = [...new Set(site.activities.map((a) => a.year))].sort();
  const approx = site.activities[0].geoPrecision;
  return (
    <Sheet
      open
      onClose={onClose}
      title={site.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: programMeta(site.program).color }}>
            <span className="h-2 w-2 rounded-full" style={{ background: programMeta(site.program).color }} aria-hidden />
            PHILRADS activities
          </span>
          <span className="text-muted">
            {years.join(', ')}
            {approx && approx !== 'barangay' && ` · pin at the ${approx === 'approximate' ? 'approximate spot' : `${approx} centre`}`}
          </span>
        </span>
      }
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Link className="btn-primary h-12 px-3" to="/statistics">
            <ChartColumn className="h-4 w-4" aria-hidden /> Statistics
          </Link>
          <button type="button" className="btn-ghost h-12 whitespace-nowrap px-3" onClick={onCenter}>
            <Crosshair className="h-4 w-4" aria-hidden /> Show on map
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Activities', site.activities.length],
            ['Households', site.households],
            ['People', site.individuals],
          ].map(([k, v]) => (
            <div key={k} className="tile px-2 py-3">
              <p className="font-display text-xl tabular-nums tracking-wide">{formatNumber(v as number)}</p>
              <p className="text-xs text-muted">{k}</p>
            </div>
          ))}
        </div>
        <ul className="flex flex-col gap-2">
          {site.activities.map((a) => {
            const p = programMeta(a.program);
            const isOpen = open === a.id;
            return (
              <li key={a.id} className="overflow-hidden rounded-xl border border-line/70">
                <button type="button" className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-white/[0.03]" onClick={() => setOpen(isOpen ? null : a.id)} aria-expanded={isOpen}>
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug">{a.activity}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {a.response && <span className="text-ink-soft">{a.response} · </span>}
                      {a.dateLabel}
                    </span>
                    {servedText(a) && <span className="mt-1 block text-xs font-medium text-ink-soft">{servedText(a)}</span>}
                  </span>
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {isOpen && <RecordDetails a={a} showMapLink={false} className="border-t border-line/60 px-3 py-3" />}
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
