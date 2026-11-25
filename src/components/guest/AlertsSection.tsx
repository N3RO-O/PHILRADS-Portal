import { useEffect, useState } from 'react';
import { BellOff, BellRing, Check } from 'lucide-react';
import { guestService } from '../../services';
import { keyBytes, pushSupported, VAPID_PUBLIC_KEY } from '../../lib/push';
import { ALERT_RADIUS_KM, REGIONS, regionName } from '../../services/guest/regions';
import { BusyLabel } from '../ui/BusyLabel';
import { GuestSection } from './guestUi';

const KEY = 'philrads.guest.alerts.v1';
interface Saved {
  on: boolean;
  regions: string[];
}
function readSaved(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    return { on: Boolean(v?.on), regions: Array.isArray(v?.regions) ? v!.regions.filter((r) => REGIONS.some((x) => x.code === r)) : [] };
  } catch {
    return { on: false, regions: [] };
  }
}
function writeSaved(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private browsing */
  }
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !('standalone' in navigator && (navigator as { standalone?: boolean }).standalone);

/** The service worker that receives alerts; null when this browser has none (yet). */
async function worker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const now = await navigator.serviceWorker.getRegistration();
  if (now) return now;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
}

/**
 * Alerts: phone notifications for PHILRADS's urgent announcements, and for typhoons coming near
 * the regions a guest follows. No account; the phone's subscription and its regions are all that
 * is stored, and turning alerts off removes them.
 */
export function AlertsSection() {
  const [saved, setSaved] = useState(readSaved);
  const [regions, setRegions] = useState<string[]>(saved.regions);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      if (!pushSupported() || Notification.permission !== 'granted') return live && setOn(false);
      const reg = await worker();
      const sub = await reg?.pushManager.getSubscription();
      if (live) setOn(Boolean(sub) && saved.on);
    })();
    return () => {
      live = false;
    };
  }, [saved.on]);

  const changed = on && [...regions].sort().join() !== [...saved.regions].sort().join();
  const toggle = (code: string) => setRegions((r) => (r.includes(code) ? r.filter((x) => x !== code) : [...r, code]));

  const subscribe = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (!pushSupported()) throw new Error(isIos() ? 'On iPhone, add PRISM to your Home Screen first (Share, then Add to Home Screen), and open it from there.' : 'This browser can’t show alerts. Try Chrome or Safari.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Alerts are blocked for this site. Allow notifications in your browser’s site settings, then try again.');
      const reg = await worker();
      if (!reg) throw new Error('Alerts work on the live site, once PRISM has loaded fully. Reload the page and try again.');
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
      const json = sub.toJSON();
      await guestService.alertSubscribe({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '', regions });
      const next = { on: true, regions };
      writeSaved(next);
      setSaved(next);
      setOn(true);
      setMsg({ ok: true, text: changed ? 'Saved. You’ll get alerts for the regions you chose.' : 'Alerts are on for this phone.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not turn on alerts.' });
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await worker();
      const sub = await reg?.pushManager.getSubscription();
      // Only the guest alerts stop: a staff member's portal notifications on this phone keep working.
      if (sub) await guestService.alertUnsubscribe(sub.endpoint);
      const next = { on: false, regions };
      writeSaved(next);
      setSaved(next);
      setOn(false);
      setMsg({ ok: true, text: 'Alerts are off. Nothing about this phone is kept.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not turn off alerts.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <GuestSection id="alerts" title="Alerts" lead={`Urgent news, and typhoons within ${ALERT_RADIUS_KM} km of where you follow.`}>
      <div className="flex flex-col gap-6">
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors duration-300 ${on ? 'border-status-in/40 bg-status-in/10' : 'border-line bg-surface'}`}>
          {on ? <BellRing className="h-5 w-5 shrink-0 text-status-in" aria-hidden /> : <BellOff className="h-5 w-5 shrink-0 text-muted" aria-hidden />}
          <p className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold text-ink">{on === null ? 'Checking this phone…' : on ? 'Alerts are on' : 'Alerts are off'}</span>
            {on && <span className="block text-xs text-ink-soft">{saved.regions.length ? `Typhoons near ${saved.regions.map(regionName).join(', ')}` : 'Typhoons anywhere in the Philippines'}, and urgent PHILRADS news.</span>}
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">Regions to follow</legend>
          <p className="mt-0.5 text-xs text-muted">Choose none to follow the whole country.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="chip min-h-9" aria-pressed={regions.length === 0} onClick={() => setRegions([])}>
              Whole country
            </button>
            {REGIONS.map((r) => (
              <button key={r.code} type="button" className="chip min-h-9" aria-pressed={regions.includes(r.code)} onClick={() => toggle(r.code)}>
                {r.name}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          {!on ? (
            <button type="button" className="btn-primary" onClick={subscribe} disabled={busy || on === null}>
              <BellRing className="h-4 w-4" aria-hidden />
              <BusyLabel busy={busy} busyText="Turning on…">
                Turn on alerts
              </BusyLabel>
            </button>
          ) : (
            <>
              {changed && (
                <button type="button" className="btn-primary" onClick={subscribe} disabled={busy}>
                  <Check className="h-4 w-4" aria-hidden />
                  <BusyLabel busy={busy} busyText="Saving…">
                    Save regions
                  </BusyLabel>
                </button>
              )}
              <button type="button" className="chip min-h-10 gap-1.5" onClick={unsubscribe} disabled={busy}>
                <BellOff className="h-4 w-4" aria-hidden /> Turn off alerts
              </button>
            </>
          )}
        </div>
        {msg && (
          <p role="status" className={`text-sm ${msg.ok ? 'text-status-in' : 'text-status-out'}`}>
            {msg.text}
          </p>
        )}
        <p className="text-xs text-muted">
          No sign-up and no name: only this phone’s alert address and your regions are kept, until you turn alerts off. Alerts don’t replace official warnings: always follow PAGASA and your local officials.
        </p>
      </div>
    </GuestSection>
  );
}
