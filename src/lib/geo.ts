/** Small geography helpers for the Live Map. */

export interface LatLng {
  lat: number;
  lng: number;
}

/** The Philippines, for the first view before any place is pinned. */
export const PH_CENTER: LatLng = { lat: 12.3, lng: 122.6 };
export const PH_ZOOM = 6;

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const formatDistance = (m: number) => (m < 950 ? `${Math.round(m / 10) * 10} m` : m < 9_500 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 1000)} km`);

/** "just now", "25 min ago", "3 h ago", "yesterday". */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 2) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return h < 48 ? 'yesterday' : `${Math.round(h / 24)} days ago`;
}

/** Turn-by-turn directions in Google Maps (opens the app on phones). */
export const directionsUrl = (p: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** "11.24440, 125.00390" */
export const formatLatLng = (p: LatLng) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

export type GeoResult = { ok: true; lat: number; lng: number; accuracyM: number } | { ok: false; reason: string };

/**
 * The phone's position, as accurate as it gets within a few seconds (only when someone asks;
 * never watched in the background). Phones often give a rough cell-tower or Wi-Fi position first,
 * off by hundreds of metres, then a GPS one: so this listens for a moment, keeps the most accurate
 * fresh reading, and answers as soon as one is good enough (`goodM`) or when `waitMs` runs out.
 */
export function currentPosition({ goodM = 30, waitMs = 10_000 }: { goodM?: number; waitMs?: number } = {}): Promise<GeoResult> {
  if (!('geolocation' in navigator)) return Promise.resolve({ ok: false, reason: 'This browser can’t share its location.' });
  return new Promise((resolve) => {
    let best: GeolocationPosition | null = null;
    let done = false;
    const finish = (r: GeoResult) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watch);
      clearTimeout(timer);
      resolve(r);
    };
    const answer = () =>
      best
        ? finish({ ok: true, lat: best.coords.latitude, lng: best.coords.longitude, accuracyM: Math.round(best.coords.accuracy) })
        : finish({ ok: false, reason: 'Your location took too long. Step outside or near a window and try again.' });
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        if (!best || p.coords.accuracy <= best.coords.accuracy) best = p;
        if (p.coords.accuracy <= goodM) answer();
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED)
          finish({ ok: false, reason: 'Location is blocked for this site. Allow it in your browser’s site settings, then try again.' });
        else if (e.code !== e.TIMEOUT && !best) finish({ ok: false, reason: 'Your location isn’t available right now. Check that location (GPS) is on.' });
      },
      // Fresh readings only: a cached one can be from somewhere else.
      { enableHighAccuracy: true, maximumAge: 0, timeout: waitMs + 10_000 },
    );
    // Out of time: the best so far; with nothing yet, give GPS a little longer before giving up.
    const timer = setTimeout(() => (best ? answer() : setTimeout(answer, 10_000)), waitMs);
  });
}

/** Rough position (cell tower / Wi-Fi), not GPS: worse than this is too far off to show. */
export const ROUGH_M = 500;
/** A GPS-quality reading. */
export const GOOD_M = 50;
