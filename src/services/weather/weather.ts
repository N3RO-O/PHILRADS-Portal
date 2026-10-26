// Live weather for the Live Map, from free, keyless, open services:
// - Open-Meteo (open-source weather API; free for non-commercial use, CC BY 4.0): wind,
//   rain and temperature forecasts on a grid over the map, and a forecast for any spot.
// - RainViewer: rain radar for the past two hours.
// Forecasts go through /api/weather (cached for the whole team); straight to Open-Meteo if that
// isn't there (local development) or fails. Nothing about the user is sent.

import { GRID_MAX_POINTS, GRID_STEPS, gridUrl, spotUrl } from './openMeteo';

export { GRID_HOURS } from './openMeteo';

export type WeatherMode = 'wind' | 'rain' | 'temp' | 'radar';

/** A regular grid of forecast values: `values[hour][row * cols + col]`, rows from south to north. */
export interface WeatherGrid {
  south: number;
  west: number;
  step: number;
  rows: number;
  cols: number;
  /** Unix seconds of each forecast hour. */
  times: number[];
  /** Wind towards east / north (m/s). */
  u: Float32Array[];
  v: Float32Array[];
  /** km/h */
  speed: Float32Array[];
  /** °C */
  temp: Float32Array[];
  /** mm in the hour */
  rain: Float32Array[];
  /** Cloud cover, 0–100 % */
  cloud: Float32Array[];
  /** 1 where a thunderstorm is forecast */
  storm: Float32Array[];
}

export interface GridArea {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * The grid for a view: the view widened by a quarter on each side, on the finest fixed spacing
 * that keeps it within 11 × 11 points (never finer than the models, ~0.1°). Lined up on the spacing,
 * so small pans reuse it and everyone looking at the same area asks for the same grid.
 */
export function gridAreaFor(view: GridArea): GridArea & { step: number } {
  const padLat = (view.north - view.south) / 4;
  const padLng = (view.east - view.west) / 4;
  const s0 = Math.max(-84, view.south - padLat);
  const n0 = Math.min(84, view.north + padLat);
  const w0 = view.west - padLng;
  const e0 = view.east + padLng;
  const points = (lo: number, hi: number, step: number) => Math.round(Math.ceil(hi / step - 1e-9) - Math.floor(lo / step + 1e-9)) + 1;
  const step = GRID_STEPS.find((st) => points(s0, n0, st) <= GRID_MAX_POINTS && points(w0, e0, st) <= GRID_MAX_POINTS) ?? GRID_STEPS[GRID_STEPS.length - 1];
  const snap = (x: number) => Math.round(x * 1000) / 1000;
  // Past the widest spacing (never on this map's zoom range) the grid stays around the middle.
  const start = (lo: number, hi: number) =>
    points(lo, hi, step) <= GRID_MAX_POINTS ? Math.floor(lo / step + 1e-9) * step : Math.round((lo + hi) / 2 / step - (GRID_MAX_POINTS - 1) / 2) * step;
  const south = snap(Math.max(-80, start(s0, n0)));
  const west = snap(start(w0, e0));
  const rows = Math.min(GRID_MAX_POINTS, points(s0, n0, step));
  const cols = Math.min(GRID_MAX_POINTS, points(w0, e0, step));
  return { step, south, west, north: snap(south + (rows - 1) * step), east: snap(west + (cols - 1) * step) };
}

export const covers = (outer: GridArea, inner: GridArea) =>
  inner.south >= outer.south && inner.north <= outer.north && inner.west >= outer.west && inner.east <= outer.east;

interface OmHourly {
  time: number[];
  wind_speed_10m: (number | null)[];
  wind_direction_10m: (number | null)[];
  temperature_2m: (number | null)[];
  precipitation: (number | null)[];
  cloud_cover: (number | null)[];
  weather_code: (number | null)[];
}

export class WeatherBusyError extends Error {
  constructor() {
    super('The free weather service is busy. Try again in a minute.');
  }
}

const gridCache = new Map<string, { at: number; grid: WeatherGrid }>();

/** Through the team's cache first; straight to Open-Meteo if it isn't there or fails. */
async function getJson(proxyQuery: string, direct: string, signal?: AbortSignal): Promise<unknown> {
  // Local development has no /api routes (Vite would try to serve the source file).
  if (!import.meta.env.DEV) {
    try {
      const res = await fetch(`/api/weather?v=2&${proxyQuery}`, { signal });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) return await res.json();
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  const res = await fetch(direct, { signal });
  if (res.status === 429) throw new WeatherBusyError();
  if (!res.ok) throw new Error(`Weather service error ${res.status}`);
  return res.json();
}

/** Forecast grid over an area (from gridAreaFor). Cached for 20 minutes. */
export async function fetchGrid(area: GridArea & { step: number }, signal?: AbortSignal): Promise<WeatherGrid> {
  const { step } = area;
  const rows = Math.round((area.north - area.south) / step) + 1;
  const cols = Math.round((area.east - area.west) / step) + 1;
  const spec = { south: area.south, west: area.west, step, rows, cols };
  const key = [spec.south, spec.west, step, rows, cols].join(',');
  const hit = gridCache.get(key);
  if (hit && Date.now() - hit.at < 20 * 60_000) return hit.grid;
  const body = (await getJson(`grid=${key}`, gridUrl(spec), signal)) as { hourly: OmHourly } | { hourly: OmHourly }[];
  const points = Array.isArray(body) ? body : [body];
  const times = points[0].hourly.time;
  const n = rows * cols;
  const make = () => times.map(() => new Float32Array(n));
  const grid: WeatherGrid = { south: area.south, west: area.west, step, rows, cols, times, u: make(), v: make(), speed: make(), temp: make(), rain: make(), cloud: make(), storm: make() };
  points.forEach((p, i) => {
    const h = p.hourly;
    for (let t = 0; t < times.length; t++) {
      const kmh = h.wind_speed_10m[t] ?? 0;
      // Direction is where the wind comes FROM, clockwise from north.
      const rad = (((h.wind_direction_10m[t] ?? 0) + 180) * Math.PI) / 180;
      const ms = kmh / 3.6;
      grid.u[t][i] = ms * Math.sin(rad);
      grid.v[t][i] = ms * Math.cos(rad);
      grid.speed[t][i] = kmh;
      grid.temp[t][i] = h.temperature_2m[t] ?? NaN;
      grid.rain[t][i] = h.precipitation[t] ?? 0;
      grid.cloud[t][i] = h.cloud_cover?.[t] ?? 0;
      grid.storm[t][i] = (h.weather_code?.[t] ?? 0) >= 95 ? 1 : 0;
    }
  });
  gridCache.set(key, { at: Date.now(), grid });
  return grid;
}

/** 1 inside the grid, fading to 0 over the last half cell, so the edge is soft (0 outside). */
export function edgeFade(grid: WeatherGrid, lat: number, lng: number): number {
  const y = (lat - grid.south) / grid.step;
  const x = (lng - grid.west) / grid.step;
  const d = Math.min(y, x, grid.rows - 1 - y, grid.cols - 1 - x);
  return d <= 0 ? 0 : d >= 0.5 ? 1 : d * 2;
}

/** Bilinear value of a grid layer at a point (NaN outside the grid). */
export function sample(grid: WeatherGrid, layer: Float32Array, lat: number, lng: number): number {
  const y = (lat - grid.south) / grid.step;
  const x = (lng - grid.west) / grid.step;
  if (y < 0 || x < 0 || y > grid.rows - 1 || x > grid.cols - 1) return NaN;
  const r = Math.min(Math.floor(y), grid.rows - 2);
  const c = Math.min(Math.floor(x), grid.cols - 2);
  const fy = y - r;
  const fx = x - c;
  const i = r * grid.cols + c;
  const a = layer[i];
  const b = layer[i + 1];
  const d = layer[i + grid.cols];
  const e = layer[i + grid.cols + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
}

/** The forecast hour to show first: the one we're in now. */
export function currentHourIndex(times: number[], now = Date.now() / 1000): number {
  let i = 0;
  while (i + 1 < times.length && times[i + 1] <= now) i++;
  return i;
}

// ---------------------------------------------------------------------------------------------
// Forecast for one spot

export interface SpotForecast {
  current: { time: number; temp: number; feelsLike: number; humidity: number; rain: number; code: number; wind: number; gusts: number; windFrom: number };
  hourly: { time: number; temp: number; rainChance: number; rain: number; code: number; wind: number; gusts: number }[];
  daily: { time: number; code: number; max: number; min: number; rain: number; rainChance: number; wind: number; gusts: number }[];
}

const spotCache = new Map<string, { at: number; data: SpotForecast }>();

export async function fetchSpot(lat: number, lng: number, signal?: AbortSignal): Promise<SpotForecast> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = spotCache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = (await getJson(`spot=${key}`, spotUrl(lat, lng), signal)) as any;
  const num = (x: unknown) => (typeof x === 'number' ? x : 0);
  const data: SpotForecast = {
    current: {
      time: b.current.time,
      temp: num(b.current.temperature_2m),
      feelsLike: num(b.current.apparent_temperature),
      humidity: num(b.current.relative_humidity_2m),
      rain: num(b.current.precipitation),
      code: num(b.current.weather_code),
      wind: num(b.current.wind_speed_10m),
      gusts: num(b.current.wind_gusts_10m),
      windFrom: num(b.current.wind_direction_10m),
    },
    hourly: (b.hourly.time as number[]).map((time, i) => ({
      time,
      temp: num(b.hourly.temperature_2m[i]),
      rainChance: num(b.hourly.precipitation_probability[i]),
      rain: num(b.hourly.precipitation[i]),
      code: num(b.hourly.weather_code[i]),
      wind: num(b.hourly.wind_speed_10m[i]),
      gusts: num(b.hourly.wind_gusts_10m[i]),
    })),
    daily: (b.daily.time as number[]).map((time, i) => ({
      time,
      code: num(b.daily.weather_code[i]),
      max: num(b.daily.temperature_2m_max[i]),
      min: num(b.daily.temperature_2m_min[i]),
      rain: num(b.daily.precipitation_sum[i]),
      rainChance: num(b.daily.precipitation_probability_max[i]),
      wind: num(b.daily.wind_speed_10m_max[i]),
      gusts: num(b.daily.wind_gusts_10m_max[i]),
    })),
  };
  spotCache.set(key, { at: Date.now(), data });
  return data;
}

/** Things worth flagging to a response team in the next 24 hours (thresholds used by PAGASA). */
export function spotAlerts(f: SpotForecast): { level: 'red' | 'orange' | 'yellow'; text: string }[] {
  const out: { level: 'red' | 'orange' | 'yellow'; text: string }[] = [];
  const gust = Math.max(f.current.gusts, ...f.hourly.map((h) => h.gusts));
  const rain = Math.max(f.current.rain, ...f.hourly.map((h) => h.rain));
  if (gust >= 118) out.push({ level: 'red', text: `Destructive winds possible: gusts up to ${Math.round(gust)} km/h (Signal No. 4 strength).` });
  else if (gust >= 89) out.push({ level: 'red', text: `Very strong winds: gusts up to ${Math.round(gust)} km/h (Signal No. 3 strength).` });
  else if (gust >= 62) out.push({ level: 'orange', text: `Strong winds: gusts up to ${Math.round(gust)} km/h (Signal No. 2 strength).` });
  else if (gust >= 39) out.push({ level: 'yellow', text: `Breezy to strong: gusts up to ${Math.round(gust)} km/h.` });
  if (rain >= 30) out.push({ level: 'red', text: `Torrential rain: up to ${rain.toFixed(0)} mm in an hour. Flooding likely in low areas.` });
  else if (rain >= 15) out.push({ level: 'orange', text: `Intense rain: up to ${rain.toFixed(0)} mm in an hour. Flooding possible.` });
  else if (rain >= 7.5) out.push({ level: 'yellow', text: `Heavy rain: up to ${rain.toFixed(1)} mm in an hour.` });
  return out;
}

/** WMO weather codes in plain words. */
export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 55) return 'Drizzle';
  if (code <= 57) return 'Freezing drizzle';
  if (code <= 61) return 'Light rain';
  if (code <= 63) return 'Rain';
  if (code <= 67) return 'Heavy rain';
  if (code <= 77) return 'Snow';
  if (code <= 80) return 'Rain showers';
  if (code <= 82) return 'Heavy showers';
  if (code <= 86) return 'Snow showers';
  if (code === 95) return 'Thunderstorm';
  return 'Thunderstorm with hail';
}

/** Compass point the wind comes from, e.g. "NE". */
export function compass(deg: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// ---------------------------------------------------------------------------------------------
// Rain radar (RainViewer, past two hours in 10-minute frames; detail up to zoom 7)

export interface RadarFrame {
  time: number;
  url: string;
}

export async function fetchRadar(signal?: AbortSignal): Promise<RadarFrame[]> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', { signal });
  if (!res.ok) throw new Error(`Radar service error ${res.status}`);
  const b = (await res.json()) as { host: string; radar: { past: { time: number; path: string }[]; nowcast?: { time: number; path: string }[] } };
  return [...b.radar.past, ...(b.radar.nowcast ?? [])].map((f) => ({ time: f.time, url: `${b.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png` }));
}

// ---------------------------------------------------------------------------------------------
// Colours (also drawn as the legend)

export interface ColorStop {
  at: number;
  rgb: [number, number, number];
  alpha?: number;
}

/** Wind in km/h; the steps line up with PAGASA's wind signals (39 / 62 / 89 / 118 / 185 km/h). */
export const WIND_SCALE: ColorStop[] = [
  { at: 0, rgb: [56, 78, 160] },
  { at: 10, rgb: [45, 130, 190] },
  { at: 20, rgb: [40, 170, 150] },
  { at: 30, rgb: [90, 190, 80] },
  { at: 39, rgb: [230, 210, 60] },
  { at: 62, rgb: [240, 140, 40] },
  { at: 89, rgb: [220, 50, 50] },
  { at: 118, rgb: [190, 40, 160] },
  { at: 185, rgb: [255, 255, 255] },
];

/** Rain in mm per hour; PAGASA's rainfall warning colours (yellow 7.5, orange 15, red 30). */
export const RAIN_SCALE: ColorStop[] = [
  { at: 0, rgb: [0, 0, 0], alpha: 0 },
  { at: 0.1, rgb: [110, 175, 240], alpha: 0.45 },
  { at: 1, rgb: [50, 120, 235], alpha: 0.75 },
  { at: 2.5, rgb: [30, 185, 110], alpha: 0.85 },
  { at: 7.5, rgb: [245, 215, 40], alpha: 0.95 },
  { at: 15, rgb: [250, 135, 30], alpha: 1 },
  { at: 30, rgb: [225, 35, 40], alpha: 1 },
  { at: 50, rgb: [190, 40, 190], alpha: 1 },
];

/** Temperature in °C, spread over the range the Philippines actually sees so differences show. */
export const TEMP_SCALE: ColorStop[] = [
  { at: 16, rgb: [60, 70, 180] },
  { at: 20, rgb: [45, 130, 215] },
  { at: 23, rgb: [40, 185, 190] },
  { at: 25, rgb: [70, 190, 100] },
  { at: 27, rgb: [190, 210, 60] },
  { at: 29, rgb: [245, 185, 45] },
  { at: 31, rgb: [245, 120, 40] },
  { at: 33, rgb: [225, 55, 45] },
  { at: 36, rgb: [175, 25, 95] },
];

/** [r, g, b, alpha 0–1] for a value on a scale. */
export function colorAt(scale: ColorStop[], value: number): [number, number, number, number] {
  if (!Number.isFinite(value)) return [0, 0, 0, 0];
  if (value <= scale[0].at) return [...scale[0].rgb, scale[0].alpha ?? 1];
  for (let i = 1; i < scale.length; i++) {
    const b = scale[i];
    if (value <= b.at) {
      const a = scale[i - 1];
      const k = (value - a.at) / (b.at - a.at);
      const mix = (x: number, y: number) => x + (y - x) * k;
      return [mix(a.rgb[0], b.rgb[0]), mix(a.rgb[1], b.rgb[1]), mix(a.rgb[2], b.rgb[2]), mix(a.alpha ?? 1, b.alpha ?? 1)];
    }
  }
  const last = scale[scale.length - 1];
  return [...last.rgb, last.alpha ?? 1];
}

export const cssColor = (scale: ColorStop[], value: number) => {
  const [r, g, b, a] = colorAt(scale, value);
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
};

// ---------------------------------------------------------------------------------------------
// Land outline (temperature is shown on land only): Natural Earth 1:50m, public domain, clipped to
// the region around the Philippines (public/geo/land-sea-asia.json, ~35 kB gzipped, loaded once).

export interface LandMask {
  bbox: [number, number, number, number];
  /** Flat [lng, lat, lng, lat, …] rings; holes (lakes) are cut out with the even-odd rule. */
  rings: number[][];
}

let landPromise: Promise<LandMask | null> | null = null;
export function loadLand(): Promise<LandMask | null> {
  landPromise ??= fetch('/geo/land-sea-asia.json')
    .then((r) => (r.ok ? (r.json() as Promise<LandMask>) : null))
    .catch(() => {
      landPromise = null;
      return null;
    });
  return landPromise;
}

// ---------------------------------------------------------------------------------------------
// Is the radar showing anything here? (Looks at the radar pictures for the area in view.)

export type RadarCheck = 'rain' | 'dry' | 'uncovered';

const lngToX = (lng: number, z: number) => ((lng + 180) / 360) * 256 * 2 ** z;
const latToY = (lat: number, z: number) => {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 256 * 2 ** z;
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Any coloured pixel of these radar pictures inside the view? */
async function anyPixels(template: string, view: GridArea, z: number): Promise<boolean> {
  const x0 = lngToX(view.west, z);
  const x1 = lngToX(view.east, z);
  const y0 = latToY(view.north, z);
  const y1 = latToY(view.south, z);
  const tiles: [number, number][] = [];
  for (let ty = Math.floor(y0 / 256); ty <= Math.floor(y1 / 256); ty++)
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor(x1 / 256); tx++) tiles.push([tx, ty]);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const n = 2 ** z;
  for (const [tx, ty] of tiles.slice(0, 16)) {
    const img = await loadImage(template.replace('{z}', String(z)).replace('{x}', String(((tx % n) + n) % n)).replace('{y}', String(ty)));
    if (!img) continue;
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(img, 0, 0);
    const left = Math.max(0, Math.floor(x0 - tx * 256));
    const top = Math.max(0, Math.floor(y0 - ty * 256));
    const right = Math.min(256, Math.ceil(x1 - tx * 256));
    const bottom = Math.min(256, Math.ceil(y1 - ty * 256));
    if (right <= left || bottom <= top) continue;
    const data = ctx.getImageData(left, top, right - left, bottom - top).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 60) return true;
  }
  return false;
}

export const RADAR_COVERAGE = 'https://tilecache.rainviewer.com/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png';

/** Whether radar reaches the area in view, and if so whether it sees rain there in this frame. */
export async function checkRadar(frame: RadarFrame, view: GridArea, zoom: number): Promise<RadarCheck> {
  const z = Math.max(1, Math.min(7, Math.floor(zoom)));
  if (!(await anyPixels(RADAR_COVERAGE, view, z))) return 'uncovered';
  return (await anyPixels(frame.url, view, z)) ? 'rain' : 'dry';
}
