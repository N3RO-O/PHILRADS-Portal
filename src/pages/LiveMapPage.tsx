import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CloudOff, CloudSun, Fullscreen, List, LocateFixed, Loader2, MapPin, Maximize2, Minimize2, Plus, Search, UserRound, X } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { CheckInDetails, LiveDetails, PlaceDetails } from '../components/map/MapDetails';
import { CheckInSheet, PlaceForm } from '../components/map/MapForms';
import { SiteDetails } from '../components/map/SiteDetails';
import { isFresh, MapCanvas, type MapFocus, type MapSelection } from '../components/map/MapCanvas';
import { LiveShareCard, useLiveSharing } from '../components/map/LiveSharing';
import { useMapWeather } from '../components/map/useMapWeather';
import { SpotSheet, WeatherBar } from '../components/map/WeatherPanel';
import { LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { Sheet } from '../components/ui/Sheet';
import { Switch } from '../components/ui/Switch';
import { useAsyncData } from '../hooks/useAsyncData';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { currentPosition, distanceM, timeAgo, type LatLng } from '../lib/geo';
import { formatNumber, initialsOf } from '../lib/format';
import { useLiveRefresh } from '../lib/imsActions';
import { eventAt, stockAt } from '../lib/mapStock';
import { activitiesService, inventoryStore, mapService } from '../services';
import { groupSites, PROGRAMS, programMeta, withoutFunding, type ActivitySite } from '../services/activities/types';
import { useInventoryState } from '../services/inventory/inventoryStore';
import type { InventorySnapshot } from '../services/inventory/types';
import { kindMeta, PLACE_KINDS, type CheckIn, type LivePosition, type MapPlace, type PlaceDraft, type PlaceKind } from '../services/map/types';

type Layer = PlaceKind | 'team' | 'activities';
const ALL_LAYERS: Layer[] = [...PLACE_KINDS.map((k) => k.key), 'team', 'activities'];
const LAYER_KEY = 'philrads.map.layers';
// Saved choices from before the Statistics layer existed: it's added once, turned on.
const ACTIVITIES_ADDED = 'philrads.map.layers.activities';
const readLayers = (): Set<Layer> => {
  try {
    const raw = localStorage.getItem(LAYER_KEY);
    if (raw) {
      const saved = new Set((JSON.parse(raw) as Layer[]).filter((l) => ALL_LAYERS.includes(l)));
      if (!localStorage.getItem(ACTIVITIES_ADDED)) {
        localStorage.setItem(ACTIVITIES_ADDED, '1');
        saved.add('activities');
      }
      return saved;
    }
  } catch {
    /* default: everything */
  }
  return new Set(ALL_LAYERS);
};

type Selected = MapSelection;
type Panel = { type: 'form'; draft: PlaceDraft } | { type: 'checkin' } | { type: 'list' } | { type: 'share' } | null;
const blankDraft = (): PlaceDraft => ({ name: '', kind: 'response_site', lat: NaN, lng: NaN, address: '', notes: '', imsLocation: null, imsEventId: null });

/** Live Map: PHILRADS places with their live IMS stock and people served, and where the team checked in today. */
export function LiveMapPage() {
  const { can, profile } = useAuth();
  const online = useOnlineStatus();
  const canManage = can('map.manage');
  const canCheckIn = can('map.checkin');
  const placesQ = useAsyncData(() => mapService.listPlaces());
  const checksQ = useAsyncData(() => mapService.listCheckIns());
  const activitiesQ = useAsyncData(() => activitiesService.list());
  const [actYear, setActYear] = useState<number | 'all'>('all');
  const [params, setParams] = useSearchParams();
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
  const sharing = useLiveSharing();
  const weather = useMapWeather(online);
  /** With the weather on: the spot tapped on the map, to show its forecast. */
  const [spot, setSpot] = useState<LatLng | null>(null);
  useEffect(() => {
    if (!weather.mode) setSpot(null);
  }, [weather.mode]);

  // Phones: size the map to end at the bottom of the screen, measured from where it starts.
  const mapBox = useRef<HTMLDivElement>(null);
  const [phoneHeight, setPhoneHeight] = useState<number | null>(null);

  // Full screen: the browser's own where it can; otherwise (iPhone) the map fills the window.
  const [full, setFull] = useState<'off' | 'screen' | 'window'>('off');
  const toggleFull = async () => {
    if (full === 'screen') return void document.exitFullscreen().catch(() => setFull('off'));
    if (full === 'window') return setFull('off');
    const el = mapBox.current;
    if (el?.requestFullscreen && document.fullscreenEnabled) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
        return;
      } catch {
        /* not allowed here: fill the window instead */
      }
    }
    setFull('window');
  };
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement && document.fullscreenElement === mapBox.current ? 'screen' : 'off');
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => {
    if (full !== 'window') return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('dialog[open]') && setFull('off');
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [full]);
  useEffect(() => {
    const update = () => {
      const el = mapBox.current;
      if (!el || window.matchMedia('(min-width: 1024px)').matches) return setPhoneHeight(null);
      const top = el.getBoundingClientRect().top + window.scrollY;
      setPhoneHeight(Math.max(320, Math.round(window.innerHeight - top - 16)));
    };
    update();
    const ro = new ResizeObserver(update);
    const header = document.querySelector('header');
    if (header) ro.observe(header);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // Live locations: loaded once, then kept current in real time. A refresh every 30 s is the safety
  // net, every 5 s while the real-time connection is down (it catches up once it's back).
  const [live, setLive] = useState<LivePosition[]>([]);
  const [realtime, setRealtime] = useState(false);
  const [following, setFollowing] = useState<string | null>(null);
  const followingRef = useRef(following);
  followingRef.current = following;
  const loadLive = useCallback(() => void mapService.listLive().then(setLive).catch(() => undefined), []);
  useEffect(() => {
    loadLive();
    return mapService.subscribeLive((e) => {
      if (e.type === 'remove') return setLive((ls) => ls.filter((p) => p.profileId !== e.profileId));
      const pos = e.position;
      setLive((ls) => {
        const prev = ls.find((p) => p.profileId === pos.profileId);
        if (!prev && !pos.name) {
          loadLive(); // someone new: fetch their name
          return ls;
        }
        const next = { ...prev, ...pos, name: pos.name ?? prev?.name ?? 'Team member' } as LivePosition;
        return prev ? ls.map((p) => (p.profileId === pos.profileId ? next : p)) : [...ls, next];
      });
      if (followingRef.current === pos.profileId) setFocus({ lat: pos.lat, lng: pos.lng, key: Date.now() });
    }, setRealtime);
  }, [loadLive]);
  useEffect(() => {
    if (realtime) loadLive();
  }, [realtime, loadLive]);
  useLiveRefresh(true, loadLive, realtime ? 30_000 : 5_000);
  // Re-render every 15 s so "live, 20 s ago" and live/paused stay accurate between updates.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (following && !live.some((p) => p.profileId === following)) setFollowing(null);
  }, [live, following]);

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
  const shownLive = useMemo(() => (layers.has('team') ? live.filter((p) => !needle || p.name.toLowerCase().includes(needle)) : []), [live, layers, needle]);
  // Statistics layer: sites of past activities (scheduled ones aren't done yet, so they stay off the map).
  // Funding and donors only for administrators and coordinators (the database already withholds them; this covers sample mode).
  const canFunding = can('funding.read');
  const activities = useMemo(
    () => (activitiesQ.status === 'success' ? activitiesQ.data.filter((a) => a.status !== 'scheduled').map((a) => (canFunding ? a : withoutFunding(a))) : []),
    [activitiesQ.status, activitiesQ.data, canFunding],
  );
  const actYears = useMemo(() => [...new Set(activities.map((a) => a.year))].sort((a, b) => b - a), [activities]);
  const sites = useMemo(() => groupSites(activities.filter((a) => actYear === 'all' || a.year === actYear)), [activities, actYear]);
  const shownSites = useMemo(
    () =>
      layers.has('activities')
        ? needle
          ? groupSites(sites.flatMap((s) => s.activities).filter((a) => [a.site, a.activity, a.response, a.donors, a.partner].some((v) => v?.toLowerCase().includes(needle))))
          : sites
        : [],
    [sites, layers, needle],
  );

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
    const p =
      s.type === 'place' ? places.find((x) => x.id === s.id) : s.type === 'live' ? live.find((x) => x.profileId === s.id) : s.type === 'site' ? sites.find((x) => x.key === s.id) : checkIns.find((x) => x.id === s.id);
    if (p) setFocus({ lat: p.lat, lng: p.lng, zoom: s.type === 'site' ? 12 : 15, key: Date.now() });
  }, [places, checkIns, live, sites]);

  // Opened from Statistics ("Show on the Live Map"): that site, layer on, all years.
  const siteParam = params.get('site');
  useEffect(() => {
    if (!siteParam || activitiesQ.status !== 'success') return;
    const s = groupSites(activities).find((x) => x.key === siteParam);
    setParams({}, { replace: true });
    if (!s) return;
    setActYear('all');
    setLayers((l) => new Set([...l, 'activities']));
    setSelected({ type: 'site', id: s.key });
    setFocus({ lat: s.lat, lng: s.lng, zoom: 12, key: Date.now() });
  }, [siteParam, activitiesQ.status, activities, setParams]);

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
  const selectedLive = selected?.type === 'live' ? live.find((p) => p.profileId === selected.id) ?? null : null;
  const selectedSite = selected?.type === 'site' ? (sites.find((s) => s.key === selected.id) ?? groupSites(activities).find((s) => s.key === selected.id) ?? null) : null;

  if (!can('map.read'))
    return (
      <p className="card text-sm text-ink-soft" role="alert" data-quiet>
        Your role doesn’t include the Live Map. Ask an administrator if you need it.
      </p>
    );

  const panelProps: PanelProps = {
    loading: placesQ.status === 'loading',
    search,
    setSearch,
    layers,
    toggleLayer,
    places,
    shownPlaces,
    checkIns,
    shownCheckIns,
    live,
    shownLive,
    sites,
    shownSites,
    actYear,
    setActYear,
    actYears,
    activitiesLoading: activitiesQ.status === 'loading',
    snapshot,
    canManage,
    onAdd: () => setPanel({ type: 'form', draft: blankDraft() }),
    onSelect: (s) => select(s, true),
  };

  return (
    <div className="flex flex-col gap-4">
      {/* "isolate": the map's own layers stay under the top bar's menus. */}
      {/* Not isolated while the map fills the window, so it can sit above the sidebar and top bar. */}
      <section className={`card relative overflow-hidden p-0 lg:grid lg:grid-cols-[24rem_minmax(0,1fr)] ${full === 'window' ? '' : 'isolate'}`}>
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

        {/* Phones: the map fills the rest of the screen below where it starts (which moves with the sharing banner). */}
        <div
          ref={mapBox}
          style={phoneHeight && full === 'off' ? { height: phoneHeight } : undefined}
          className={
            full === 'window'
              ? 'fixed inset-0 z-[1150] h-dvh bg-page'
              : `relative h-[calc(100dvh-15.5rem)] min-h-[20rem] lg:h-[calc(100dvh-13rem)] lg:min-h-[34rem] ${full === 'screen' ? 'bg-page' : ''}`
          }
        >
          {placesQ.status === 'error' ? (
            <div className="grid h-full place-items-center p-6">
              <LoadError message={online ? 'The map could not be loaded.' : 'You’re offline and this device has no saved copy of the map yet.'} onRetry={placesQ.reload} />
            </div>
          ) : (
            <MapCanvas
              places={shownPlaces}
              sites={shownSites}
              checkIns={shownCheckIns}
              live={shownLive}
              selected={selected}
              onSelect={(s) => select(s)}
              focus={focus}
              fit={fit}
              me={me}
              picking={Boolean(picking)}
              onCenter={setCenter}
              weather={weather.mode ? { mode: weather.mode, grid: weather.grid, hour: weather.hour, radar: weather.radar, radarIndex: weather.radarIndex } : null}
              onView={weather.setView}
              onMapClick={weather.mode ? setSpot : undefined}
              spot={spot}
            />
          )}

          {/* Top-right: fit and my location */}
          {!picking && (
            <div className={`absolute right-3 z-[600] flex flex-col gap-2 ${full === 'off' ? 'top-3' : 'top-[max(0.75rem,env(safe-area-inset-top))]'}`}>
              <MapButton label={full === 'off' ? 'Full screen' : 'Exit full screen'} active={full !== 'off'} onClick={() => void toggleFull()}>
                {full === 'off' ? <Fullscreen className="h-[1.125rem] w-[1.125rem]" aria-hidden /> : <Minimize2 className="h-[1.125rem] w-[1.125rem]" aria-hidden />}
              </MapButton>
              <MapButton label="Show everything" onClick={() => setFit({ points: [...shownPlaces, ...shownCheckIns, ...shownLive, ...shownSites], key: Date.now() })}>
                <Maximize2 className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              </MapButton>
              <MapButton label="Show my location" onClick={() => void locateMe()}>
                {locating ? <Loader2 className="h-[1.125rem] w-[1.125rem] animate-spin" aria-hidden /> : <LocateFixed className="h-[1.125rem] w-[1.125rem]" aria-hidden />}
              </MapButton>
              <MapButton label={weather.mode ? 'Hide weather' : 'Show weather'} active={Boolean(weather.mode)} onClick={() => weather.setMode(weather.mode ? null : 'wind')}>
                <CloudSun className="h-[1.125rem] w-[1.125rem]" aria-hidden />
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

          {/* Following someone sharing live: the map keeps them in the middle */}
          {following && !picking && (
            <div className="absolute left-1/2 top-3 z-[600] flex -translate-x-1/2 items-center gap-2 rounded-full border border-status-in/50 bg-surface-raised/95 py-1.5 pl-3 pr-1.5 text-xs shadow-xl backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-status-in" aria-hidden />
              <span className="max-w-[10rem] truncate font-semibold">Following {live.find((p) => p.profileId === following)?.name.split(' ')[0] ?? ''}</span>
              <button type="button" className="rounded-full border border-line px-2.5 py-1 font-semibold hover:bg-surface" onClick={() => setFollowing(null)}>
                Stop
              </button>
            </div>
          )}

          {/* Weather: view, timeline and colour key. Above the List / Share buttons, so nothing overlaps at any width. */}
          {weather.mode && !picking && (
            <div className="absolute inset-x-3 bottom-[5.25rem] z-[600] lg:bottom-[5.75rem] lg:right-auto lg:w-[min(26rem,calc(100%-1.5rem))]">
              <WeatherBar weather={weather} onClose={() => weather.setMode(null)} />
            </div>
          )}

          {/* Phones: list and sharing at the bottom, within thumb reach */}
          {!picking && (
            <div className="absolute inset-x-3 bottom-6 z-[600] flex items-center justify-between gap-2 lg:hidden">
              <button type="button" className="flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface-raised/95 px-4 text-sm font-semibold shadow-xl backdrop-blur-md" onClick={() => setPanel({ type: 'list' })}>
                <List className="h-4 w-4 text-uplift" aria-hidden /> List
                <span className="text-xs font-normal text-muted">{formatNumber(shownPlaces.length + shownCheckIns.length + shownLive.length + shownSites.length)}</span>
              </button>
              {canCheckIn && <ShareButton live={sharing.status !== 'off'} onClick={() => setPanel({ type: 'share' })} disabled={!online} />}
            </div>
          )}
          {/* Desktop: sharing in the corner */}
          {!picking && canCheckIn && (
            <div className="absolute bottom-8 right-3 z-[600] hidden lg:block">
              <ShareButton live={sharing.status !== 'off'} onClick={() => setPanel({ type: 'share' })} disabled={!online} />
            </div>
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
      {selectedSite && !panel && (
        <SiteDetails
          site={selectedSite}
          onClose={() => setSelected(null)}
          onCenter={() => {
            setFocus({ lat: selectedSite.lat, lng: selectedSite.lng, zoom: 13, key: Date.now() });
            setSelected(null);
          }}
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
      {selectedLive && !panel && (
        <LiveDetails
          person={selectedLive}
          places={places}
          onClose={() => setSelected(null)}
          onFollow={() => {
            setFollowing(selectedLive.profileId);
            setFocus({ lat: selectedLive.lat, lng: selectedLive.lng, zoom: 16, key: Date.now() });
            setSelected(null);
          }}
          onStopMine={async () => {
            await sharing.stop();
            setSelected(null);
          }}
        />
      )}

      {spot && !selected && !panel && (
        <SpotSheet
          lat={spot.lat}
          lng={spot.lng}
          near={places.map((p) => ({ p, d: distanceM(p, spot) })).filter((x) => x.d < 5000).sort((a, b) => a.d - b.d)[0]?.p.name}
          onClose={() => setSpot(null)}
        />
      )}

      {panel?.type === 'share' && (
        <Sheet open onClose={() => setPanel(null)} title="Share your location" subtitle="Let the team see where you are.">
          <div className="flex flex-col gap-5">
            <LiveShareCard />
            <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            <section className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-white/[0.02] p-4">
              <div>
                <h3 className="text-sm font-semibold">Check in once</h3>
                <p className="text-xs text-muted">One pin where you are now, with a note. Shown for 24 hours.</p>
              </div>
              <button type="button" className="btn-ghost min-h-11" onClick={() => setPanel({ type: 'checkin' })}>
                <MapPin className="h-4 w-4 text-uplift" aria-hidden /> Check in here
              </button>
            </section>
          </div>
        </Sheet>
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

/** Opens the sharing choices; shows "Live" while your location is being shared. */
function ShareButton({ live, onClick, disabled }: { live: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-bold shadow-xl shadow-black/50 transition active:scale-95 disabled:opacity-60 ${
        live ? 'border border-status-in/60 bg-surface-raised/95 text-status-in backdrop-blur-md' : 'bg-uplift text-page'
      }`}
    >
      {live ? (
        <>
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-in opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-in" />
          </span>
          Sharing live
        </>
      ) : (
        <>
          <UserRound className="h-4 w-4" aria-hidden /> Share location
        </>
      )}
    </button>
  );
}

function MapButton({ label, onClick, active = false, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      className={`grid h-11 w-11 place-items-center rounded-xl border bg-surface-raised/95 shadow-xl shadow-black/50 backdrop-blur-md transition hover:bg-surface-raised ${active ? 'border-uplift/70 text-uplift' : 'border-line text-ink'}`}
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
  live: LivePosition[];
  shownLive: LivePosition[];
  /** Statistics layer: sites in the chosen year, and those matching the search. */
  sites: ActivitySite[];
  shownSites: ActivitySite[];
  actYear: number | 'all';
  setActYear: (y: number | 'all') => void;
  actYears: number[];
  activitiesLoading: boolean;
  snapshot: InventorySnapshot | null;
  canManage: boolean;
  /** Places are still loading: placeholder rows instead of "no places". */
  loading: boolean;
  onAdd: () => void;
  onSelect: (s: Selected) => void;
}

/** Search, layers (with counts) and the lists of team check-ins and places. */
function PlacesPanel({ search, setSearch, layers, toggleLayer, places, shownPlaces, checkIns, shownCheckIns, live, shownLive, sites, shownSites, actYear, setActYear, actYears, activitiesLoading, snapshot, canManage, loading, onAdd, onSelect }: PanelProps) {
  const counts = (l: Layer) => (l === 'team' ? checkIns.length + live.length : l === 'activities' ? sites.length : places.filter((p) => p.kind === l).length);
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
          {[...PLACE_KINDS.map((k) => ({ key: k.key as Layer, label: k.plural, color: k.color })), { key: 'team' as Layer, label: 'Team: live and check-ins', color: '#7a1f1f' }, { key: 'activities' as Layer, label: 'Past activities (Statistics)', color: programMeta('emergency').color }].map((l) => (
            <label key={l.key} className="tap flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm hover:bg-white/[0.04]">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{l.label}</span>
              <span className="text-xs tabular-nums text-muted">{counts(l.key)}</span>
              <Switch checked={layers.has(l.key)} onChange={() => toggleLayer(l.key)} />
            </label>
          ))}
        </div>
      </fieldset>

      {layers.has('activities') && actYears.length > 0 && (
        <section aria-labelledby="map-acts" className="flex flex-col gap-2">
          <h3 id="map-acts" className="text-xs font-semibold uppercase tracking-wider text-muted">
            Past activities <span className="font-normal normal-case tracking-normal">{shownSites.length} sites</span>
          </h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Year">
            {(['all', ...actYears] as const).map((y) => (
              <button key={y} type="button" className="chip min-h-7 px-2.5" aria-pressed={actYear === y} onClick={() => setActYear(y)}>
                {y === 'all' ? 'All years' : y}
              </button>
            ))}
          </div>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-muted">
            {PROGRAMS.filter((p) => sites.some((s) => s.program === p.key)).map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
                {p.short}
              </span>
            ))}
            <span>· bigger circle, more people served</span>
          </p>
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {[...shownSites]
              .sort((a, b) => (b.activities[0].startDate ?? `${b.activities[0].year}`).localeCompare(a.activities[0].startDate ?? `${a.activities[0].year}`))
              .map((s) => (
                <li key={s.key}>
                  <button type="button" className="tap flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.04]" onClick={() => onSelect({ type: 'site', id: s.key })}>
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold text-page" style={{ background: programMeta(s.program).color }} aria-hidden>
                      {s.activities.length}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {s.activities[0].response ?? s.activities[0].activity} · {s.activities[0].year}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
      {layers.has('activities') && activitiesLoading && <Skeleton className="h-16" />}

      {layers.has('team') && shownLive.length > 0 && (
        <section aria-labelledby="map-live">
          <h3 id="map-live" className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-status-in" aria-hidden /> Live now <span className="font-normal normal-case tracking-normal">{shownLive.length}</span>
          </h3>
          <ul className="flex flex-col">
            {[...shownLive].sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name)).map((p) => {
              const fresh = isFresh(p);
              return (
                <li key={p.profileId}>
                  <button type="button" className="tap flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.04]" onClick={() => onSelect({ type: 'live', id: p.profileId })}>
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[0.6875rem] font-bold ${fresh ? 'border-status-in' : 'border-muted'} ${p.mine ? 'bg-uplift text-page' : 'bg-surface-raised text-ink'}`}
                      aria-hidden
                    >
                      {initialsOf(p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.mine ? 'You' : p.name}</span>
                      <span className={`block truncate text-xs ${fresh ? 'text-status-in' : 'text-muted'}`}>
                        {fresh ? `Live · ${timeAgo(p.updatedAt)}` : `Paused · last seen ${timeAgo(p.updatedAt)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading places">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-3/5" />
                  <Skeleton className="h-2.5 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
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
