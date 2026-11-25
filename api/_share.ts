/**
 * Share cards: what Facebook, Messenger, WhatsApp, X and others show when someone shares a guest
 * link. vercel.json sends only those link-preview robots here (by their user agent); people get the
 * app as usual. A story or fundraiser gets its own title, words and cover picture; every other guest
 * page gets its name and the PHILRADS card.
 *
 * Reads with the public (anon) key, so it can only see what any guest can see.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SCREENS: Record<string, { title: string; text: string }> = {
  '': { title: 'Live Map', text: 'See where Philippine Relief and Development Services is helping, what is happening now, and how you can help.' },
  news: { title: 'Disaster News', text: 'PHILRADS announcements, and typhoons, floods and earthquakes affecting the Philippines now.' },
  stories: { title: 'PHILReads', text: 'Stories from the field: the families PHILRADS serves and the people who serve them.' },
  give: { title: 'Fundraising', text: 'Give to a PHILRADS relief fundraiser, and see where earlier gifts went.' },
  merch: { title: 'Merch', text: 'PHILRADS shirts and more. Every purchase supports relief work.' },
  hotlines: { title: 'Emergency hotlines', text: 'Emergency numbers in the Philippines, one tap to call.' },
  prepare: { title: 'Be prepared', text: 'Go bag and family plan checklists, and what to do before, during and after a typhoon, flood or earthquake.' },
  alerts: { title: 'Alerts', text: 'Get a notification when a typhoon comes near the regions you follow.' },
  pray: { title: 'Pray with us', text: 'This week’s prayer points from PHILRADS, for families going through a disaster and the people serving them.' },
  feedback: { title: 'Feedback', text: 'Say thanks, tell PHILRADS about a need, or offer to volunteer.' },
  more: { title: 'PRISM Guest', text: 'See where Philippine Relief and Development Services is helping, and how you can help.' },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

async function row(table: string, id: string, filter: string, select: string): Promise<Record<string, string | null> | null> {
  const base = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key || !UUID.test(id)) return null;
  try {
    const res = await fetch(`${base}/rest/v1/${table}?id=eq.${id}&${filter}&select=${select}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return null;
    const rows = (await res.json()) as Record<string, string | null>[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function share(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const screen = (url.searchParams.get('share') ?? '').replace(/[^a-z]/g, '');
  const base = SCREENS[screen] ?? SCREENS[''];
  const origin = url.origin;
  let title = `${base.title} · PHILRADS`;
  let text = base.text;
  let image = `${origin}/brand/guest-share.png`;
  let path = screen ? `/guest/${screen}` : '/guest';

  const story = url.searchParams.get('story');
  const drive = url.searchParams.get('drive');
  if (screen === 'stories' && story) {
    const s = await row('guest_stories', story, 'is_published=eq.true', 'title,summary,body,cover_url');
    if (s?.title) {
      title = `${s.title} · PHILReads`;
      text = clip(s.summary || s.body || text, 200);
      if (s.cover_url) image = s.cover_url;
      path = `/guest/stories?story=${story}`;
    }
  } else if (screen === 'give' && drive) {
    const d = await row('donation_drives', drive, 'status=neq.draft', 'title,summary,report,cover_url,status');
    if (d?.title) {
      title = d.status === 'closed' && d.report ? `What your gifts did: ${d.title}` : `${d.title} · Give to PHILRADS`;
      text = clip((d.status === 'closed' && d.report) || d.summary || text, 200);
      if (d.cover_url) image = d.cover_url;
      path = `/guest/give?drive=${drive}`;
    }
  }

  const page = `${origin}${path}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(text)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PHILRADS">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(text)}">
<meta property="og:url" content="${esc(page)}">
<meta property="og:image" content="${esc(image)}">
${image.endsWith('/brand/guest-share.png') ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n' : ''}<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(text)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(page)}">
</head>
<body><h1>${esc(title)}</h1><p>${esc(text)}</p><p><a href="${esc(page)}">Open on PRISM</a></p></body>
</html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600' } });
}
