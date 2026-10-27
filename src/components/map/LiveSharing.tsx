import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Loader2, Radio, ShieldCheck, Square } from 'lucide-react';
import { currentPosition, distanceM, GOOD_M, ROUGH_M } from '../../lib/geo';
import { formatTime, manilaDayKey } from '../../lib/format';
import { mapService } from '../../services';
import type { LiveFix } from '../../services/map/types';
import { useAuth } from '../auth/AuthProvider';

/** How long to share: a number of hours, or until the end of today (Manila time). */
export type ShareFor = 1 | 4 | 'eod';
export const SHARE_CHOICES: { value: ShareFor; label: string }[] = [
  { value: 1, label: '1 hour' },
  { value: 4, label: '4 hours' },
  { value: 'eod', label: 'Until end of day' },
];

const untilFor = (choice: ShareFor): string => {
  if (choice !== 'eod') return new Date(Date.now() + choice * 3600_000).toISOString();
  // 11:59 PM today in Manila (UTC+8, no daylight saving).
  const end = new Date(`${manilaDayKey(new Date().toISOString())}T23:59:00+08:00`);
  return (end.getTime() - Date.now() < 15 * 60_000 ? new Date(Date.now() + 3600_000) : end).toISOString();
};

type Status = 'off' | 'starting' | 'live' | 'paused';
interface LiveSharingValue {
  canShare: boolean;
  status: Status;
  until: string | null;
  lastSentAt: string | null;
  /** The latest GPS reading's accuracy in metres (null before the first). */
  accuracyM: number | null;
  error: string | null;
  start(choice: ShareFor): Promise<boolean>;
  stop(): Promise<void>;
}

const LiveSharingContext = createContext<LiveSharingValue | null>(null);
const key = (uid: string) => `philrads.live.until.${uid}`;
const MIN_GAP_MS = 10_000;
const MAX_GAP_MS = 30_000;
const MIN_MOVE_M = 10;
/** Faster than this (m/s, beyond both readings' error) is a GPS glitch, not travel: about 160 km/h. */
const GLITCH_SPEED = 45;
/** How long the last good position stands before a rougher one may replace it. */
const KEEP_GOOD_MS = 120_000;

type Sent = { fix: LiveFix; at: number };

/**
 * Whether to send this GPS reading. Phones mix rough cell-tower/Wi-Fi positions (hundreds of metres
 * off) with real GPS ones, and now and then jump somewhere far for a moment; sending every reading
 * made pins leap away from where people really were. So:
 * - readings rougher than ROUGH_M are never sent (unless nothing better has come for 2 minutes);
 * - a much rougher reading doesn't replace a good recent one;
 * - an impossible jump (faster than ~160 km/h beyond both readings' error) is ignored, unless the
 *   new reading is clearly more accurate (then it corrects the old one);
 * - moving less than the reading's own error isn't moving: the pin stays put (a heartbeat still
 *   goes every 30 s so the team sees it's live).
 */
export function judgeFix(prev: Sent | null, fix: LiveFix, now: number, fresh = false): boolean {
  const acc = fix.accuracyM ?? ROUGH_M;
  if (!prev) return acc <= ROUGH_M;
  const dt = now - prev.at;
  const prevAcc = prev.fix.accuracyM ?? ROUGH_M;
  const clearlyBetter = acc <= GOOD_M && acc < prevAcc / 2;
  if (acc > ROUGH_M && dt < KEEP_GOOD_MS) return false;
  if (acc > Math.max(GOOD_M, prevAcc * 2) && dt < KEEP_GOOD_MS) return false;
  const d = distanceM(prev.fix, fix);
  const realMove = d - acc - prevAcc;
  if (!clearlyBetter && realMove > 0 && realMove / Math.max(1, dt / 1000) > GLITCH_SPEED) return false;
  if (clearlyBetter) return true;
  if (!fresh && dt < MIN_GAP_MS) return false;
  const still = d < Math.max(MIN_MOVE_M, Math.min(acc, prevAcc));
  return !(still && dt < MAX_GAP_MS);
}

/**
 * "Share my live location": off until the person turns it on, for a time they choose.
 * While on and the portal is open on screen, the phone's GPS position is sent every few
 * seconds when moving (at least every 30 s), and everyone's map updates in real time.
 * Hidden or closed portal: sharing pauses (browsers don't allow GPS in the background).
 * It stops on its own at the chosen time, and survives a reload until then.
 */
export function LiveSharingProvider({ children }: { children: ReactNode }) {
  const { state: auth, can } = useAuth();
  const uid = auth.status === 'signed-in' ? auth.session.user.id : auth.status === 'demo' ? 'demo' : null;
  const canShare = can('map.checkin');
  const [until, setUntil] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('off');
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const last = useRef<Sent | null>(null);
  /** Back on screen after a pause: send the next good reading straight away. */
  const fresh = useRef(true);
  const untilRef = useRef(until);
  untilRef.current = until;

  // Resume after a reload, until the chosen time.
  useEffect(() => {
    if (!uid) return;
    try {
      const saved = localStorage.getItem(key(uid));
      if (saved && Date.parse(saved) > Date.now()) {
        setUntil(saved);
        setStatus('live');
      } else if (saved) localStorage.removeItem(key(uid));
    } catch {
      /* storage unavailable: sharing doesn't survive a reload */
    }
  }, [uid]);

  const stop = useCallback(async () => {
    setUntil(null);
    setStatus('off');
    last.current = null;
    setAccuracyM(null);
    try {
      if (uid) localStorage.removeItem(key(uid));
    } catch {
      /* nothing saved */
    }
    await mapService.stopLive().catch(() => undefined);
  }, [uid]);

  const send = useCallback(async (fix: LiveFix) => {
    const u = untilRef.current;
    if (!u) return;
    setAccuracyM(fix.accuracyM);
    const now = Date.now();
    if (!judgeFix(last.current, fix, now, fresh.current)) return;
    fresh.current = false;
    last.current = { fix, at: now };
    try {
      await mapService.shareLive(fix, u);
      setLastSentAt(new Date().toISOString());
      setError(null);
    } catch {
      setError('Couldn’t send your position. It will try again with the next GPS reading.');
    }
  }, []);

  const start = useCallback(
    async (choice: ShareFor) => {
      if (!uid || !canShare) return false;
      setError(null);
      setStatus('starting');
      const r = await currentPosition({ goodM: 30, waitMs: 10_000 });
      if (!r.ok) {
        setStatus('off');
        setError(r.reason);
        return false;
      }
      const u = untilFor(choice);
      setUntil(u);
      untilRef.current = u;
      try {
        localStorage.setItem(key(uid), u);
      } catch {
        /* keeps sharing until reload */
      }
      last.current = null;
      fresh.current = true;
      // A rough first reading isn't sent: the pin appears once GPS gives a good one.
      await send({ lat: r.lat, lng: r.lng, accuracyM: r.accuracyM, heading: null, speedMps: null });
      setStatus('live');
      return true;
    },
    [uid, canShare, send],
  );

  // While sharing: watch GPS when the portal is on screen; pause when it isn't; stop at the chosen time.
  useEffect(() => {
    if (!until || status === 'off' || status === 'starting') return;
    const ms = Date.parse(until) - Date.now();
    if (ms <= 0) {
      void stop();
      return;
    }
    const timer = setTimeout(() => void stop(), ms);
    let watch: number | null = null;
    const begin = () => {
      if (watch != null || !('geolocation' in navigator)) return;
      setStatus('live');
      watch = navigator.geolocation.watchPosition(
        (p) =>
          void send(
            {
              lat: p.coords.latitude,
              lng: p.coords.longitude,
              accuracyM: Math.round(p.coords.accuracy),
              heading: p.coords.heading == null || Number.isNaN(p.coords.heading) ? null : Math.round(p.coords.heading),
              speedMps: p.coords.speed == null || Number.isNaN(p.coords.speed) ? null : Math.round(p.coords.speed * 10) / 10,
            },
          ),
        (e) => {
          if (e.code === e.PERMISSION_DENIED) {
            setError('Location is blocked for this site, so sharing stopped. Allow it in your browser’s site settings to share again.');
            void stop();
          }
        },
        // Fresh readings only: a cached one can be from somewhere else.
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
      );
    };
    const end = () => {
      if (watch != null) navigator.geolocation.clearWatch(watch);
      watch = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fresh.current = true; // send the next good reading straight away when coming back
        begin();
      } else {
        end();
        setStatus('paused');
      }
    };
    if (document.visibilityState === 'visible') begin();
    else setStatus('paused');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      end();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // status is read only to skip the 'off'/'starting' states
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until, status === 'off' || status === 'starting', send, stop]);

  const value = useMemo<LiveSharingValue>(
    () => ({ canShare, status, until, lastSentAt, accuracyM, error, start, stop }),
    [canShare, status, until, lastSentAt, accuracyM, error, start, stop],
  );
  return <LiveSharingContext.Provider value={value}>{children}</LiveSharingContext.Provider>;
}

export function useLiveSharing(): LiveSharingValue {
  const ctx = useContext(LiveSharingContext);
  if (!ctx) throw new Error('useLiveSharing must be used inside <LiveSharingProvider>');
  return ctx;
}

/** Shown on every page while sharing: what's happening, until when, and Stop. */
export function LiveSharingBanner() {
  const live = useLiveSharing();
  const [stopping, setStopping] = useState(false);
  if (live.status === 'off' || live.status === 'starting' || !live.until) return null;
  return (
    <div role="status" className="flex items-center gap-3 border-t border-status-in/30 bg-status-in/[0.12] px-4 py-2 text-sm sm:px-6">
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-in opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-in" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <strong className="font-semibold text-ink">Sharing your live location</strong>{' '}
        <span className="text-ink-soft">until {formatTime(live.until)}</span>
        {live.accuracyM != null && live.status === 'live' && (
          <span className={`block text-xs ${live.accuracyM > GOOD_M * 2 ? 'text-status-low' : 'text-muted'}`}>
            {live.accuracyM > ROUGH_M
              ? 'Waiting for GPS: move outside or near a window. Your pin stays where it last was accurate.'
              : live.accuracyM > GOOD_M * 2
                ? `Weak GPS (±${live.accuracyM} m): move outside or near a window for a sharper pin.`
                : `GPS accurate to ±${live.accuracyM} m`}
          </span>
        )}
      </span>
      <button
        type="button"
        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-3 text-xs font-semibold text-ink hover:bg-surface"
        disabled={stopping}
        onClick={async () => {
          setStopping(true);
          await live.stop();
          setStopping(false);
        }}
      >
        {stopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Square className="h-3 w-3 fill-current" aria-hidden />} Stop
      </button>
    </div>
  );
}

/** The switch: off by default; turning it on asks how long, then starts. */
export function LiveShareCard() {
  const live = useLiveSharing();
  const [choosing, setChoosing] = useState(false);
  const [choice, setChoice] = useState<ShareFor>(1);
  const on = live.status !== 'off';
  if (!live.canShare) return null;

  return (
    <section className={`rounded-2xl border p-4 ${on ? 'border-status-in/40 bg-status-in/[0.07]' : 'border-line/70 bg-white/[0.02]'}`} aria-labelledby="live-share-title">
      <div className="flex items-center gap-3">
        <span className={`icon-chip h-10 w-10 ${on ? '' : 'opacity-80'}`} aria-hidden>
          <Radio className={`h-5 w-5 ${on ? 'text-status-in' : 'text-uplift'}`} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="live-share-title" className="text-sm font-semibold">
            Share my live location
          </h3>
          <p className="text-xs text-muted">
            {on && live.until ? (live.status === 'paused' ? `Paused while the portal isn’t open · until ${formatTime(live.until)}` : `On · until ${formatTime(live.until)}`) : 'Off. Your pin moves on the team’s map while it’s on.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on || choosing}
          aria-labelledby="live-share-title"
          disabled={live.status === 'starting'}
          onClick={() => (on ? void live.stop() : setChoosing((c) => !c))}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors after:absolute after:-inset-2.5 after:content-[''] ${on || choosing ? 'border-status-in bg-status-in/80' : 'border-line bg-surface-raised'}`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on || choosing ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {!on && choosing && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-ink-soft">For how long?</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Share for">
            {SHARE_CHOICES.map((c) => (
              <button
                key={String(c.value)}
                type="button"
                role="radio"
                aria-checked={choice === c.value}
                onClick={() => setChoice(c.value)}
                className={`tap min-h-11 rounded-xl border px-2 text-xs font-semibold leading-tight transition-colors ${choice === c.value ? 'border-uplift bg-uplift/10 text-ink' : 'border-line/70 text-ink-soft hover:border-ink-mute'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary min-h-11"
            disabled={live.status === 'starting'}
            onClick={async () => {
              if (await live.start(choice)) setChoosing(false);
            }}
          >
            {live.status === 'starting' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Radio className="h-4 w-4" aria-hidden />}
            {live.status === 'starting' ? 'Finding you…' : 'Start sharing'}
          </button>
          <p className="flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
            PHILRADS staff see your pin move while the portal is open on your phone. It stops by itself at the time you choose, or when you tap Stop.
          </p>
        </div>
      )}
      {live.error && (
        <p role="alert" className="mt-3 rounded-xl border border-status-out/40 bg-status-out/10 px-3 py-2 text-xs">
          {live.error}
        </p>
      )}
    </section>
  );
}
