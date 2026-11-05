import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useBackdropClose } from '../ui/Sheet';
import { welcome } from '../../lib/welcome';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// Confetti in the PRISM colours (the three rays, plus cream), a few pieces at set places so it looks the same each time.
const CONFETTI = [
  [6, 0, '#e0524a'], [14, 0.12, '#ec952a'], [22, 0.3, '#f6cf7e'], [31, 0.05, '#fbf2f2'], [39, 0.22, '#e0524a'],
  [47, 0.4, '#ec952a'], [55, 0.1, '#f6cf7e'], [63, 0.28, '#e0524a'], [71, 0.02, '#fbf2f2'], [79, 0.35, '#ec952a'],
  [86, 0.16, '#f6cf7e'], [93, 0.25, '#e0524a'],
] as const;

function manilaNow() {
  const at = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const h = at.getHours();
  return {
    greeting: h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening',
    stamp: `${MONTHS[at.getMonth()]} ${String(at.getDate()).padStart(2, '0')} ${at.getFullYear()}`,
    time: `${((h + 11) % 12) + 1}:${String(at.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`,
  };
}

/** Right after signing in: a little dance, a hello, and on with the day. Once per sign-in. */
export function Welcomer() {
  const { profile } = useAuth();
  const [show] = useState(() => welcome.pending());
  const ref = useRef<HTMLDialogElement>(null);
  const [now] = useState(manilaNow);
  const close = () => {
    welcome.done();
    ref.current?.close();
  };
  const backdrop = useBackdropClose(ref, close);

  useEffect(() => {
    if (!show) return;
    // Let the page draw first, then say hello.
    const t = setTimeout(() => {
      const el = ref.current;
      if (el && !el.open) el.showModal();
    }, 450);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;
  const first = profile?.displayName?.trim().split(/\s+/)[0];

  return (
    <dialog
      ref={ref}
      aria-labelledby="welcome-title"
      aria-describedby="welcome-body"
      onClose={() => welcome.done()}
      {...backdrop.handlers}
      className="popover max-h-[calc(100dvh-1.5rem)] w-[min(26rem,calc(100vw-2rem))] animate-pop-in overflow-y-auto overflow-x-hidden p-0 text-ink backdrop:animate-fade-in backdrop:bg-black/70 backdrop:backdrop-blur-[2px]"
    >
      {/* The clip, as if from an old home video: REC light, the date and time in the corner, faint scan lines. */}
      <div className="welcome-tape relative aspect-[4/3] max-h-[48dvh] min-h-[13rem] w-full overflow-hidden bg-[#111] bg-cover bg-center" style={{ backgroundImage: 'url(/media/welcome-dance-still.webp)' }}>
        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcSet="/media/welcome-dance-still.webp" />
          <img src="/media/welcome-dance.webp" alt="A kid in sunglasses dancing" width={400} height={300} className="h-full w-full object-cover" />
        </picture>
        <span aria-hidden className="welcome-scan pointer-events-none absolute inset-0" />
        <span aria-hidden className="absolute left-3 top-2.5 flex items-center gap-1.5 font-mono text-[0.6875rem] font-bold tracking-widest text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          <span className="welcome-rec h-2 w-2 rounded-full bg-[#ff3b30]" /> REC
        </span>
        <span aria-hidden className="absolute right-3 top-2.5 text-right font-mono text-[0.6875rem] font-bold leading-tight tracking-widest text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          {now.time}
          <br />
          {now.stamp}
        </span>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[#f6b65e] [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">{now.greeting}</p>
          <h2 id="welcome-title" className="welcome-title mt-1 text-[1.75rem] font-bold leading-[1.1] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)]">
            Good to have you here{first ? `, ${first}` : ''}!
          </h2>
        </div>
        <span aria-hidden className="welcome-confetti pointer-events-none absolute inset-0">
          {CONFETTI.map(([left, delay, color], i) => (
            <i key={i} style={{ left: `${left}%`, animationDelay: `${delay}s`, background: color }} />
          ))}
        </span>
      </div>
      {/* The PRISM rays, as a thin band under the picture. */}
      <div aria-hidden className="flex h-1">
        <span className="flex-1 bg-[rgb(var(--prism-1))]" />
        <span className="flex-1 bg-[rgb(var(--prism-2))]" />
        <span className="flex-1 bg-[rgb(var(--prism-3))]" />
      </div>

      <div className="flex flex-col gap-4 px-6 pb-5 pt-5">
        <p id="welcome-body" className="text-sm leading-relaxed text-ink-soft">
          Everything is where you left it. Let’s make today count.
        </p>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn-primary min-h-11 w-full gap-2" onClick={close} autoFocus>
            Let’s go <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className="mx-auto min-h-9 px-2 text-xs font-medium text-muted hover:text-ink" onClick={() => (welcome.turnOff(), close())}>
            Don’t show this again
          </button>
        </div>
      </div>
    </dialog>
  );
}
