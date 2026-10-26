// Open-Meteo request URLs, shared by the browser and the /api/weather cache in front of it.
// Open-Meteo counts every grid point as one request (600 a minute, 10,000 a day per address),
// so grids are kept to at most 9 × 9 points on a fixed set of spacings: the same view asks for
// exactly the same grid, which the cache then answers for the whole team.

export const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const TZ = 'Asia%2FManila';
/** Hours of forecast on the map's timeline. */
export const GRID_HOURS = 48;
/** Grid spacings in degrees (about 11 km to 550 km). */
export const GRID_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5];
export const GRID_MAX_POINTS = 9;

export interface GridSpec {
  south: number;
  west: number;
  step: number;
  rows: number;
  cols: number;
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** The grid is one of the fixed spacings, lined up on it, and small. */
export function validGrid(g: GridSpec): boolean {
  const onStep = (x: number) => Math.abs(x / g.step - Math.round(x / g.step)) < 1e-6;
  return (
    GRID_STEPS.includes(g.step) &&
    Number.isInteger(g.rows) &&
    Number.isInteger(g.cols) &&
    g.rows >= 2 &&
    g.cols >= 2 &&
    g.rows <= GRID_MAX_POINTS &&
    g.cols <= GRID_MAX_POINTS &&
    onStep(g.south) &&
    onStep(g.west) &&
    g.south >= -85 &&
    g.south + (g.rows - 1) * g.step <= 85 &&
    g.west >= -540 &&
    g.west <= 540
  );
}

export function gridUrl(g: GridSpec): string {
  const lats: string[] = [];
  const lngs: string[] = [];
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) {
      lats.push(String(round(g.south + r * g.step)));
      // Longitudes past ±180 (the map wraps) are folded back for the API.
      lngs.push(String(round(((((g.west + c * g.step + 180) % 360) + 360) % 360) - 180)));
    }
  return (
    `${OPEN_METEO}?latitude=${lats.join(',')}&longitude=${lngs.join(',')}` +
    `&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,precipitation&forecast_hours=${GRID_HOURS}&timeformat=unixtime&timezone=${TZ}`
  );
}

export const validSpot = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** A spot's forecast, rounded to about 1 km so nearby taps share the cache. */
export function spotUrl(lat: number, lng: number): string {
  return (
    `${OPEN_METEO}?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
    '&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&forecast_hours=24' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max&forecast_days=7' +
    `&timeformat=unixtime&timezone=${TZ}`
  );
}
