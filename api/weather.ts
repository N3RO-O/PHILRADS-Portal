/**
 * GET /api/weather: Live Map weather from Open-Meteo, cached at Vercel's edge.
 *
 *   ?grid=south,west,step,rows,cols   forecast grid for the map (wind, temperature, rain; 48 h)
 *   ?spot=lat,lng                     forecast for one spot (now, 24 h, 7 days)
 *
 * Only these two fixed requests are passed on (it is not an open proxy), and answers are shared
 * by everyone for up to 30 minutes, so the whole team stays well inside Open-Meteo's free limits.
 * Public forecast data only: no login, nothing about the user is sent.
 */
import { gridUrl, spotUrl, validGrid, validSpot } from '../src/services/weather/openMeteo.js';

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let upstream: string;
  let maxAge: number;
  const grid = params.get('grid');
  const spot = params.get('spot');
  if (grid) {
    const [south, west, step, rows, cols] = grid.split(',').map(Number);
    const spec = { south, west, step, rows, cols };
    if (!validGrid(spec)) return fail(400, 'Invalid grid.');
    upstream = gridUrl(spec);
    maxAge = 1800;
  } else if (spot) {
    const [lat, lng] = spot.split(',').map(Number);
    if (!validSpot(lat, lng)) return fail(400, 'Invalid spot.');
    upstream = spotUrl(lat, lng);
    maxAge = 900;
  } else return fail(400, 'Ask for a grid or a spot.');

  let res: Response;
  try {
    res = await fetch(upstream, { headers: { 'User-Agent': 'PHILRADS-Staff-Portal' } });
  } catch {
    return fail(502, 'Weather service unreachable.');
  }
  if (!res.ok) return fail(res.status === 429 ? 429 : 502, `Weather service answered ${res.status}.`);
  return new Response(await res.text(), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=300, s-maxage=${maxAge}, stale-while-revalidate=900`,
    },
  });
}
