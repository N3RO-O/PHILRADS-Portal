/**
 * GET /api/gifs?q=thanks   GIFs for the project chat, from GIPHY (trending when q is empty).
 *
 * Only signed-in, active staff can use it, and the GIPHY key stays on the server
 * (GIPHY_API_KEY in Vercel's environment variables, never VITE_*). Only the search words are sent
 * to GIPHY, nothing about the person. Results are trimmed to what the chat shows.
 */
import { caller, config, json } from './_drive.js';

interface GiphyImage {
  url?: string;
  width?: string;
  height?: string;
}
interface GiphyGif {
  id: string;
  title?: string;
  images?: { fixed_height?: GiphyImage; fixed_height_small?: GiphyImage; downsized?: GiphyImage };
}

const GIPHY = /^https:\/\/(media[0-9]*|i)\.giphy\.com\//;
const clean = (url?: string) => (url ? url.split('?')[0] : '');

export async function GET(request: Request) {
  const key = process.env.GIPHY_API_KEY ?? '';
  if (!key) return json(503, { error: 'GIFs aren’t set up yet. An administrator needs to add a free GIPHY key (GIPHY_API_KEY).' });
  const c = config();
  if (!c.supabaseUrl || !c.serviceKey) return json(503, { error: 'Server not configured.' });
  const who = await caller(c, request);
  if (!who) return json(401, { error: 'Sign in first.' });

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 50);
  const upstream = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&limit=24&rating=g&lang=en`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(key)}&limit=24&rating=g`;
  let res: Response;
  try {
    res = await fetch(upstream);
  } catch {
    return json(502, { error: 'GIPHY is unreachable. Try again.' });
  }
  if (!res.ok) return json(502, { error: 'GIPHY didn’t answer. Try again.' });
  const body = (await res.json().catch(() => null)) as { data?: GiphyGif[] } | null;
  const gifs = (body?.data ?? [])
    .map((g) => {
      const full = g.images?.fixed_height ?? g.images?.downsized;
      const small = g.images?.fixed_height_small ?? full;
      return {
        id: g.id,
        title: (g.title ?? '').slice(0, 80),
        url: clean(full?.url),
        preview: clean(small?.url),
        width: Number(full?.width) || 200,
        height: Number(full?.height) || 200,
      };
    })
    .filter((g) => GIPHY.test(g.url) && GIPHY.test(g.preview));
  return json(200, { gifs }, { 'Cache-Control': 'private, max-age=300' });
}
