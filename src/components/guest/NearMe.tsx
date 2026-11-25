import { useState } from 'react';
import { LocateFixed, MapPin, Navigation, X } from 'lucide-react';
import type { GuestPlace } from '../../services/guest/guestService';
import { kmBetween } from '../../services/guest/regions';
import { kindMeta } from '../../services/map/types';
import { currentPosition, directionsUrl } from '../../lib/geo';
import { BusyLabel } from '../ui/BusyLabel';

/** Places a guest can go to for help (warehouses are for stock, not visitors). */
const OPEN_TO_PUBLIC = new Set(['evacuation_center', 'response_site', 'distribution_point', 'hub', 'office']);

const kmText = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString('en-PH')} km`);

export type Me = { lat: number; lng: number };

/**
 * "Find the nearest site": the phone's position, once, when asked, and the three PHILRADS places
 * closest to it, each with directions. The position stays on the phone.
 */
export function NearMe({ places, me, onMe, onShow }: { places: GuestPlace[]; me: Me | null; onMe: (m: Me | null) => void; onShow: (p: GuestPlace) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setBusy(true);
    setError(null);
    const r = await currentPosition({ goodM: 200, waitMs: 8000 });
    setBusy(false);
    if (r.ok) onMe({ lat: r.lat, lng: r.lng });
    else setError(r.reason);
  };

  const open = places.filter((p) => OPEN_TO_PUBLIC.has(p.kind));
  const nearest = me
    ? open
        .map((p) => ({ p, km: kmBetween(me, p) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 3)
    : [];

  if (!me)
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className="btn-primary self-start" onClick={find} disabled={busy}>
          <LocateFixed className="h-4 w-4" aria-hidden />
          <BusyLabel busy={busy} busyText="Finding you…">
            Find the nearest site
          </BusyLabel>
        </button>
        {error ? <p className="text-sm text-status-out">{error}</p> : <p className="text-xs text-muted">Your location stays on this phone.</p>}
      </div>
    );

  return (
    <div className="animate-pop-in rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{nearest.length ? 'Nearest to you' : 'No PHILRADS sites listed yet'}</p>
        <button type="button" className="icon-btn -m-1.5" onClick={() => onMe(null)} aria-label="Stop showing places near me">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {nearest.length > 0 && (
        <ul className="mt-2 divide-y divide-line/70">
          {nearest.map(({ p, km }) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <button type="button" onClick={() => onShow(p)} className="tap min-w-0 flex-1 text-left" aria-label={`Show ${p.name} on the map`}>
                <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: kindMeta(p.kind).color }} aria-hidden />
                  {kindMeta(p.kind).label}, {kmText(km)} away
                </span>
              </button>
              <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer" className="chip min-h-9 shrink-0 gap-1.5" aria-label={`Directions to ${p.name}`}>
                <Navigation className="h-3.5 w-3.5" aria-hidden /> Directions
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 flex gap-1.5 text-xs text-muted">
        <MapPin className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        Your barangay also runs evacuation centers: ask at the barangay hall, or follow your local officials.
      </p>
    </div>
  );
}
