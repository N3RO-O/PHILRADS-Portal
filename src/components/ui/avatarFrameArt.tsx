import type { CSSProperties, ReactNode } from 'react';
import type { AvatarFrameId } from '../../lib/avatarFrames';

/**
 * The full, detailed frames (profile, picker): layered rings, glow and particles. Same geometry
 * as ./AvatarFrame.tsx: viewBox centred on the picture, its edge at radius 50, rings at 51–60.
 *
 * Particles are placed once from a fixed seed, so a frame looks the same on every render and
 * every device. Each one runs a CSS animation (src/index.css, ".avp-*") with its own path,
 * duration and a negative delay, so they are already mid-flight when the frame appears.
 */

/** A small fixed-seed random generator (mulberry32). */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (rnd: () => number, a: number, b: number) => a + (b - a) * rnd();
const polar = (r: number, deg: number) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)] as const;

type Vars = CSSProperties & Record<`--${string}`, string>;

const C = 2 * Math.PI * 55;

/** A comet round the ring at radius 55: bright head, fading tail (spin its group). */
const Comet = ({ color, length, width }: { color: string; length: number; width: number }) => (
  <>
    {[1, 0.55, 0.25].map((k, i) => {
      const len = C * length * [0.22, 0.5, 1][i];
      return (
        <circle
          key={i}
          r="55"
          fill="none"
          stroke={color}
          strokeWidth={width * [1, 0.8, 0.6][i]}
          strokeLinecap="round"
          opacity={k}
          strokeDasharray={`${len} ${C}`}
          strokeDashoffset={-(C * length - len)}
        />
      );
    })}
  </>
);

const Blur = ({ id, d }: { id: string; d: number }) => (
  <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation={d} />
  </filter>
);

/** A soft glow behind sharp shapes: the shapes blurred, then the shapes again on top. */
const GlowFilter = ({ id, d }: { id: string; d: number }) => (
  <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceGraphic" stdDeviation={d} result="b" />
    <feMerge>
      <feMergeNode in="b" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);

// ───────────────────────── Ember ─────────────────────────
// Embers lift off the ring and rise, cooling from white-gold to red as they fade.

const EMBERS = (() => {
  const rnd = seeded(7);
  return Array.from({ length: 34 }, () => {
    const t = between(rnd, 1.4, 2.8);
    const [x, y] = polar(between(rnd, 54, 60), -90 + between(rnd, -130, 130));
    return {
      x,
      y,
      r: between(rnd, 0.8, 2.4),
      color: ['#fff3c4', '#ffd166', '#ff9f1c', '#ff6b1a', '#ff3d00'][Math.floor(rnd() * 5)],
      style: {
        '--dx': `${between(rnd, -7, 7).toFixed(1)}px`,
        '--dy': `${-between(rnd, 14, 34).toFixed(1)}px`,
        animationDuration: `${t.toFixed(2)}s`,
        animationDelay: `${(-rnd() * t).toFixed(2)}s`,
      } as Vars,
    };
  });
})();

/** Tongues of flame round the ring, pointing out, each flickering at its own pace. */
const TONGUES = (() => {
  const rnd = seeded(11);
  return Array.from({ length: 14 }, (_, i) => {
    const a = (360 / 14) * i + between(rnd, -8, 8);
    const t = between(rnd, 0.7, 1.3);
    return {
      a,
      h: between(rnd, 0.7, 1.25),
      style: { animationDuration: `${t.toFixed(2)}s`, animationDelay: `${(-rnd() * t).toFixed(2)}s` } as Vars,
    };
  });
})();
const TONGUE = 'M0 0C-3.4 -2 -3.6 -6.5 -1.2 -9.5C-1.4 -7.4 0 -6.6 0.4 -8.6C1.2 -11 0.6 -13 0 -14.5C3.6 -11.4 4.6 -6 2.4 -2.4C1.6 -1 0.8 -0.4 0 0Z';

const ember = (k: string) => (
  <>
    <defs>
      <Blur id={`${k}b`} d={3.2} />
      <GlowFilter id={`${k}g`} d={1.2} />
      <linearGradient id={`${k}f`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#ff3d00" />
        <stop offset="0.45" stopColor="#ff9f1c" />
        <stop offset="0.85" stopColor="#ffe08a" />
        <stop offset="1" stopColor="#fff8e1" stopOpacity="0.6" />
      </linearGradient>
      <radialGradient id={`${k}h`}>
        <stop offset="78%" stopColor="#ff5400" stopOpacity="0" />
        <stop offset="88%" stopColor="#ff5400" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#ff5400" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* Heat haze */}
    <circle className="avf-hum" r="64" fill={`url(#${k}h)`} />
    {/* Coals */}
    <circle r="55" fill="none" stroke="#5c1100" strokeWidth="5" />
    <circle r="55" fill="none" stroke="#ff5400" strokeOpacity="0.35" strokeWidth="2" />
    {/* Flames chasing round: a blurred one under a sharp one, a second pair opposite */}
    <g className="avf-spin" style={{ '--d': '2.4s' } as Vars}>
      <g filter={`url(#${k}b)`}>
        <Comet color="#ff3d00" length={0.48} width={9} />
      </g>
      <Comet color="#ff9f1c" length={0.42} width={4.6} />
      <Comet color="#fff3c4" length={0.14} width={1.8} />
    </g>
    <g className="avf-spin" style={{ '--d': '3.6s', animationDelay: '-1.8s' } as Vars}>
      <g filter={`url(#${k}b)`}>
        <Comet color="#ff5400" length={0.3} width={7} />
      </g>
      <Comet color="#ffb300" length={0.26} width={3.2} />
    </g>
    {/* Flame tongues: blurred glow under each sharp flame */}
    <g className="avf-spin" style={{ '--d': '16s' } as Vars}>
      {TONGUES.map((f, i) => {
        const [x, y] = polar(55.5, f.a - 90);
        return (
          <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${f.a.toFixed(1)}) scale(${f.h.toFixed(2)})`}>
            <g className="avp-flicker" style={f.style}>
              <path d={TONGUE} fill="#ff3d00" opacity="0.7" filter={`url(#${k}b)`} />
              <path d={TONGUE} fill={`url(#${k}f)`} />
            </g>
          </g>
        );
      })}
    </g>
    {/* Embers */}
    <g filter={`url(#${k}g)`}>
      {EMBERS.map((e, i) => (
        <g key={i} transform={`translate(${e.x.toFixed(1)} ${e.y.toFixed(1)})`}>
          <circle className="avp-rise" r={e.r.toFixed(2)} fill={e.color} style={e.style} />
        </g>
      ))}
    </g>
  </>
);

// ───────────────────────── Galaxy ─────────────────────────
// A nebula band turning slowly, stars at three depths (the nearer, the faster and brighter),
// and now and then a shooting star.

const STAR_LAYERS = (() => {
  const rnd = seeded(42);
  const layer = (n: number, rMin: number, rMax: number, sMin: number, sMax: number) =>
    Array.from({ length: n }, () => {
      const [x, y] = polar(between(rnd, 50.5, 62), between(rnd, 0, 360));
      const t = between(rnd, 1.8, 3.6);
      return {
        x,
        y,
        r: between(rnd, rMin, rMax),
        s: between(rnd, sMin, sMax),
        style: { animationDuration: `${t.toFixed(2)}s`, animationDelay: `${(-rnd() * t).toFixed(2)}s` } as Vars,
      };
    });
  return { far: layer(16, 0.35, 0.7, 0, 0), mid: layer(9, 0.8, 1.2, 0, 0), near: layer(5, 0, 0, 2.6, 3.8) };
})();

const Sparkle = ({ s, fill }: { s: number; fill: string }) => (
  <path d={`M0 ${-s}Q0.5 -0.5 ${s} 0Q0.5 0.5 0 ${s}Q-0.5 0.5 ${-s} 0Q-0.5 -0.5 0 ${-s}Z`} fill={fill} />
);

const galaxy = (k: string) => (
  <>
    <defs>
      <Blur id={`${k}b`} d={3.4} />
      <GlowFilter id={`${k}g`} d={1.1} />
      <linearGradient id={`${k}n1`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3b0764" />
        <stop offset="0.3" stopColor="#7c3aed" />
        <stop offset="0.55" stopColor="#db2777" />
        <stop offset="0.8" stopColor="#1d4ed8" />
        <stop offset="1" stopColor="#3b0764" />
      </linearGradient>
      <linearGradient id={`${k}n2`} x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#22d3ee" />
        <stop offset="0.4" stopColor="#6366f1" stopOpacity="0.2" />
        <stop offset="0.7" stopColor="#c026d3" />
        <stop offset="1" stopColor="#22d3ee" stopOpacity="0.2" />
      </linearGradient>
      <linearGradient id={`${k}tail`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#ffffff" />
      </linearGradient>
    </defs>
    {/* Nebula: two clouds turning against each other */}
    <g className="avf-spin" style={{ '--d': '22s' } as Vars}>
      <circle r="56" fill="none" stroke={`url(#${k}n1)`} strokeWidth="11" opacity="0.75" filter={`url(#${k}b)`} />
    </g>
    <g className="avf-spin-rev" style={{ '--d': '30s' } as Vars}>
      <circle r="57" fill="none" stroke={`url(#${k}n2)`} strokeWidth="7" opacity="0.5" filter={`url(#${k}b)`} />
    </g>
    {/* The band itself, with a fine bright edge */}
    <g className="avf-spin" style={{ '--d': '14s' } as Vars}>
      <circle r="55.5" fill="none" stroke={`url(#${k}n1)`} strokeWidth="5" />
    </g>
    <circle r="52.6" fill="none" stroke="#e9d5ff" strokeOpacity="0.45" strokeWidth="0.6" />
    {/* Stars, far to near */}
    <g className="avf-spin" style={{ '--d': '90s' } as Vars}>
      {STAR_LAYERS.far.map((s, i) => (
        <circle key={i} className="avf-twinkle" cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill="#e9d5ff" style={s.style} />
      ))}
    </g>
    <g className="avf-spin-rev" style={{ '--d': '48s' } as Vars}>
      {STAR_LAYERS.mid.map((s, i) => (
        <circle key={i} className="avf-twinkle" cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill="#ffffff" style={s.style} />
      ))}
    </g>
    <g className="avf-spin" style={{ '--d': '28s' } as Vars} filter={`url(#${k}g)`}>
      {STAR_LAYERS.near.map((s, i) => (
        <g key={i} transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`}>
          <g className="avf-twinkle" style={s.style}>
            <Sparkle s={s.s} fill={i % 2 ? '#fdf4ff' : '#bae6fd'} />
          </g>
        </g>
      ))}
    </g>
    {/* A shooting star, every few seconds, at two places */}
    {[
      [-35, 0],
      [150, -3.5],
    ].map(([angle, delay]) => {
      const [x, y] = polar(59, angle);
      return (
        <g key={angle} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle + 100})`}>
          <g className="avp-shoot" style={{ animationDelay: `${delay}s` }}>
            <line x1="-16" y1="0" x2="0" y2="0" stroke={`url(#${k}tail)`} strokeWidth="1.3" strokeLinecap="round" />
            <circle r="1.3" fill="#ffffff" />
          </g>
        </g>
      );
    })}
  </>
);

// ───────────────────────── Sakura ─────────────────────────
// A branch of blossoms round the ring, swaying, and petals drifting down on a light breeze.

const PETAL = 'M0 -3.2C1.9 -3.2 2.6 -0.9 1.5 1.3L0 3.2L-1.5 1.3C-2.6 -0.9 -1.9 -3.2 0 -3.2Z';

const FALLING = (() => {
  const rnd = seeded(3);
  return Array.from({ length: 22 }, () => {
    const [x, y] = polar(between(rnd, 54, 62), between(rnd, -180, 15));
    const t = between(rnd, 3.4, 6.2);
    return {
      x,
      y,
      scale: between(rnd, 0.75, 1.35),
      color: ['#ffd1e3', '#ffb7d5', '#ff9ec4', '#fff0f6'][Math.floor(rnd() * 4)],
      style: {
        '--dx': `${between(rnd, 4, 14).toFixed(1)}px`,
        '--dy': `${between(rnd, 22, 40).toFixed(1)}px`,
        '--rot': `${between(rnd, 160, 420).toFixed(0)}deg`,
        animationDuration: `${t.toFixed(2)}s`,
        animationDelay: `${(-rnd() * t).toFixed(2)}s`,
      } as Vars,
    };
  });
})();

const Blossom = ({ size, tone }: { size: number; tone: 0 | 1 }) => (
  <g transform={`scale(${size})`}>
    {[0, 72, 144, 216, 288].map((r) => (
      <path key={r} d={PETAL} transform={`rotate(${r}) translate(0 -3)`} fill={tone ? '#ffd1e3' : '#ffb0cf'} stroke="#ff8fb8" strokeWidth="0.25" />
    ))}
    <circle r="1.3" fill="#ff6fa3" />
    {[0, 72, 144, 216, 288].map((r) => {
      const [x, y] = polar(1.9, r - 90);
      return <circle key={r} cx={x} cy={y} r="0.35" fill="#fff3a8" />;
    })}
  </g>
);

const BLOSSOMS = [
  [-125, 1.45, 0],
  [-100, 0.95, 1],
  [-58, 1.15, 1],
  [-18, 1.3, 0],
  [32, 0.95, 1],
  [148, 1.1, 1],
  [196, 1.35, 0],
] as const;

const sakura = (k: string) => (
  <>
    <defs>
      <GlowFilter id={`${k}g`} d={0.9} />
      <linearGradient id={`${k}r`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffd1e3" />
        <stop offset="0.5" stopColor="#ff8fb8" />
        <stop offset="1" stopColor="#ffe3ee" />
      </linearGradient>
    </defs>
    {/* The branch: a soft ring with a fine white line inside */}
    <circle r="55.5" fill="none" stroke={`url(#${k}r)`} strokeWidth="3.4" />
    <circle r="53" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.6" />
    {/* Little leaves along it */}
    {[-140, -95, -40, 10, 60, 110, 175, 235].map((a) => {
      const [x, y] = polar(56.5, a);
      return <ellipse key={a} cx={x} cy={y} rx="1.1" ry="2.6" fill="#86efac" opacity="0.85" transform={`rotate(${a + 60} ${x} ${y})`} />;
    })}
    {/* Blossoms, each swaying a little */}
    <g filter={`url(#${k}g)`}>
      {BLOSSOMS.map(([a, size, tone], i) => {
        const [x, y] = polar(56, a);
        return (
          <g key={a} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a + 90})`}>
            <g className="avf-sway" style={{ animationDelay: `${-i * 0.7}s` }}>
              <Blossom size={size} tone={tone} />
            </g>
          </g>
        );
      })}
    </g>
    {/* Falling petals */}
    {FALLING.map((p, i) => (
      <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${p.scale.toFixed(2)})`}>
        <path className="avp-fall" d={PETAL} fill={p.color} style={p.style} />
      </g>
    ))}
  </>
);

export const FULL_FRAMES: Partial<Record<AvatarFrameId, (k: string) => ReactNode>> = { ember, galaxy, sakura };
