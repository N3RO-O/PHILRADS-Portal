import { supabase } from './supabase';

/**
 * Phone notifications (Web Push): this device subscribes with the portal's public key and the
 * subscription is saved for the signed-in person. The "push-notifications" Edge Function sends
 * new bell notes to every device a person has turned this on for.
 * iPhone and iPad: only when the portal is installed on the Home Screen (iOS 16.4 and later).
 */
export const VAPID_PUBLIC_KEY = 'BMc7RW_pphDRPKfy2OBA-kfp3i8aS3xiYuuY2f3T5dy6q4eFe8HrohZcncY1ZueGvRlJJTIDYwDEdWvwulEVL8s';

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const keyBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(await reg?.pushManager.getSubscription());
}

/** Ask for permission, subscribe this device and save it. Returns an error message, or null. */
export async function enablePush(): Promise<string | null> {
  if (!pushSupported()) return 'This browser can’t show phone notifications. On iPhone, add the portal to your Home Screen first.';
  if (!supabase) return 'Phone notifications work once you’re signed in to the live portal.';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'Notifications are blocked for this site. Allow them in your browser’s site settings.';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    const json = sub.toJSON();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, device: navigator.userAgent.slice(0, 120) }, { onConflict: 'endpoint' });
    if (error) throw error;
    return null;
  } catch (e) {
    console.error('[push] subscribe', e);
    return 'Couldn’t turn on phone notifications. Check the connection and try again.';
  }
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/**
 * Something just put a note in someone's bell (a task given, a nudge, an answer): ask the Edge
 * Function to send the waiting ones to phones now. Never blocks or fails what the person did.
 */
export function flushPush() {
  if (!supabase) return;
  void supabase.functions.invoke('push-notifications', { body: {} }).catch(() => undefined);
}
