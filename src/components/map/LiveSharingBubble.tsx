import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Loader2, Map as MapIcon, Square, Sun, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GOOD_M, ROUGH_M } from '../../lib/geo';
import { formatTime } from '../../lib/format';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../ui/Avatar';
import { useLiveSharing } from './LiveSharing';

const SIZE = 56;
const EDGE = 12;
const STORE = 'philrads.live.bubble';

type Spot = { side: 'left' | 'right'; y: number };
const readSpot = (): Spot => {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Spot | null;
    if (s && (s.side === 'left' || s.side === 'right') && typeof s.y === 'number') return s;
  } catch {
    /* first time */
  }
  return { side: 'right', y: 0.62 };
};

const ago = (iso: string | null, now: number) => {
  if (!iso) return 'Not sent yet';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 5 ? 'Sent just now' : s < 60 ? `Sent ${s} s ago` : `Sent ${Math.round(s / 60)} min ago`;
};

/**
 * While sharing a live location: a bubble that floats over every page (like a chat head), with
 * your picture in a pulsing ring. Drag it to either edge; tap it for the details and Stop.
 * Green while sending, amber while paused (the portal isn't on screen).
 */
export function LiveSharingBubble() {
  const live = useLiveSharing();
  const { profile } = useAuth();
  const [spot, setSpot] = useState<Spot>(readSpot);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [now, setNow] = useState(Date.now());
  const start = useRef<{ px: number; py: number; moved: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(window.innerHeight);
  const [vw, setVw] = useState(window.innerWidth);

  useEffect(() => {
    const on = () => (setVh(window.innerHeight), setVw(window.innerWidth));
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    const away = (e: globalThis.PointerEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => (clearInterval(t), document.removeEventListener('pointerdown', away), document.removeEventListener('keydown', esc));
  }, [open]);

  if (live.status === 'off' || live.status === 'starting' || !live.until || !profile) return null;

  const paused = live.status === 'paused';
  const top = Math.min(vh - SIZE - EDGE - 72, Math.max(EDGE + 64, spot.y * vh));
  const left = drag ? drag.x - SIZE / 2 : spot.side === 'left' ? EDGE : vw - SIZE - EDGE;
  const y = drag ? drag.y - SIZE / 2 : top;

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, moved: false };
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.px, e.clientY - s.py) < 6) return;
    s.moved = true;
    setOpen(false);
    setDrag({ x: e.clientX, y: e.clientY });
  };
  const onUp = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    start.current = null;
    if (!s?.moved) return setOpen((o) => !o);
    // Let go: it sticks to the nearer edge, at that height.
    const next: Spot = { side: e.clientX < vw / 2 ? 'left' : 'right', y: Math.min(0.9, Math.max(0.05, (e.clientY - SIZE / 2) / vh)) };
    setDrag(null);
    setSpot(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* not remembered */
    }
  };

  const acc = live.accuracyM;
  const gps =
    paused ? 'Paused: open the portal to keep sharing' : acc == null ? 'Finding GPS…' : acc > ROUGH_M ? 'Waiting for GPS: move outside or near a window' : acc > GOOD_M * 2 ? `Weak GPS (±${acc} m)` : `GPS accurate to ±${acc} m`;

  return (
    <div ref={wrap} className="pointer-events-none fixed inset-0 z-[1200]" aria-live="polite">
      <button
        type="button"
        aria-label={`Sharing your live location until ${formatTime(live.until)}${paused ? ' (paused)' : ''}. Tap for details, drag to move.`}
        aria-expanded={open}
        className={`pointer-events-auto absolute touch-none select-none rounded-full ${drag ? 'scale-110 cursor-grabbing' : 'cursor-grab transition-[left,top,transform] duration-300'}`}
        style={{ left, top: y, width: SIZE, height: SIZE }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => ((start.current = null), setDrag(null))}
      >
        <span className={`absolute -inset-1 rounded-full ${paused ? 'bg-status-low/40' : 'animate-ping bg-status-in/40'}`} aria-hidden />
        <span className={`relative block rounded-full p-[3px] shadow-[0_10px_30px_-6px_rgba(0,0,0,0.7)] ${paused ? 'bg-status-low' : 'bg-status-in'}`}>
          <Avatar initials={profile.initials} src={profile.avatar} color={profile.avatarColor} size="lg" ring="ring-2 ring-page" />
        </span>
        <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[0.5625rem] font-bold tracking-wider text-page ${paused ? 'bg-status-low' : 'bg-status-in'}`} aria-hidden>
          {paused ? 'PAUSED' : 'LIVE'}
        </span>
      </button>

      {open && !drag && (
        <div
          role="dialog"
          aria-label="Live location sharing"
          className={`popover pointer-events-auto absolute w-72 animate-pop-in p-4 ${spot.side === 'left' ? 'origin-top-left' : 'origin-top-right'}`}
          style={{
            top: Math.min(vh - 260, Math.max(EDGE, top - 8)),
            ...(spot.side === 'left' ? { left: EDGE + SIZE + 10 } : { right: EDGE + SIZE + 10 }),
          }}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">Sharing your live location</p>
              <p className="text-xs text-ink-soft">Until {formatTime(live.until)}</p>
            </div>
            <button type="button" className="icon-btn -m-1.5 h-8 w-8" aria-label="Close" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className={`mt-3 text-xs ${paused || (acc != null && acc > GOOD_M * 2) ? 'text-status-low' : 'text-status-in'}`}>{gps}</p>
          <p className="text-xs text-muted">{ago(live.lastSentAt, now)}</p>
          {live.error && <p className="mt-2 text-xs text-status-out">{live.error}</p>}

          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl bg-surface-sunken px-3 py-2.5">
            <Sun className="h-4 w-4 shrink-0 text-uplift" aria-hidden />
            <span className="min-w-0 flex-1 text-sm">Keep screen on</span>
            <input type="checkbox" className="h-5 w-5 accent-uplift" checked={live.keepAwake} onChange={(e) => live.setKeepAwake(e.target.checked)} />
          </label>

          <div className="mt-3 flex gap-2">
            <Link to="/live-map" className="btn-ghost min-h-10 flex-1 px-3 text-sm" onClick={() => setOpen(false)}>
              <MapIcon className="h-4 w-4" aria-hidden /> Map
            </Link>
            <button
              type="button"
              className="btn min-h-10 flex-1 bg-status-out px-3 text-sm text-white hover:brightness-110"
              disabled={stopping}
              onClick={async () => {
                setStopping(true);
                await live.stop();
                setStopping(false);
                setOpen(false);
              }}
            >
              {stopping ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Square className="h-3.5 w-3.5 fill-current" aria-hidden />} Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
