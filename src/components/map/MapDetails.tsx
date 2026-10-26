import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Crosshair, Navigation, Package, Pencil, Trash2, TriangleAlert, Users } from 'lucide-react';
import { directionsUrl, distanceM, formatDistance, formatLatLng, timeAgo } from '../../lib/geo';
import { formatNumber } from '../../lib/format';
import { eventAt, stockAt } from '../../lib/mapStock';
import type { InventorySnapshot } from '../../services/inventory/types';
import { kindMeta, type CheckIn, type MapPlace } from '../../services/map/types';
import { Sheet } from '../ui/Sheet';

interface PlaceProps {
  place: MapPlace;
  snapshot: InventorySnapshot | null;
  checkIns: CheckIn[];
  canManage: boolean;
  onClose: () => void;
  onCenter: () => void;
  onEdit: () => void;
  onSelectCheckIn: (c: CheckIn) => void;
}

/** A place's details: live IMS stock, people served, who from the team is nearby, directions. */
export function PlaceDetails({ place, snapshot, checkIns, canManage, onClose, onCenter, onEdit, onSelectCheckIn }: PlaceProps) {
  const meta = kindMeta(place.kind);
  const stock = stockAt(snapshot, place.imsLocation);
  const event = eventAt(snapshot, place.imsEventId);
  const nearby = checkIns.map((c) => ({ c, d: distanceM(c, place) })).filter((x) => x.d < 2000).sort((a, b) => a.d - b.d);
  const pct = event && event.target > 0 ? Math.min(100, Math.round((event.served / event.target) * 100)) : 0;

  return (
    <Sheet
      open
      onClose={onClose}
      title={place.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: meta.color }}>
            <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} aria-hidden />
            {meta.label}
          </span>
          {place.address && <span className="text-muted">{place.address}</span>}
        </span>
      }
      footer={
        <div className="grid grid-cols-2 gap-2">
          <a className="btn-primary h-12 px-3" href={directionsUrl(place)} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-4 w-4" aria-hidden /> Directions
          </a>
          <button type="button" className="btn-ghost h-12 whitespace-nowrap px-3" onClick={onCenter}>
            <Crosshair className="h-4 w-4" aria-hidden /> Show on map
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {place.imsLocation && (
          <section className="tile flex flex-col gap-3 p-4" aria-labelledby="pd-stock">
            <div className="flex items-center justify-between gap-2">
              <h3 id="pd-stock" className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-uplift" aria-hidden /> Stock here
              </h3>
              <span className="text-[0.6875rem] text-muted">Live from PHILRADS IMS</span>
            </div>
            {stock ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Items" value={formatNumber(stock.items)} />
                  <Stat label="Low" value={formatNumber(stock.low)} tone={stock.low ? 'text-status-low' : undefined} />
                  <Stat label="Expiring" value={formatNumber(stock.expiring + stock.expired)} tone={stock.expiring + stock.expired ? 'text-status-expiring' : undefined} />
                </div>
                {stock.top.length > 0 && (
                  <ul className="flex flex-col divide-y divide-line/60 text-sm">
                    {stock.top.map((t) => (
                      <li key={t.name} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="min-w-0 truncate">{t.name}</span>
                        <span className="shrink-0 tabular-nums text-ink-soft">
                          {formatNumber(t.qty)} {t.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to={`/inventory?loc=${encodeURIComponent(stock.locationId)}`} className="link self-start">
                  See all stock here <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </>
            ) : (
              <p className="flex items-start gap-2 text-xs text-muted">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-low" aria-hidden />
                No stock is recorded at “{place.imsLocation}” in the IMS right now.
              </p>
            )}
          </section>
        )}

        {event && (
          <section className="tile flex flex-col gap-3 p-4" aria-labelledby="pd-event">
            <h3 id="pd-event" className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-rose" aria-hidden /> {event.name}
            </h3>
            <div>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>
                  <strong className="text-lg tabular-nums">{formatNumber(event.served)}</strong> <span className="text-muted">of {formatNumber(event.target)} people served</span>
                </span>
                <span className="text-xs font-semibold tabular-nums text-ink-soft">{pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="People served">
                <div className="h-full rounded-full bg-gradient-to-r from-rose to-uplift" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {event.areas.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-ink-soft">
                {event.areas.slice(0, 3).map((a) => (
                  <li key={a.area} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{a.area}</span>
                    <span className="shrink-0 tabular-nums">{formatNumber(a.served)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/response" className="link self-start">
              Open in Response <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </section>
        )}

        <section aria-labelledby="pd-team" className="flex flex-col gap-2">
          <h3 id="pd-team" className="text-sm font-semibold">
            Team nearby <span className="font-normal text-muted">within 2 km, last 24 h</span>
          </h3>
          {nearby.length === 0 ? (
            <p className="text-xs text-muted">Nobody has checked in near here today.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {nearby.map(({ c, d }) => (
                <li key={c.id}>
                  <button type="button" className="tap flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-white/[0.04]" onClick={() => onSelectCheckIn(c)}>
                    <span className="min-w-0 truncate font-medium">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {formatDistance(d)} · {timeAgo(c.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {place.notes && <p className="rounded-xl border border-line/70 px-4 py-3 text-sm text-ink-soft">{place.notes}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="tabular-nums">{formatLatLng(place)}</span>
          {canManage && (
            <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit place
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-2 py-2">
      <p className={`text-lg font-bold tabular-nums ${tone ?? 'text-ink'}`}>{value}</p>
      <p className="text-[0.6875rem] text-muted">{label}</p>
    </div>
  );
}

interface CheckInProps {
  checkIn: CheckIn;
  places: MapPlace[];
  onClose: () => void;
  onCenter: () => void;
  onRemove: () => void;
  removing: boolean;
}

/** A team member's check-in: when, where (nearest place), their note. Your own can be removed. */
export function CheckInDetails({ checkIn: c, places, onClose, onCenter, onRemove, removing }: CheckInProps) {
  const nearest = places.map((p) => ({ p, d: distanceM(p, c) })).sort((a, b) => a.d - b.d)[0];
  return (
    <Sheet
      open
      onClose={onClose}
      title={c.mine ? 'Your check-in' : c.name}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Checked in {timeAgo(c.createdAt)}
          {c.accuracyM ? ` · within ${formatDistance(c.accuracyM)}` : ''}
        </span>
      }
      footer={
        <div className="grid grid-cols-2 gap-2">
          <a className="btn-primary h-12 px-3" href={directionsUrl(c)} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-4 w-4" aria-hidden /> Directions
          </a>
          <button type="button" className="btn-ghost h-12 whitespace-nowrap px-3" onClick={onCenter}>
            <Crosshair className="h-4 w-4" aria-hidden /> Show on map
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {c.note && <p className="rounded-xl border border-line/70 px-4 py-3 text-sm">“{c.note}”</p>}
        {nearest && nearest.d < 50_000 && (
          <p className="text-sm text-ink-soft">
            {formatDistance(nearest.d)} from <strong className="font-semibold text-ink">{nearest.p.name}</strong>
          </p>
        )}
        <p className="text-xs text-muted">Check-ins are shared on purpose, with PHILRADS staff only, and disappear after 24 hours.</p>
        {c.mine && (
          <button type="button" className="btn-ghost self-start text-status-out" onClick={onRemove} disabled={removing}>
            <Trash2 className="h-4 w-4" aria-hidden /> Remove my check-in
          </button>
        )}
      </div>
    </Sheet>
  );
}
