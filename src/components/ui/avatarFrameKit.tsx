import type { CSSProperties } from 'react';

/**
 * Drawing kit for the full avatar frames (./avatarFrameArt.tsx and friends). Every frame shares
 * one geometry: a viewBox centred on the picture, its edge at radius 50, rings at 51–60.
 */

/** A small fixed-seed random generator (mulberry32): particles land the same on every render. */
export const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const between = (rnd: () => number, a: number, b: number) => a + (b - a) * rnd();
/** A point at radius r and angle deg (0 = right, -90 = top). */
export const polar = (r: number, deg: number) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)] as const;
const f1 = (n: number) => n.toFixed(1);

export type Vars = CSSProperties & Record<`--${string}`, string>;

/** Duration and a negative delay, so a particle is already mid-flight when the frame appears. */
export const timing = (rnd: () => number, min: number, max: number): Vars => {
  const t = between(rnd, min, max);
  return { animationDuration: `${t.toFixed(2)}s`, animationDelay: `${(-rnd() * t).toFixed(2)}s` };
};

/** A ring whose radius waves: r + amp·sin(waves·θ + phase). */
export const wavy = (r: number, amp: number, waves: number, phase = 0, steps = 240) => {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rr = r + amp * Math.sin(waves * t + phase);
    d += `${i ? 'L' : 'M'}${f1(rr * Math.cos(t))} ${f1(rr * Math.sin(t))}`;
  }
  return `${d}Z`;
};

/** A jagged bolt along the ring from angle a to b, jumping in and out around radius r. */
export const bolt = (rnd: () => number, r: number, a: number, b: number, jag: number) => {
  const n = 9;
  return Array.from({ length: n + 1 }, (_, i) => {
    const [x, y] = polar(r + (i && i < n ? between(rnd, -jag, jag) : 0), a + ((b - a) * i) / n);
    return `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`;
  }).join('');
};

const C = 2 * Math.PI * 55;

/** A comet round the ring at radius 55: bright head, fading tail (spin its group). */
export const Comet = ({ color, length, width }: { color: string; length: number; width: number }) => (
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

export const Blur = ({ id, d }: { id: string; d: number }) => (
  <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation={d} />
  </filter>
);

/** A soft glow behind sharp shapes: the shapes blurred, then the shapes again on top. */
export const GlowFilter = ({ id, d }: { id: string; d: number }) => (
  <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceGraphic" stdDeviation={d} result="b" />
    <feMerge>
      <feMergeNode in="b" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);

/** A gradient across the shape (diagonal); it turns with the shape when the shape spins. */
export const Grad = ({ id, stops, flip }: { id: string; stops: string[]; flip?: boolean }) => (
  <linearGradient id={id} x1={flip ? '1' : '0'} y1="0" x2={flip ? '0' : '1'} y2="1">
    {stops.map((c, i) => (
      <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
    ))}
  </linearGradient>
);

/** A metal band with a bevel: the band, a light edge outside, a dark edge inside. */
export const Band = ({ fill, r = 55.5, w = 7, light = '#ffffff', dark = '#000000' }: { fill: string; r?: number; w?: number; light?: string; dark?: string }) => (
  <>
    <circle r={r} fill="none" stroke={fill} strokeWidth={w} />
    <circle r={r + w / 2 - 0.5} fill="none" stroke={light} strokeOpacity="0.55" strokeWidth="0.8" />
    <circle r={r - w / 2 + 0.5} fill="none" stroke={dark} strokeOpacity="0.45" strokeWidth="0.8" />
  </>
);

/** A four-point star (s = arm length). */
export const Sparkle = ({ s, fill }: { s: number; fill: string }) => (
  <path d={`M0 ${-s}Q0.5 -0.5 ${s} 0Q0.5 0.5 0 ${s}Q-0.5 0.5 ${-s} 0Q-0.5 -0.5 0 ${-s}Z`} fill={fill} />
);

/** A cut gem seen from above: four facets, light from the top left. */
export const Gem = ({ s, light, mid, dark }: { s: number; light: string; mid: string; dark: string }) => (
  <g>
    <path d={`M0 ${-s}L${s * 0.8} 0L0 0Z`} fill={mid} />
    <path d={`M0 ${-s}L${-s * 0.8} 0L0 0Z`} fill={light} />
    <path d={`M0 ${s}L${-s * 0.8} 0L0 0Z`} fill={mid} />
    <path d={`M0 ${s}L${s * 0.8} 0L0 0Z`} fill={dark} />
    <path d={`M0 ${-s}L${s * 0.8} 0L0 ${s}L${-s * 0.8} 0Z`} fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.4" />
  </g>
);

export const HEART = 'M0 2.8C-3.2 0.5-3.8-1.4-2.4-2.6C-1.3-3.4-0.3-3 0-2.2C0.3-3 1.3-3.4 2.4-2.6C3.8-1.4 3.2 0.5 0 2.8Z';
export const LEAF = 'M0 0C1.8 -2.6 5.6 -3.4 9 -1.2C6.4 1.6 2.6 2 0 0Z';
