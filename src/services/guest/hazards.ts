/**
 * Disaster News for guests: hazards affecting the Philippines from two public sources, no key needed.
 *
 * - GDACS (UN / European Commission): tropical cyclones, floods, volcanoes and droughts, with a
 *   green / orange / red alert level for the expected humanitarian impact.
 * - USGS: earthquakes of magnitude 4.5 and up in and around the Philippines.
 *
 * Shared by /api/weather?hazards=ph (cached at Vercel's edge for everyone) and the page itself
 * (guestService.loadHazards), which asks the sources directly when that isn't available.
 * No browser-only code here: the server function imports it too.
 */

export type HazardKind = 'typhoon' | 'flood' | 'earthquake' | 'volcano' | 'drought' | 'wildfire';
export type HazardLevel = 'red' | 'orange' | 'green';

export interface Hazard {
  id: string;
  kind: HazardKind;
  title: string;
  /** One plain line: wind speed, magnitude, where. */
  detail: string;
  level: HazardLevel;
  /** Still going on (GDACS), or in the last two days (earthquakes). */
  current: boolean;
  from: string;
  to: string | null;
  lat: number;
  lng: number;
  source: 'GDACS' | 'USGS';
  url: string;
}

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

export const gdacsUrl = (now = Date.now()) =>
  `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?fromdate=${isoDay(now - 90 * DAY)}&todate=${isoDay(now + DAY)}&alertlevel=green;orange;red&eventlist=TC;FL;VO;DR;WF&country=Philippines`;

export const usgsUrl = (now = Date.now()) =>
  `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=4&maxlatitude=21.5&minlongitude=116&maxlongitude=127.5&minmagnitude=4.5&orderby=time&limit=40&starttime=${isoDay(now - 30 * DAY)}`;

const KINDS: Record<string, HazardKind> = { TC: 'typhoon', FL: 'flood', VO: 'volcano', DR: 'drought', WF: 'wildfire', EQ: 'earthquake' };
const levelOf = (v: unknown): HazardLevel => {
  const s = String(v ?? '').toLowerCase();
  return s === 'red' ? 'red' : s === 'orange' ? 'orange' : 'green';
};
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v));
/** GDACS dates have no zone; they are UTC. */
const utc = (v: unknown) => (typeof v === 'string' && v ? (/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`) : null);

function gdacsDetail(kind: HazardKind, p: Record<string, unknown>) {
  const sev = (p.severitydata ?? {}) as { severity?: number; severitytext?: string };
  if (kind === 'typhoon' && typeof sev.severity === 'number' && sev.severity > 0) return `Winds up to ${Math.round(sev.severity)} km/h`;
  if (kind === 'volcano') return 'Volcanic activity reported';
  if (kind === 'flood') return 'Flooding detected by satellite and river models';
  if (kind === 'drought') return 'Dry spell across the region';
  return String(sev.severitytext ?? '').trim() || 'Reported by GDACS';
}

function gdacsTitle(kind: HazardKind, p: Record<string, unknown>) {
  const name = String(p.eventname ?? '').trim();
  if (kind === 'typhoon' && name) return `Tropical cyclone ${name.replace(/-\d+$/, '').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}`;
  if (kind === 'volcano' && name) return `${name} Volcano`;
  if (kind === 'drought') return 'Drought in South-East Asia';
  return String(p.name ?? 'Hazard in the Philippines').replace(/\s+/g, ' ').trim();
}

export function parseGdacs(json: unknown): Hazard[] {
  const features = (json as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const out: Hazard[] = [];
  for (const f of features as { geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> }[]) {
    const p = f.properties ?? {};
    const kind = KINDS[String(p.eventtype)];
    const [lng, lat] = (f.geometry?.coordinates ?? []).map(num);
    const from = utc(p.fromdate);
    if (!kind || kind === 'earthquake' || !Number.isFinite(lat) || !Number.isFinite(lng) || !from) continue;
    const report = (p.url as { report?: string } | undefined)?.report;
    out.push({
      id: `gdacs-${p.eventtype}-${p.eventid}`,
      kind,
      title: gdacsTitle(kind, p),
      detail: gdacsDetail(kind, p),
      level: levelOf(p.alertlevel),
      current: String(p.iscurrent) === 'true',
      from,
      to: utc(p.todate),
      lat,
      lng,
      source: 'GDACS',
      url: typeof report === 'string' && report.startsWith('https://') ? report : 'https://www.gdacs.org/',
    });
  }
  return out;
}

export function parseUsgs(json: unknown, now = Date.now()): Hazard[] {
  const features = (json as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const out: Hazard[] = [];
  for (const f of features as { id?: string; geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> }[]) {
    const p = f.properties ?? {};
    const [lng, lat, depth] = (f.geometry?.coordinates ?? []).map(num);
    const mag = num(p.mag);
    const time = num(p.time);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(mag) || !Number.isFinite(time)) continue;
    const alert = String(p.alert ?? '');
    const level: HazardLevel = alert === 'red' ? 'red' : alert === 'orange' || alert === 'yellow' || mag >= 6.5 ? 'orange' : 'green';
    const place = String(p.place ?? '').trim();
    const url = String(p.url ?? '');
    out.push({
      id: `usgs-${f.id ?? time}`,
      kind: 'earthquake',
      title: `Magnitude ${mag.toFixed(1)} earthquake`,
      detail: [place, Number.isFinite(depth) ? `${Math.round(depth)} km deep` : '', num(p.tsunami) === 1 ? 'Tsunami information issued' : ''].filter(Boolean).join(', '),
      level,
      current: now - time < 2 * DAY,
      from: new Date(time).toISOString(),
      to: null,
      lat,
      lng,
      source: 'USGS',
      url: url.startsWith('https://') ? url : 'https://earthquake.usgs.gov/',
    });
  }
  return out;
}

const RANK: Record<HazardLevel, number> = { red: 0, orange: 1, green: 2 };

/** Ongoing first, then by alert level, then newest. Small earthquakes beyond the latest 12 are dropped. */
export function mergeHazards(lists: Hazard[][]): Hazard[] {
  const all = lists.flat();
  let quakes = 0;
  return all
    .sort((a, b) => Number(b.current) - Number(a.current) || RANK[a.level] - RANK[b.level] || Date.parse(b.from) - Date.parse(a.from))
    .filter((h) => h.kind !== 'earthquake' || h.level !== 'green' || ++quakes <= 12);
}

export interface HazardFeed {
  hazards: Hazard[];
  /** Sources that didn't answer this time. */
  missing: ('GDACS' | 'USGS')[];
  checkedAt: string;
}

/** Both sources, fetched with the given fetch (the browser's or the server's). */
export async function fetchHazards(get: typeof fetch = fetch, signal?: AbortSignal): Promise<HazardFeed> {
  const now = Date.now();
  const grab = async (url: string) => {
    const res = await get(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };
  const [g, u] = await Promise.allSettled([grab(gdacsUrl(now)), grab(usgsUrl(now))]);
  const missing: HazardFeed['missing'] = [];
  if (g.status === 'rejected') missing.push('GDACS');
  if (u.status === 'rejected') missing.push('USGS');
  return {
    hazards: mergeHazards([g.status === 'fulfilled' ? parseGdacs(g.value) : [], u.status === 'fulfilled' ? parseUsgs(u.value, now) : []]),
    missing,
    checkedAt: new Date(now).toISOString(),
  };
}
