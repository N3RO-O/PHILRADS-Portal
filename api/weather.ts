/**
 * GET /api/weather: Live Map weather from Open-Meteo, cached at Vercel's edge.
 *
 *   ?grid=south,west,step,rows,cols   forecast grid for the map (wind, temperature, rain; 48 h)
 *   ?spot=lat,lng                     forecast for one spot (now, 24 h, 7 days)
 *
 * Only these two fixed requests are passed on (it is not an open proxy), and answers are shared
 * by everyone for up to 30 minutes, so the whole team stays well inside Open-Meteo's free limits.
 * Public forecast data only: no login, nothing about the user is sent.
 *
 *   ?gifs=words                       project chat GIF search (signed-in staff; see _gifs.ts)
 *   ?devotional=YYYY-MM-DD            Our Daily Bread for that day (public text, cached; see verse/odb.ts)
 *   ?hazards=ph                       guest Disaster News: GDACS and USGS for the Philippines (cached; see guest/hazards.ts)
 *   ?share=screen[&story=|&drive=]   guest share cards for link-preview robots (see _share.ts; routed in vercel.json)
 *   ?facebook=page                    guest Disaster News: PHILRADS's Facebook posts via rss.app (cached; see guest/facebook.ts)
 *
 * The extra jobs ride on this function because the Hobby plan allows 12 functions per deployment.
 */
import { gifs } from './_gifs.js';
import { share } from './_share.js';
import { gridUrl, spotUrl, validGrid, validSpot } from '../src/services/weather/openMeteo.js';
import { isDayKey, odbApiUrl, parseOdb } from '../src/services/verse/odb.js';
import { fetchHazards } from '../src/services/guest/hazards.js';
import { FACEBOOK_PAGE, parseFacebookFeed, validFeedUrl } from '../src/services/guest/facebook.js';

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** One day's Our Daily Bread, as plain text. Days ahead of tomorrow aren't asked for. */
async function devotional(day: string) {
  const tomorrow = new Date(Date.now() + 36 * 3_600_000).toISOString().slice(0, 10);
  if (!isDayKey(day) || day < '2015-01-01' || day > tomorrow) return fail(400, 'Ask for a day as YYYY-MM-DD.');
  let res: Response;
  try {
    res = await fetch(odbApiUrl(day), { headers: { Accept: 'application/json', 'User-Agent': 'PHILRADS-Staff-Portal' } });
  } catch {
    return fail(502, 'Our Daily Bread is unreachable.');
  }
  if (!res.ok) return fail(502, `Our Daily Bread answered ${res.status}.`);
  const found = parseOdb(await res.json().catch(() => null), day);
  if (!found) return fail(404, 'No devotional for that day.');
  return new Response(JSON.stringify(found), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800, s-maxage=21600, stale-while-revalidate=86400' },
  });
}

/** Hazards affecting the Philippines, shared by every guest for 10 minutes. */
async function hazards() {
  const feed = await fetchHazards((url, init) => fetch(url, { ...init, headers: { ...init?.headers, 'User-Agent': 'PHILRADS-Portal' } }));
  if (feed.missing.length === 2) return fail(502, 'Disaster news sources are unreachable.');
  return new Response(JSON.stringify(feed), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=300, s-maxage=${feed.missing.length ? 120 : 600}, stale-while-revalidate=1800` },
  });
}

/**
 * PHILRADS's Facebook posts, from the rss.app feed set in FACEBOOK_FEED_URL, shared by every guest
 * for 15 minutes. 404 until the feed is set, so the page simply leaves the posts out.
 */
async function facebook() {
  const url = validFeedUrl(process.env.FACEBOOK_FEED_URL);
  if (!url) return fail(404, 'The Facebook feed is not set up.');
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/feed+json, application/json, application/rss+xml, application/xml', 'User-Agent': 'PHILRADS-Portal' } });
  } catch {
    return fail(502, 'The Facebook feed is unreachable.');
  }
  if (!res.ok) return fail(502, `The Facebook feed answered ${res.status}.`);
  const posts = parseFacebookFeed(await res.text());
  return new Response(JSON.stringify({ posts, page: FACEBOOK_PAGE, checkedAt: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600' },
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.has('gifs')) return gifs(request);
  if (params.has('share')) return share(request);
  if (params.get('hazards') === 'ph') return hazards();
  if (params.get('facebook') === 'page') return facebook();
  const day = params.get('devotional');
  if (day !== null) return devotional(day);
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
