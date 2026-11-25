// Sends guest alerts (Web Push) to guests who turned them on in the guest page's Alerts screen.
//
// 1. Urgent PHILRADS announcements: each one that is published, still live and not yet sent goes
//    to every guest, once.
// 2. Typhoons: each current typhoon from the portal's hazard feed (GDACS) goes, once per region,
//    to the guests who follow a region whose middle is within RADIUS_KM of it. Guests following
//    the whole country get each typhoon once.
//
// Called every 15 minutes by pg_cron, and by the portal right after staff publish an urgent
// announcement. It needs no sign-in: it only ever sends what is due, claiming each alert first so
// two calls at once never send the same one twice, so calling it more often changes nothing.
//
// Secrets (Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (shared
// with push-notifications). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Deploy with "Verify JWT" off.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const SITE = 'https://philrads-portal.vercel.app';
const RADIUS_KM = 500;
// Keep in step with src/services/guest/regions.ts.
const REGIONS: Record<string, { name: string; lat: number; lng: number }> = {
  NCR: { name: 'Metro Manila', lat: 14.6, lng: 121.0 },
  CAR: { name: 'Cordillera', lat: 17.35, lng: 121.0 },
  R1: { name: 'Ilocos Region', lat: 16.6, lng: 120.4 },
  R2: { name: 'Cagayan Valley', lat: 17.2, lng: 121.7 },
  R3: { name: 'Central Luzon', lat: 15.4, lng: 120.7 },
  R4A: { name: 'CALABARZON', lat: 14.1, lng: 121.4 },
  MIMAROPA: { name: 'MIMAROPA', lat: 12.0, lng: 120.5 },
  R5: { name: 'Bicol Region', lat: 13.4, lng: 123.5 },
  R6: { name: 'Western Visayas', lat: 11.0, lng: 122.4 },
  NIR: { name: 'Negros Island Region', lat: 10.2, lng: 122.9 },
  R7: { name: 'Central Visayas', lat: 10.2, lng: 123.8 },
  R8: { name: 'Eastern Visayas', lat: 11.5, lng: 125.0 },
  R9: { name: 'Zamboanga Peninsula', lat: 7.8, lng: 122.8 },
  R10: { name: 'Northern Mindanao', lat: 8.2, lng: 124.6 },
  R11: { name: 'Davao Region', lat: 7.2, lng: 125.8 },
  R12: { name: 'SOCCSKSARGEN', lat: 6.5, lng: 124.8 },
  R13: { name: 'Caraga', lat: 8.8, lng: 125.8 },
  BARMM: { name: 'Bangsamoro', lat: 6.9, lng: 124.2 },
};

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface Hazard {
  id: string;
  kind: string;
  title: string;
  detail: string;
  current: boolean;
  lat: number;
  lng: number;
}
interface Sub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  regions: string[];
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv) return Response.json({ error: 'Phone notifications are not set up yet.' }, { status: 503, headers: cors });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? SITE, pub, priv);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data: subs, error } = await db.from('guest_push_subscriptions').select('id, endpoint, p256dh, auth, regions').limit(50_000);
  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
  const gone = new Set<string>();
  let sent = 0;
  const send = (to: Sub[], msg: { id: string; title: string; body: string; url: string }) =>
    Promise.all(
      to.map(async (s) => {
        if (gone.has(s.id)) return;
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 12, urgency: 'high' });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.add(s.id);
        }
      }),
    );

  // 1. Urgent announcements published in the last 6 hours, still live, not yet sent.
  const now = new Date();
  const { data: notes } = await db
    .from('guest_announcements')
    .select('id, title, body, area')
    .eq('is_published', true)
    .eq('level', 'urgent')
    .is('pushed_at', null)
    .gte('published_at', new Date(now.getTime() - 6 * 3_600_000).toISOString())
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);
  let announcements = 0;
  if (notes?.length) {
    const { data: claimed } = await db
      .from('guest_announcements')
      .update({ pushed_at: now.toISOString() })
      .in('id', notes.map((n) => n.id))
      .is('pushed_at', null)
      .select('id');
    const mine = new Set((claimed ?? []).map((c) => c.id));
    for (const n of notes.filter((x) => mine.has(x.id))) {
      announcements++;
      const body = [n.area, n.body].filter(Boolean).join(': ').slice(0, 180);
      await send(subs ?? [], { id: `ga-${n.id}`, title: `PHILRADS: ${n.title}`, body, url: '/guest/news' });
    }
  }

  // 2. Current typhoons near the regions guests follow.
  let typhoons = 0;
  let hazards: Hazard[] = [];
  try {
    const res = await fetch(`${SITE}/api/weather?hazards=ph`);
    if (res.ok) hazards = ((await res.json()) as { hazards: Hazard[] }).hazards ?? [];
  } catch {
    /* the next run tries again */
  }
  for (const h of hazards.filter((x) => x.kind === 'typhoon' && x.current && Number.isFinite(x.lat) && Number.isFinite(x.lng))) {
    const near = Object.entries(REGIONS)
      .filter(([, r]) => km(r, h) <= RADIUS_KM)
      .map(([code]) => code);
    if (!near.length) continue;
    // Claim each region (and '*' for whole-country followers) for this typhoon; only new claims send.
    const { data: claimed } = await db
      .from('guest_alerts_sent')
      .upsert(
        [...near, '*'].map((region) => ({ hazard_id: h.id, region })),
        { onConflict: 'hazard_id,region', ignoreDuplicates: true },
      )
      .select('region');
    const fresh = new Set((claimed ?? []).map((c) => c.region as string));
    if (!fresh.size) continue;
    typhoons++;
    const to = (subs ?? []).filter((s) => (s.regions.length ? s.regions.some((r: string) => fresh.has(r)) : fresh.has('*')));
    const names = near.map((c) => REGIONS[c].name);
    const where = names.length > 3 ? `${names.slice(0, 3).join(', ')} and more` : names.join(', ');
    await send(to, { id: `gt-${h.id}`, title: h.title, body: `Coming near ${where}. ${h.detail}`.slice(0, 180), url: '/guest/news' });
  }

  if (gone.size) await db.from('guest_push_subscriptions').delete().in('id', [...gone]);
  return Response.json({ sent, announcements, typhoons, removed: gone.size }, { headers: cors });
});
