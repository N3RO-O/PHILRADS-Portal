// Sends new bell notifications to staff phones (Web Push).
//
// Called by the portal right after something puts a note in someone's bell (a task given, a
// nudge, an accept or decline). It sends every note from the last 15 minutes that hasn't been
// pushed yet, to each device its recipient turned phone notifications on for, then marks it
// pushed. Devices that no longer exist (404/410) are removed.
//
// Secrets (Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Only signed-in portal users can call it: the function checks the caller's session itself
// ("Verify JWT with legacy secret" is off, so it works with the project's current signing keys).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv) return Response.json({ error: 'Phone notifications are not set up yet.' }, { status: 503, headers: cors });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'https://philrads-portal.vercel.app', pub, priv);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: caller } = bearer ? await db.auth.getUser(bearer) : { data: { user: null } };
  if (!caller?.user) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: cors });
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: notes, error } = await db
    .from('notifications')
    .select('id, recipient_id, title, body, link_path')
    .is('pushed_at', null)
    .gte('created_at', since)
    .order('created_at')
    .limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
  if (!notes?.length) return Response.json({ sent: 0 }, { headers: cors });

  // Mark them first, so two calls at once don't send the same note twice.
  const ids = notes.map((n) => n.id);
  const { data: claimed } = await db.from('notifications').update({ pushed_at: new Date().toISOString() }).in('id', ids).is('pushed_at', null).select('id');
  const mine = new Set((claimed ?? []).map((c) => c.id));
  const toSend = notes.filter((n) => mine.has(n.id));

  const recipients = [...new Set(toSend.map((n) => n.recipient_id))];
  const { data: subs } = await db.from('push_subscriptions').select('id, profile_id, endpoint, p256dh, auth').in('profile_id', recipients);
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    toSend.flatMap((n) =>
      (subs ?? [])
        .filter((s) => s.profile_id === n.recipient_id)
        .map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ id: n.id, title: n.title, body: n.body ?? '', url: n.link_path ?? '/' }),
              { TTL: 60 * 60 * 12, urgency: 'high' },
            );
            sent++;
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) gone.push(s.id);
          }
        }),
    ),
  );
  if (gone.length) await db.from('push_subscriptions').delete().in('id', gone);
  return Response.json({ sent, notes: toSend.length }, { headers: cors });
});
