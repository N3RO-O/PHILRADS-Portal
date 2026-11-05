import { useEffect, useRef, useState } from 'react';
import { Coffee, X } from 'lucide-react';
import { markActive } from '../../lib/idle';
import { usePresence } from '../../lib/presence';

/** Working this long without a 10-minute pause suggests a break. */
const WORK_MS = 90 * 60_000;
/** A pause this long counts as a break (the clock starts again). */
const RESET_MS = 10 * 60_000;
const SNOOZE_MS = 30 * 60_000;
const BREAK_S = 5 * 60;
const KEY = 'philrads.break';

const TIPS = [
  'Stand up and stretch your shoulders and back.',
  'Drink a glass of water.',
  'Look at something far away for 20 seconds: it rests your eyes.',
  'Take a short walk, even just to the window.',
  'Roll your neck slowly, left then right.',
  'Breathe in for 4, hold for 4, breathe out for 4.',
];

interface Stored {
  start: number;
  last: number;
  snoozeUntil: number;
}
const read = (): Stored => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null;
    if (v) return v;
  } catch {
    /* fresh */
  }
  const now = Date.now();
  return { start: now, last: now, snoozeUntil: 0 };
};
const write = (s: Stored) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* this visit only */
  }
};

/**
 * Suggests a short break after about 90 minutes of steady work (any pause of 10 minutes resets
 * the clock). "Take 5 minutes" opens a calm breathing timer with a tip; "Later" asks again in 30
 * minutes. Quiet while Do Not Disturb is on.
 */
export function BreakNudge() {
  const { mine } = usePresence();
  const [ask, setAsk] = useState(false);
  const [breakLeft, setBreakLeft] = useState<number | null>(null);
  const [tip, setTip] = useState(0);
  const state = useRef<Stored>(read());

  // Count working time from activity.
  useEffect(() => {
    let written = 0;
    const touch = () => {
      const now = Date.now();
      const s = state.current;
      if (now - s.last > RESET_MS) s.start = now; // a real pause: start over
      s.last = now;
      if (now - written > 15_000) {
        written = now;
        write(s);
      }
    };
    const check = () => {
      const s = state.current;
      const now = Date.now();
      if (now - s.last > RESET_MS) return; // away: no nudge
      if (now - s.start >= WORK_MS && now >= s.snoozeUntil) setAsk(true);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    const t = setInterval(check, 60_000);
    // For trying it out: ?break=now shows the suggestion straight away.
    if (new URLSearchParams(location.search).get('break') === 'now') setAsk(true);
    return () => {
      for (const e of events) window.removeEventListener(e, touch);
      clearInterval(t);
    };
  }, []);

  // The break's countdown.
  useEffect(() => {
    if (breakLeft === null) return;
    if (breakLeft <= 0) return;
    const t = setTimeout(() => setBreakLeft((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [breakLeft]);
  useEffect(() => {
    if (breakLeft === null) return;
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 12_000);
    return () => clearInterval(t);
  }, [breakLeft === null]);

  const later = () => {
    state.current.snoozeUntil = Date.now() + SNOOZE_MS;
    write(state.current);
    setAsk(false);
  };
  const startBreak = () => {
    setAsk(false);
    setTip(Math.floor(Math.random() * TIPS.length));
    setBreakLeft(BREAK_S);
  };
  const back = () => {
    const now = Date.now();
    state.current = { start: now, last: now, snoozeUntil: 0 };
    write(state.current);
    markActive(now);
    setBreakLeft(null);
  };

  if (breakLeft !== null) {
    const mm = Math.floor(Math.max(0, breakLeft) / 60);
    const ss = String(Math.max(0, breakLeft) % 60).padStart(2, '0');
    const over = breakLeft <= 0;
    return (
      <div role="dialog" aria-modal="true" aria-label="Break time" className="fixed inset-0 z-[1250] flex animate-fade-in flex-col items-center justify-center gap-8 bg-page px-6 text-center backdrop-blur-2xl">
        <div className="relative grid h-56 w-56 place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-status-in/15 animate-[breathe_8s_ease-in-out_infinite]" />
          <span aria-hidden className="absolute inset-6 rounded-full bg-status-in/20 animate-[breathe_8s_ease-in-out_infinite_200ms]" />
          <span className="relative font-display text-5xl tabular-nums tracking-wide text-ink">
            {mm}:{ss}
          </span>
        </div>
        <div className="relative max-w-sm">
          <p className="text-xl font-semibold text-ink">{over ? 'Break’s done. Welcome back!' : 'Breathe in as the circle grows, out as it shrinks.'}</p>
          <p key={tip} className="mt-3 animate-fade-up text-sm text-muted">
            {TIPS[tip]}
          </p>
        </div>
        <button type="button" className="btn-primary relative min-h-12 px-8 text-base" onClick={back} autoFocus>
          I’m back
        </button>
      </div>
    );
  }

  if (!ask || mine === 'dnd') return null;
  const mins = Math.max(90, Math.round((Date.now() - state.current.start) / 60_000));
  return (
    <div role="status" className="toast-in fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-[1150] mx-auto max-w-sm rounded-2xl border border-status-in/40 bg-surface-raised p-4 shadow-2xl shadow-black/60">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-status-in/15 text-status-in">
          <Coffee className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Time for a short break?</p>
          <p className="mt-0.5 text-xs text-muted">
            You’ve been at it for {mins >= 120 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} minutes`}. Five minutes away helps you stay sharp.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary min-h-9 px-4 text-xs" onClick={startBreak}>
              Take 5 minutes
            </button>
            <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={later}>
              Later
            </button>
          </div>
        </div>
        <button type="button" className="icon-btn -mr-1 -mt-1 h-8 w-8" onClick={later} aria-label="Not now">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
