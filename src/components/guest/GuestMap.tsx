import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { programMeta } from '../../services/activities/types';
import type { GuestPlace, GuestSite } from '../../services/guest/guestService';
import type { Hazard } from '../../services/guest/hazards';
import { kindMeta } from '../../services/map/types';
import { PH_CENTER, PH_ZOOM } from '../../lib/geo';

export type GuestPick = { type: 'site' | 'place' | 'hazard'; id: string } | null;

const LEVEL_COLOR = { red: '#ef4444', orange: '#f59e0b', green: '#4ade80' } as const;

function hazardIcon(h: Hazard, on: boolean) {
  const c = LEVEL_COLOR[h.level];
  const size = on ? 30 : 24;
  // A warning triangle, so a hazard never reads as one of the round activity dots.
  return L.divIcon({
    className: 'map-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size * 0.62],
    html: `<span class="gm-hazard${h.current ? ' gm-live' : ''}" style="--c:${c};width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M12 2.8 22.4 20.6H1.6Z" fill="${c}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v5.2" stroke="#1c1d21" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.25" fill="#1c1d21"/></svg></span>`,
  });
}

function placeIcon(p: GuestPlace, on: boolean) {
  const size = on ? 18 : 13;
  return L.divIcon({
    className: 'map-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span class="gm-place" style="--c:${kindMeta(p.kind).color};width:${size}px;height:${size}px"></span>`,
  });
}

function Fly({ to }: { to: { lat: number; lng: number; key: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.flyTo([to.lat, to.lng], Math.max(map.getZoom(), 8), { duration: 0.8 });
  }, [to, map]);
  // The map's box changes size with the window: keep the tiles filling it.
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/**
 * The guest map: where PHILRADS has worked (a dot per activity, in its program's colour), its
 * public places, and hazards affecting the Philippines now. Pressing a pin reports it; the page
 * shows the details under the map, where they are easy to read on a phone.
 */
export default function GuestMap({
  sites,
  places,
  hazards,
  pick,
  onPick,
  focus,
  me = null,
}: {
  sites: GuestSite[];
  places: GuestPlace[];
  hazards: Hazard[];
  pick: GuestPick;
  onPick: (p: GuestPick) => void;
  focus: { lat: number; lng: number; key: number } | null;
  /** The guest's own position, when they asked for places near them. */
  me?: { lat: number; lng: number } | null;
}) {
  // Older work under newer work, so this year's dots are on top.
  const ordered = useMemo(() => [...sites].sort((a, b) => a.year - b.year), [sites]);
  const handlers = useMemo(
    () => ({
      site: (id: string) => ({ click: () => onPick({ type: 'site', id }) }),
      place: (id: string) => ({ click: () => onPick({ type: 'place', id }), keypress: (e: L.LeafletKeyboardEvent) => e.originalEvent.key === 'Enter' && onPick({ type: 'place', id }) }),
      hazard: (id: string) => ({ click: () => onPick({ type: 'hazard', id }), keypress: (e: L.LeafletKeyboardEvent) => e.originalEvent.key === 'Enter' && onPick({ type: 'hazard', id }) }),
    }),
    [onPick],
  );

  return (
    <MapContainer
      center={[PH_CENTER.lat, PH_CENTER.lng]}
      zoom={PH_ZOOM - 0.5}
      zoomSnap={0.5}
      minZoom={4}
      maxZoom={15}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        className="map-tiles-dark"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Fly to={focus} />
      {ordered.map((s) => {
        const on = pick?.type === 'site' && pick.id === s.id;
        const served = s.individuals ?? (s.households ? s.households * 4 : 0);
        const r = Math.min(13, 5 + Math.sqrt(served) / 6);
        return (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={on ? r + 3 : r}
            pathOptions={{ color: on ? '#ffffff' : programMeta(s.program).color, weight: on ? 3 : 1.5, fillColor: programMeta(s.program).color, fillOpacity: 0.55 }}
            eventHandlers={handlers.site(s.id)}
          />
        );
      })}
      {places.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={placeIcon(p, pick?.type === 'place' && pick.id === p.id)} eventHandlers={handlers.place(p.id)} title={p.name} keyboard />
      ))}
      {hazards.map((h) => (
        <Marker
          key={h.id}
          position={[h.lat, h.lng]}
          icon={hazardIcon(h, pick?.type === 'hazard' && pick.id === h.id)}
          eventHandlers={handlers.hazard(h.id)}
          title={h.title}
          zIndexOffset={1000}
          keyboard
        />
      ))}
      {me && (
        <>
          <CircleMarker center={[me.lat, me.lng]} radius={16} interactive={false} pathOptions={{ stroke: false, fillColor: '#3b82f6', fillOpacity: 0.18 }} />
          <CircleMarker center={[me.lat, me.lng]} radius={7} interactive={false} pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: '#3b82f6', fillOpacity: 1 }} />
        </>
      )}
    </MapContainer>
  );
}
