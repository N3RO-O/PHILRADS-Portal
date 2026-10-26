import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, Crosshair, HandHeart, House, LifeBuoy, Truck, Warehouse, type LucideIcon } from 'lucide-react';
import { PH_CENTER, PH_ZOOM, type LatLng } from '../../lib/geo';
import { initialsOf } from '../../lib/format';
import { kindMeta, type CheckIn, type MapPlace, type PlaceKind } from '../../services/map/types';

const KIND_ICON: Record<PlaceKind, LucideIcon> = {
  warehouse: Warehouse,
  hub: Truck,
  response_site: LifeBuoy,
  distribution_point: HandHeart,
  evacuation_center: House,
  office: Building2,
};

/** An icon as SVG markup for Leaflet's HTML pins (rendered once with the React already loaded; cached). */
function toMarkup(el: ReactElement): string {
  const div = document.createElement('div');
  const root = createRoot(div);
  flushSync(() => root.render(el));
  const html = div.innerHTML;
  root.unmount();
  return html;
}

/** Every kind's glyph, drawn once when the map loads (never during a React render). */
const GLYPHS = Object.fromEntries(
  (Object.keys(KIND_ICON) as PlaceKind[]).map((kind) => {
    const Icon = KIND_ICON[kind];
    return [kind, { small: toMarkup(<Icon width={16} height={16} color="#1c1d21" strokeWidth={2.4} />), big: toMarkup(<Icon width={20} height={20} color="#1c1d21" strokeWidth={2.4} />) }];
  }),
) as Record<PlaceKind, { small: string; big: string }>;

const iconCache = new Map<string, L.DivIcon>();
/** Teardrop pin in the kind's colour with its icon; bigger with a ring when selected. */
function placeIcon(kind: PlaceKind, selected: boolean): L.DivIcon {
  const key = `${kind}:${selected}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const color = kindMeta(kind).color;
  const size = selected ? 42 : 34;
  const glyph = selected ? GLYPHS[kind].big : GLYPHS[kind].small;
  const icon = L.divIcon({
    className: 'map-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    tooltipAnchor: [0, -size],
    html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid ${selected ? '#fff' : 'rgba(28,29,33,.9)'};box-shadow:0 6px 16px -4px rgba(0,0,0,.7)${selected ? `,0 0 0 6px ${color}55` : ''}"><span style="transform:rotate(45deg);display:grid">${glyph}</span></span>`,
  });
  iconCache.set(key, icon);
  return icon;
}

/** A team member's check-in: their initials; a pulse while it's under an hour old. */
function personIcon(c: CheckIn, selected: boolean): L.DivIcon {
  const fresh = Date.now() - Date.parse(c.createdAt) < 3600_000;
  const size = selected ? 38 : 32;
  return L.divIcon({
    className: 'map-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
    html: `<span style="position:relative;display:grid;place-items:center;width:${size}px;height:${size}px">${
      fresh ? `<span style="position:absolute;inset:0;border-radius:9999px;background:#ec952a;animation:map-pulse 2s ease-out infinite"></span>` : ''
    }<span style="position:relative;display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;background:${c.mine ? '#ec952a' : '#7a1f1f'};color:${c.mine ? '#1c1d21' : '#fff'};font:700 ${
      selected ? 13 : 11
    }px/1 Montserrat,system-ui,sans-serif;border:2px solid ${selected ? '#fff' : '#1c1d21'};box-shadow:0 6px 16px -4px rgba(0,0,0,.7)">${initialsOf(c.name)}</span></span>`,
  });
}

const meIcon = L.divIcon({
  className: 'map-pin',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html: '<span style="display:block;width:20px;height:20px;border-radius:9999px;background:#60a5fa;border:3px solid #fff;box-shadow:0 0 0 6px rgba(96,165,250,.3)"></span>',
});

export interface MapFocus {
  lat: number;
  lng: number;
  zoom?: number;
  /** Changes every time, so focusing the same spot twice still flies there. */
  key: number;
}

interface Props {
  places: MapPlace[];
  checkIns: CheckIn[];
  selected: { type: 'place' | 'checkin'; id: string } | null;
  onSelect: (s: { type: 'place' | 'checkin'; id: string } | null) => void;
  focus: MapFocus | null;
  /** Fit these points in view whenever `fitKey` changes. */
  fit: { points: LatLng[]; key: number } | null;
  me: (LatLng & { accuracyM: number }) | null;
  /** Picking a spot: a crosshair stays in the middle; the map reports its centre as it moves. */
  picking: boolean;
  onCenter?: (c: LatLng) => void;
}

function Controller({ focus, fit, picking, onCenter, onBackground }: Pick<Props, 'focus' | 'fit' | 'picking' | 'onCenter'> & { onBackground: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom ?? Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, [focus, map]);
  useEffect(() => {
    if (!fit || fit.points.length === 0) return;
    if (fit.points.length === 1) map.flyTo([fit.points[0].lat, fit.points[0].lng], 12, { duration: 0.8 });
    // Room around the edges for the zoom buttons (top-left), map buttons (top-right) and the
    // List / Check in buttons (bottom), so no pin ends up hidden under one.
    else
      map.flyToBounds(L.latLngBounds(fit.points.map((p) => [p.lat, p.lng] as [number, number])), {
        paddingTopLeft: [72, 72],
        paddingBottomRight: [72, 104],
        maxZoom: 13,
        duration: 0.8,
      });
  }, [fit, map]);
  // The map's size changes with the sidebar and on rotation; keep the tiles filling it.
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  useEffect(() => {
    if (picking) onCenter?.(map.getCenter());
  }, [picking, map, onCenter]);
  useMapEvents({
    move: () => picking && onCenter?.(map.getCenter()),
    click: () => !picking && onBackground(),
  });
  return null;
}

export function MapCanvas({ places, checkIns, selected, onSelect, focus, fit, me, picking, onCenter }: Props) {
  const selectedCheck = selected?.type === 'checkin' ? checkIns.find((c) => c.id === selected.id) : null;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const handlers = useMemo(
    () => ({
      place: (id: string) => ({ click: () => onSelectRef.current({ type: 'place', id }), keypress: (e: L.LeafletKeyboardEvent) => e.originalEvent.key === 'Enter' && onSelectRef.current({ type: 'place', id }) }),
      person: (id: string) => ({ click: () => onSelectRef.current({ type: 'checkin', id }) }),
    }),
    [],
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer center={[PH_CENTER.lat, PH_CENTER.lng]} zoom={PH_ZOOM} minZoom={4} maxZoom={19} zoomControl worldCopyJump className="h-full w-full" attributionControl>
        {/* OpenStreetMap (no API key; detailed down to barangay roads), darkened in CSS (.map-tiles-dark) to match the portal. */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          className="map-tiles-dark"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Controller focus={focus} fit={fit} picking={picking} onCenter={onCenter} onBackground={() => onSelectRef.current(null)} />
        {!picking &&
          places.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={placeIcon(p.kind, selected?.type === 'place' && selected.id === p.id)}
              alt={p.name}
              keyboard
              riseOnHover
              zIndexOffset={selected?.id === p.id ? 1000 : 0}
              eventHandlers={handlers.place(p.id)}
            >
              <Tooltip direction="auto" opacity={1} className="!rounded-lg !border-line !bg-surface-raised !px-2 !py-1 !text-xs !font-semibold !text-ink !shadow-xl">
                {p.name}
              </Tooltip>
            </Marker>
          ))}
        {!picking &&
          checkIns.map((c) => (
            <Marker key={c.id} position={[c.lat, c.lng]} icon={personIcon(c, selected?.id === c.id)} alt={c.name} zIndexOffset={2000} eventHandlers={handlers.person(c.id)}>
              <Tooltip direction="auto" opacity={1} className="!rounded-lg !border-line !bg-surface-raised !px-2 !py-1 !text-xs !font-semibold !text-ink !shadow-xl">
                {c.name}
              </Tooltip>
            </Marker>
          ))}
        {selectedCheck?.accuracyM && (
          <Circle center={[selectedCheck.lat, selectedCheck.lng]} radius={selectedCheck.accuracyM} pathOptions={{ color: '#ec952a', weight: 1, fillOpacity: 0.08 }} />
        )}
        {me && (
          <>
            <Circle center={[me.lat, me.lng]} radius={me.accuracyM} pathOptions={{ color: '#60a5fa', weight: 1, fillOpacity: 0.08 }} />
            <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} />
          </>
        )}
      </MapContainer>
      {picking && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[500] grid place-items-center">
          <div className="relative grid place-items-center">
            <span className="absolute h-14 w-14 rounded-full border-2 border-uplift/70" />
            <Crosshair className="h-7 w-7 text-uplift drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]" strokeWidth={2.5} />
          </div>
        </div>
      )}
    </div>
  );
}
