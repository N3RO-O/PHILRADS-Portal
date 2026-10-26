import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CloudOff, List, LocateFixed, Loader2, MapPin, Maximize2, Plus, Search, UserRound, X } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { CheckInDetails, PlaceDetails } from '../components/map/MapDetails';
import { CheckInSheet, PlaceForm } from '../components/map/MapForms';
import { MapCanvas, type MapFocus } from '../components/map/MapCanvas';
import { LoadError } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { Sheet } from '../components/ui/Sheet';
import { useAsyncData } from '../hooks/useAsyncData';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { currentPosition, timeAgo, type LatLng } from '../lib/geo';
import { formatNumber, initialsOf } from '../lib/format';
import { useLiveRefresh } from '../lib/imsActions';
import { eventAt, stockAt } from '../lib/mapStock';
import { inventoryStore, mapService } from '../services';
import { useInventoryState } from '../services/inventory/inventoryStore';
import type { InventorySnapshot } from '../services/inventory/types';
import { kindMeta, PLACE_KINDS, type CheckIn, type MapPlace, type PlaceDraft, type PlaceKind } from '../services/map/types';

type Layer = PlaceKind | 'team';
const ALL_LAYERS: Layer[] = [...PLACE_KINDS.map((k) => k.key), 'team'];
const LAYER_KEY = 'philrads.map.layers';
const readLayers = (): Set<Layer> => {
  try {
    const raw = localStorage.getItem(LAYER_KEY);
    if (raw) return new Set((JSON.parse(raw) as Layer[]).filter((l) => ALL_LAYERS.includes(l)));
  } catch {
    /* default: everything */
  }
  return new Set(ALL_LAYERS);
};

type Selected = { type: 'place' | 'checkin'; id: string } | null;
type Panel = { type: 'form'; draft: PlaceDraft } | { type: 'checkin' } | { type: 'list' } | null;
const blankDraft = (): PlaceDraft => ({ name: '', kind: 'response_site', lat: NaN, lng: NaN, address: '', notes: '', imsLocation: null, imsEventId: null });

/** Live Map: PHILRADS places with their live IMS stock and people served, and where the team checked in today. */
export function LiveMapPage() {
  const { can, profile } = useAuth();
  const online = useOnlineStatus();
  const canManage = can('map.manage');
  const canCheckIn = can('map.checkin');
  const placesQ = useAsyncData(() => mapService.listPlaces());
  const checksQ = useAsyncData(() => mapService.listCheckIns());
  useLiveRefresh(true, checksQ.reload);
  const { snapshot } = useInventoryState(inventoryStore);
  useEffect(() => {
    if (!profile) return;
    void inventoryStore.start({ id: profile.id, name: profile.displayName });
    return () => inventoryStore.stop();
  }, [profile]);

  const [layers, setLayers] = useState(readLayers);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Selected>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [fit, setFit] = useState<{ points: LatLng[]; key: number } | null>(null);
  const [me, setMe] = useState<(LatLng & { accuracyM: number }) | null>(null);
  const [locating, setLocating] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [picking, setPicking] = useState<PlaceDraft | null>(null);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const places = placesQ.status === 'success' ? placesQ.data : [];
  const checkIns = checksQ.status === 'success' ? checksQ.data : [];
  const needle = search.trim().toLowerCase();
  const shownPlaces = useMemo(
    () => places.filter((p) => layers.has(p.kind) && (!needle || [p.name, p.address, kindMeta(p.kind).label, p.imsLocation].some((s) => s?.toLowerCase().includes(needle)))),
    [places, layers, needle],
  );
  const shownCheckIns = useMemo(() => (layers.has('team') ? checkIns.filter((c) => !needle || [c.name, c.note].some((s) => s?.toLowerCase().includes(needle))) : []), [checkIns, layers, needle]);

  // First load: fit everything in view.
  const [fitted, setFitted] = useState(false);
  useEffect(() => {
    if (fitted || placesQ.status !== 'success') return;
    setFitted(true);
    const pts = [...shownPlaces, ...shownCheckIns];
    if (pts.length) setFit({ points: pts, key: Date.now() });
  }, [fitted, placesQ.status, shownPlaces, shownCheckIns]);

  const toggleLayer = (l: Layer) =>
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      try {
        localStorage.setItem(LAYER_KEY, JSON.stringify([...next]));
      } catch {
        /* per-device preference only */
      }
      return next;
    });

  const select = useCallback((s: Selected, fly = false) => {
    setSelected(s);
    setPanel(null);
    if (!s || !fly) return;
    const p = s.type === 'place' ? places.find((x) => x.id === s.id) : checkIns.find((x) => x.id === s.id);
    if (p) setFocus({ lat: p.lat, lng: p.lng, zoom: 15, key: Date.now() });
  }, [places, checkIns]);

  const locateMe = async () => {
    setLocating(true);
    const r = await currentPosition();
    setLocating(false);
    if (!r.ok) return setToast({ text: r.reason, error: true });
    setMe({ lat: r.lat, lng: r.lng, accuracyM: r.accuracyM });
    setFocus({ lat: r.lat, lng: r.lng, zoom: 15, key: Date.now() });
  };

  const selectedPlace = selected?.type === 'place' ? places.find((p) => p.id === selected.id) ?? null : null;
  const selectedCheck = selected?.type === 'checkin' ? checkIns.find((c) => c.id === selected.id) ?? null : null;

  if (!can('map.read'))
    return (
      <p className="card text-sm text-ink-soft" role="alert">
        Your role doesn’t include the Live Map. Ask an administrator if you need it.
      </p>
    );

  const panelProps: PanelProps = {
    search,
    setSearch,
    layers,
    toggleLayer,
    places,
    shownPlaces,
    checkIns,
    shownCheckIns,
    snapshot,
    canManage,
    onAdd: () => setPanel({ type: 'form', draft: blankDraft() }),
    onSelect: (s) => select(s, true),
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="card relative overflow-hidden p-0 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Desktop: list and layers beside the map */}
        <aside className="hidden h-[calc(100dvh-13rem)] min-h-[34rem] flex-col border-r border-line/70 lg:flex">
          <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
            <h2 className="card-title flex items-center gap-2 whitespace-nowrap">
              <MapPin className="h-4 w-4 text-uplift" aria-hidden /> Places and team
              {mapService.source === 'mock' && <SampleBadge />}
            </h2>
            {canManage && (
              <button type="button" className="btn-primary min-h-9 shrink-0 whitespace-nowrap px-3 text-xs" onClick={panelProps.onAdd} disabled={!online}>
                <Plus className="h-4 w-4" aria-hidden /> Add place
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <PlacesPanel {...panelProps} />
          </div>
        </aside>

        {/* Phones: the map fills the rest of the screen under the page title (top bar ≈ 7.5rem + title ≈ 8rem). */}
        <div className="relative h-[calc(100dvh-15.5rem)] min-h-[20rem] lg:h-[calc(100dvh-13rem)] lg:min-h-[34rem]">
          {placesQ.status === 'error' ? (
            <div className="grid h-full place-items-center p-6">
              <LoadError message={online ? 'The map could not be loaded.' : 'You’re offline and this device has no saved copy of the map yet.'} onRetry={placesQ.reload} />
            </div>
          ) : (
            <MapCanvas
              places={shownPlaces}
              checkIns={shownCheckIns}
              selected={selected}
              onSelect={(s) => select(s)}
              focus={focus}
              fit={fit}
              me={me}
              picking={Boolean(picking)}
              onCenter={setCenter}
            />
          )}

          {/* Top-right: fit and my location */}
          {!picking && (
            <div className="absolute right-3 top-3 z-[600] flex flex-col gap-2">
              <MapButton label="Show everything" onClick={() => setFit({ points: [...shownPlaces, ...shownCheckIns], key: Date.now() })}>
                <Maximize2 className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              </MapButton>
              <MapButton label="Show my location" onClick={() => void locateMe()}>
                {locating ? <Loader2 className="h-[1.125rem] w-[1.125rem] animate-spin" aria-hidden /> : <LocateFixed className="h-[1.125rem] w-[1.125rem]" aria-hidden />}
              </MapButton>
            </div>
          )}

          {!online && !picking && (
            <p className="absolute left-3 right-16 top-3 z-[600] flex items-start gap-2 rounded-xl border border-line bg-surface-raised/95 px-3 py-2 text-xs text-ink-soft shadow-xl backdrop-blur-md lg:right-auto lg:max-w-sm">
              <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden />
              You’re offline: places from your last visit, and map areas you’ve viewed before.
            </p>
          )}

          {placesQ.status === 'success' && places.length === 0 && !picking && (
            <div className="absolute inset-x-3 top-16 z-[600] mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-line bg-surface-raised/95 p-5 text-center shadow-2xl backdrop-blur-md">
              <MapPin className="h-7 w-7 text-uplift" aria-hidden />
              <p className="text-sm font-semibold">No places pinned yet</p>
              <p className="text-xs text-muted">Pin warehouses, hubs and response sites so everyone can find them and see their stock.</p>
              {canManage && (
                <button type="button" className="btn-primary min-h-10 px-4 text-sm" onClick={panelProps.onAdd}>
                  <Plus className="h-4 w-4" aria-hidden /> Add the first place
                </button>
              )}
            </div>
          )}

          {/* Picking a spot: crosshair in the middle, actions at the bottom (thumb reach) */}
          {picking && (
            <div className="absolute inset-x-3 bottom-3 z-[600] mx-auto flex max-w-md flex-col gap-3 rounded-2xl border border-uplift/40 bg-surface-raised/95 p-4 shadow-2xl backdrop-blur-md">
              <p className="text-sm">
                <strong className="font-semibold">Move the map</strong> until the crosshair sits on {picking.name.trim() ? `“${picking.name.trim()}”` : 'the place'}.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn-ghost min-h-11"
                  onClick={() => {
                    setPanel({ type: 'form', draft: picking });
                    setPicking(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary min-h-11"
                  disabled={!center}
                  onClick={() => {
                    if (!center) return;
                    setPanel({ type: 'form', draft: { ...picking, lat: center.lat, lng: center.lng } });
                    setPicking(null);
                  }}
                >
                  Use this spot
                </button>
              </div>
            </div>
          )}

          {/* Phones: list and check-in at the bottom, within thumb reach */}
          {!picking && (
            <div className="absolute inset-x-3 bottom-6 z-[600] flex items-center justify-between gap-2 lg:hidden">
              <button type="button" className="flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface-raised/95 px-4 text-sm font-semibold shadow-xl backdrop-blur-md" onClick={() => setPanel({ type: 'list' })}>
                <List className="h-4 w-4 text-uplift" aria-hidden /> List
                <span className="text-xs font-normal text-muted">{formatNumber(shownPlaces.length + shownCheckIns.length)}</span>
              </button>
              {canCheckIn && (
                <button type="button" className="flex min-h-12 items-center gap-2 rounded-full bg-uplift px-5 text-sm font-bold text-page shadow-xl shadow-black/50 transition active:scale-95" onClick={() => setPanel({ type: 'checkin' })} disabled={!online}>
                  <UserRound className="h-4 w-4" aria-hidden /> Check in here
                </button>
              )}
            </div>
          )}
          {/* Desktop: check-in in the corner */}
          {!picking && canCheckIn && (
            <button type="button" className="btn-primary absolute bottom-8 right-3 z-[600] hidden shadow-xl shadow-black/50 lg:inline-flex" onClick={() => setPanel({ type: 'checkin' })} disabled={!online}>
              <UserRound className="h-4 w-4" aria-hidden /> Check in here
            </button>
          )}
        </div>
      </section>

      {panel?.type === 'list' && (
        <Sheet
          open
          onClose={() => setPanel(null)}
          title={
            <span className="flex items-center gap-2">
              Places and team {mapService.source === 'mock' && <SampleBadge />}
            </span>
          }
          footer={
            canManage ? (
              <button type="button" className="btn-primary h-12 w-full" onClick={panelProps.onAdd} disabled={!online}>
                <Plus className="h-4 w-4" aria-hidden /> Add a place
              </button>
            ) : undefined
          }
        >
          <PlacesPanel {...panelProps} />
        </Sheet>
      )}

      {selectedPlace && !panel && (
        <PlaceDetails
          place={selectedPlace}
          snapshot={snapshot}
          checkIns={checkIns}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onCenter={() => {
            setFocus({ lat: selectedPlace.lat, lng: selectedPlace.lng, zoom: 16, key: Date.now() });
            setSelected(null);
          }}
          onEdit={() =>
            setPanel({
              type: 'form',
              draft: { ...selectedPlace, address: selectedPlace.address ?? '', notes: selectedPlace.notes ?? '' },
            })
          }
          onSelectCheckIn={(c) => select({ type: 'checkin', id: c.id }, true)}
        />
      )}
      {selectedCheck && !panel && (
        <CheckInDetails
          checkIn={selectedCheck}
          places={places}
          removing={removing}
          onClose={() => setSelected(null)}
          onCenter={() => {
            setFocus({ lat: selectedCheck.lat, lng: selectedCheck.lng, zoom: 16, key: Date.now() });
            setSelected(null);
          }}
          onRemove={async () => {
            setRemoving(true);
            try {
              await mapService.removeCheckIn(selectedCheck.id);
              setSelected(null);
              checksQ.reload();
              setToast({ text: 'Your check-in is removed.' });
            } catch {
              setToast({ text: 'Could not remove it. Check the connection and try again.', error: true });
            } finally {
              setRemoving(false);
            }
          }}
        />
      )}

      {panel?.type === 'form' && (
        <PlaceForm
          draft={panel.draft}
          snapshot={snapshot}
          onChange={(d) => setPanel({ type: 'form', draft: d })}
          onClose={() => setPanel(null)}
          onPick={() => {
            const d = panel.draft;
            setPanel(null);
            setSelected(null);
            setPicking(d);
            if (Number.isFinite(d.lat)) setFocus({ lat: d.lat, lng: d.lng, zoom: 16, key: Date.now() });
          }}
          onSave={async (d) => {
            const saved = await mapService.savePlace(d);
            setPanel(null);
            placesQ.reload();
            setLayers((l) => new Set([...l, saved.kind]));
            setFocus({ lat: saved.lat, lng: saved.lng, zoom: 15, key: Date.now() });
            setToast({ text: d.id ? `Saved “${saved.name}”.` : `“${saved.name}” is on the map.` });
          }}
          onRemove={
            panel.draft.id
              ? async () => {
                  await mapService.removePlace(panel.draft.id!);
                  setPanel(null);
                  setSelected(null);
                  placesQ.reload();
                  setToast({ text: `Took “${panel.draft.name}” off the map.` });
                }
              : undefined
          }
        />
      )}

      {panel?.type === 'checkin' && (
        <CheckInSheet
          places={places}
          onClose={() => setPanel(null)}
          onShare={async (d) => {
            const c = await mapService.checkIn(d);
            setPanel(null);
            checksQ.reload();
            setLayers((l) => new Set([...l, 'team']));
            setFocus({ lat: c.lat, lng: c.lng, zoom: 15, key: Date.now() });
            setToast({ text: 'You’re on the map. The team can see this check-in for 24 hours.' });
          }}
        />
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[1100] flex justify-center md:bottom-6 md:left-auto md:right-6 md:justify-end">
        {toast && (
          <p
            role={toast.error ? 'alert' : undefined}
            className={`pointer-events-auto flex max-w-md animate-pop-in items-start gap-3 rounded-2xl border bg-surface-raised px-4 py-3 text-sm shadow-2xl shadow-black/50 ${toast.error ? 'border-status-out/50' : 'border-status-in/40'}`}
          >
            <span className="flex-1">{toast.text}</span>
            <button type="button" className="-m-1 grid h-8 w-8 shrink-0 place-items-center text-muted hover:text-ink" onClick={() => setToast(null)} aria-label="Dismiss">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface-raised/95 text-ink shadow-xl shadow-black/50 backdrop-blur-md transition hover:bg-surface-raised"
    >
      {children}
    </button>
  );
}

interface PanelProps {
  search: string;
  setSearch: (s: string) => void;
  layers: Set<Layer>;
  toggleLayer: (l: Layer) => void;
  places: MapPlace[];
  shownPlaces: MapPlace[];
  checkIns: CheckIn[];
  shownCheckIns: CheckIn[];
  snapshot: InventorySnapshot | null;
  canManage: boolean;
  onAdd: () => void;
  onSelect: (s: Selected) => void;
}

/** Search, layers (with counts) and the lists of team check-ins and places. */
function PlacesPanel({ search, setSearch, layers, toggleLayer, places, shownPlaces, checkIns, shownCheckIns, snapshot, canManage, onAdd, onSelect }: PanelProps) {
  const counts = (l: Layer) => (l === 'team' ? checkIns.length : places.filter((p) => p.kind === l).length);
  const sorted = [...shownPlaces].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <label htmlFor="map-search" className="sr-only">
          Search places and team
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input id="map-search" type="search" className="field pl-10" placeholder="Search places or people" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Show on the map</legend>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
          {[...PLACE_KINDS.map((k) => ({ key: k.key as Layer, label: k.plural, color: k.color })), { key: 'team' as Layer, label: 'Team check-ins today', color: '#7a1f1f' }].map((l) => (
            <label key={l.key} className="tap flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm hover:bg-white/[0.04]">
              <input type="checkbox" className="h-4 w-4 accent-uplift" checked={layers.has(l.key)} onChange={() => toggleLayer(l.key)} />
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{l.label}</span>
              <span className="text-xs tabular-nums text-muted">{counts(l.key)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {layers.has('team') && (
        <section aria-labelledby="map-team">
          <h3 id="map-team" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Team today <span className="font-normal normal-case tracking-normal">{shownCheckIns.length}</span>
          </h3>
          {shownCheckIns.length === 0 ? (
            <p className="rounded-xl bg-white/[0.02] px-3 py-3 text-xs text-muted">Nobody has checked in in the last 24 hours. In the field, tap “Check in here” so coordinators can see you.</p>
          ) : (
            <ul className="flex flex-col">
              {shownCheckIns.map((c) => (
                <li key={c.id}>
                  <button type="button" className="tap flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.04]" onClick={() => onSelect({ type: 'checkin', id: c.id })}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold ${c.mine ? 'bg-uplift text-page' : 'bg-burgundy-600 text-white'}`} aria-hidden>
                      {initialsOf(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.mine ? 'You' : c.name}</span>
                      <span className="block truncate text-xs text-muted">{c.note ?? 'Checked in'}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(c.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="map-places">
        <h3 id="map-places" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Places <span className="font-normal normal-case tracking-normal">{sorted.length}</span>
        </h3>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-xl bg-white/[0.02] px-3 py-3 text-xs text-muted">
            {places.length === 0 ? 'No places pinned yet.' : 'No places match. Try another word, or turn more layers on.'}
            {places.length === 0 && canManage && (
              <button type="button" className="btn-primary min-h-9 px-3 text-xs" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add the first place
              </button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col">
            {sorted.map((p) => {
              const meta = kindMeta(p.kind);
              const stock = stockAt(snapshot, p.imsLocation);
              const event = eventAt(snapshot, p.imsEventId);
              const detail = stock
                ? `${formatNumber(stock.items)} items in stock${stock.low ? ` · ${stock.low} low` : ''}`
                : event
                  ? `${formatNumber(event.served)} of ${formatNumber(event.target)} served`
                  : (p.address ?? meta.label);
              return (
                <li key={p.id}>
                  <button type="button" className="tap flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.04]" onClick={() => onSelect({ type: 'place', id: p.id })}>
                    <span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-white/[0.04]" style={{ background: meta.color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className={`block truncate text-xs ${stock?.low ? 'text-status-low' : 'text-muted'}`}>{detail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
