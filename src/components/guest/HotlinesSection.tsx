import { useMemo, useState } from 'react';
import { Phone, Search } from 'lucide-react';
import type { GuestHotline } from '../../services/guest/guestService';
import type { AsyncState } from '../../hooks/useAsyncData';
import { CopyButton, GuestSection, RowsLoading, SectionError } from './guestUi';

/** What a phone dials: digits and a leading + only. */
const dial = (n: string) => n.replace(/[^\d+]/g, '');

function HotlineRow({ h }: { h: GuestHotline }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{h.name}</span>
        {h.note && <span className="block text-xs text-muted">{h.note}</span>}
      </span>
      <CopyButton text={h.number} label="Copy" className="hidden sm:inline-flex" />
      <a
        href={`tel:${dial(h.number)}`}
        className="tap inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface-sunken px-3.5 text-sm font-bold tabular-nums text-ink transition-colors hover:border-ink-mute"
        aria-label={`Call ${h.name}, ${h.number}`}
      >
        <Phone className="h-4 w-4 text-status-out" aria-hidden />
        {h.number}
      </a>
    </li>
  );
}

/**
 * Emergency hotlines: nationwide numbers first, then local disaster offices by area, each one tap
 * to call. Staff keep the list (Guest page → Hotlines); it is saved on the phone for when the
 * signal is weak.
 */
export function HotlinesSection({ hotlines, onRetry }: { hotlines: AsyncState<GuestHotline[]>; onRetry: () => void }) {
  const [q, setQ] = useState('');
  const list = hotlines.data ?? [];
  const national = list.filter((h) => !h.area);
  const local = useMemo(() => {
    const t = q.trim().toLowerCase();
    const rows = list.filter((h) => h.area && (!t || `${h.area} ${h.name}`.toLowerCase().includes(t)));
    const byArea = new Map<string, GuestHotline[]>();
    for (const h of rows) byArea.set(h.area!, [...(byArea.get(h.area!) ?? []), h]);
    return [...byArea.entries()];
  }, [list, q]);
  const anyLocal = list.some((h) => h.area);

  return (
    <GuestSection id="hotlines" title="Hotlines" lead="Numbers to call in an emergency. Tap one to call. In danger right now? Call 911.">
      {hotlines.status === 'loading' ? (
        <RowsLoading />
      ) : hotlines.status === 'error' && !list.length ? (
        <SectionError message={hotlines.error.message} onRetry={onRetry} />
      ) : (
        <div className="flex flex-col gap-7">
          <div>
            <h3 className="text-sm font-semibold text-ink">Nationwide</h3>
            <ul className="mt-2.5 divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-surface">
              {national.map((h) => (
                <HotlineRow key={h.id} h={h} />
              ))}
            </ul>
          </div>
          {anyLocal && (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">By area</h3>
                <label className="relative w-full sm:w-64">
                  <span className="sr-only">Find your province or city</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                  <input className="field pl-9 font-normal" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find your province or city" type="search" />
                </label>
              </div>
              {local.length ? (
                <div className="mt-2.5 flex flex-col gap-4">
                  {local.map(([area, rows]) => (
                    <div key={area}>
                      <p className="mb-1.5 text-xs font-semibold text-muted">{area}</p>
                      <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-surface">
                        {rows.map((h) => (
                          <HotlineRow key={h.id} h={h} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2.5 rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink-soft">No local numbers for “{q.trim()}” yet. Call your barangay hall or 911.</p>
              )}
            </div>
          )}
          <p className="text-xs text-muted">Numbers from the agencies themselves. If one doesn't connect, call 911.</p>
        </div>
      )}
    </GuestSection>
  );
}
