import type { ReactNode } from 'react';
import { between, Blur, bolt, Comet, GlowFilter, Grad, HEART, LEAF, polar, seeded, Sparkle, timing, wavy, type Vars } from './avatarFrameKit';

/**
 * The moving frames in full detail (Ember, Galaxy and Sakura are in ./avatarFrameArt.tsx).
 * Particles are placed once from a fixed seed; each runs its own CSS animation (src/index.css).
 */

const f1 = (n: number) => n.toFixed(1);
const spin = (d: string, delay?: string) => ({ '--d': d, ...(delay && { animationDelay: delay }) }) as Vars;

/** Particles drifting off the ring: [x, y] start, size, colour index, drift and timing. */
const drift = (seed: number, n: number, o: { from: [number, number]; r: [number, number]; size: [number, number]; dx: [number, number]; dy: [number, number]; t: [number, number] }) => {
  const rnd = seeded(seed);
  return Array.from({ length: n }, () => {
    const [x, y] = polar(between(rnd, ...o.r), between(rnd, ...o.from));
    return {
      x,
      y,
      size: between(rnd, ...o.size),
      pick: rnd(),
      style: { '--dx': `${f1(between(rnd, ...o.dx))}px`, '--dy': `${f1(between(rnd, ...o.dy))}px`, ...timing(rnd, ...o.t) } as Vars,
    };
  });
};

/** Points scattered round the ring band, each with its own twinkle timing. */
const scatter = (seed: number, n: number, r: [number, number], size: [number, number], t: [number, number] = [1.6, 3.4]) => {
  const rnd = seeded(seed);
  return Array.from({ length: n }, () => {
    const [x, y] = polar(between(rnd, ...r), between(rnd, 0, 360));
    return { x, y, size: between(rnd, ...size), pick: rnd(), style: timing(rnd, ...t) };
  });
};

const of = <T,>(list: readonly T[], pick: number) => list[Math.floor(pick * list.length)];

// ───────── Aurora ─────────
const AURORA = ['#00e5a0', '#00b3ff', '#9b5cff', '#ff5ccb', '#00e5a0'];
const AURORA_RAYS = scatter(21, 28, [57, 57], [3, 8], [2, 4.5]);
const AURORA_MOTES = drift(22, 12, { from: [-180, 0], r: [55, 60], size: [0.5, 1.1], dx: [-5, 5], dy: [-10, -20], t: [2.4, 4.2] });

// ───────── Ocean ─────────
const BUBBLES = drift(31, 16, { from: [0, 360], r: [54, 60], size: [0.8, 2.1], dx: [-3, 3], dy: [-12, -24], t: [2.6, 4.6] });

// ───────── Orbit ─────────
const DUST = scatter(41, 14, [50.5, 62], [0.35, 0.8]);

// ───────── Thunder ─────────
const BOLTS = (() => {
  const rnd = seeded(51);
  return Array.from({ length: 6 }, (_, i) => {
    const a = i * 60 + between(rnd, -15, 15);
    return { d: bolt(rnd, 56, a, a + between(rnd, 35, 60), 3.2), style: timing(rnd, 1.6, 3.4) };
  });
})();
const FORKS = (() => {
  const rnd = seeded(52);
  return Array.from({ length: 5 }, (_, i) => ({ a: i * 72 + between(rnd, 0, 40), style: timing(rnd, 2, 3.6) }));
})();

// ───────── Heartbeat ─────────
const HEARTS = drift(61, 10, { from: [-170, -10], r: [55, 59], size: [0.55, 1.05], dx: [-5, 5], dy: [-14, -26], t: [2.4, 4] });

// ───────── Evergreen ─────────
const VINE_LEAVES = Array.from({ length: 20 }, (_, i) => ({ a: i * 18 + (i % 2) * 6, side: i % 2 }));
const FALLING_LEAVES = drift(71, 6, { from: [-160, -20], r: [56, 60], size: [0.55, 0.8], dx: [4, 12], dy: [20, 34], t: [4, 6.5] });
const FIREFLIES = scatter(72, 9, [57, 63], [0.6, 1.1], [1.8, 3.2]);

// ───────── Sparkle ─────────
const GLINTS = scatter(81, 13, [53.5, 60.5], [1.6, 4.6], [1.4, 3]);
const GLITTER = drift(82, 18, { from: [0, 360], r: [54, 60], size: [0.3, 0.7], dx: [-4, 4], dy: [-6, -13], t: [1.8, 3.4] });

// ───────── Rainbow ─────────
const SPECTRUM = ['#ff004d', '#ff9a00', '#ffe600', '#2bff88', '#00c8ff', '#7b5cff', '#ff00c8'];
const PRISMS = scatter(91, 11, [58.5, 61.5], [1.4, 3], [1.4, 2.8]);
const LIGHT_MOTES = drift(92, 12, { from: [0, 360], r: [55, 59], size: [0.5, 1], dx: [-5, 5], dy: [-10, -18], t: [2.2, 3.8] });

// ───────── Halo ─────────
const HALO_RAYS = Array.from({ length: 18 }, (_, i) => ({ a: i * 20, len: 4 + ((i * 7) % 5) * 1.3 }));
const HALO_MOTES = drift(101, 12, { from: [-200, 20], r: [54, 59], size: [0.5, 1.1], dx: [-4, 4], dy: [-10, -20], t: [2.6, 4.4] });

// ───────── PHILRADS ─────────
const PR_MOTES = scatter(111, 12, [59, 61.5], [0.6, 1.2], [1.6, 3]);

export const MOVING_FRAMES = {
  /** Northern lights: waving curtains of colour, light rays shimmering, motes drifting up. */
  aurora: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={AURORA} />
        <Grad id={`${k}h`} stops={[...AURORA].reverse()} flip />
        <Blur id={`${k}b`} d={3.2} />
        <GlowFilter id={`${k}w`} d={1} />
      </defs>
      <g className="avf-spin-rev" style={spin('18s')}>
        <path d={wavy(56, 2.4, 5)} fill="none" stroke={`url(#${k}g)`} strokeWidth="8" opacity="0.6" filter={`url(#${k}b)`} />
      </g>
      <g className="avf-spin" style={spin('40s')}>
        {AURORA_RAYS.map((r, i) => {
          const a = Math.atan2(r.y, r.x);
          return (
            <line
              key={i}
              className="avf-twinkle"
              x1={f1(r.x)}
              y1={f1(r.y)}
              x2={f1(r.x + Math.cos(a) * r.size)}
              y2={f1(r.y + Math.sin(a) * r.size)}
              stroke={of(AURORA, r.pick)}
              strokeOpacity="0.55"
              strokeWidth="1.4"
              strokeLinecap="round"
              style={r.style}
            />
          );
        })}
      </g>
      <g className="avf-spin" style={spin('11s')}>
        <path d={wavy(55.8, 1.6, 7, 1)} fill="none" stroke={`url(#${k}g)`} strokeWidth="3.2" />
      </g>
      <g className="avf-spin-rev" style={spin('26s')}>
        <circle r="55.5" fill="none" stroke={`url(#${k}h)`} strokeWidth="1.4" opacity="0.85" />
      </g>
      <g filter={`url(#${k}w)`}>
        {AURORA_MOTES.map((m, i) => (
          <g key={i} transform={`translate(${f1(m.x)} ${f1(m.y)})`}>
            <circle className="avp-bubble" r={m.size.toFixed(2)} fill={of(AURORA, m.pick)} style={m.style} />
          </g>
        ))}
      </g>
    </>
  ),

  /** A turning tide with wave crests, ripples going out and bubbles rising. */
  ocean: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#023e8a', '#00b4d8', '#90e0ef', '#0077b6', '#023e8a']} />
        <Blur id={`${k}b`} d={2.4} />
      </defs>
      {[0, 1.5].map((delay) => (
        <circle key={delay} className="avf-ripple" style={{ animationDelay: `${delay}s` }} r="55.5" fill="none" stroke="#48cae4" strokeWidth="1.4" />
      ))}
      <circle r="55.5" fill="none" stroke="#0077b6" strokeWidth="9" opacity="0.45" filter={`url(#${k}b)`} />
      <g className="avf-spin" style={spin('12s')}>
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="6" />
      </g>
      <g className="avf-spin" style={spin('7s')}>
        <path d={wavy(58, 1.4, 12)} fill="none" stroke="#caf0f8" strokeWidth="1.3" opacity="0.9" />
      </g>
      <g className="avf-spin-rev" style={spin('10s')}>
        <path d={wavy(57.4, 1.1, 9, 2)} fill="none" stroke="#48cae4" strokeWidth="0.9" opacity="0.7" />
      </g>
      <circle r="52.6" fill="none" stroke="#caf0f8" strokeOpacity="0.4" strokeWidth="0.6" />
      {BUBBLES.map((b, i) => (
        <g key={i} transform={`translate(${f1(b.x)} ${f1(b.y)})`}>
          <g className="avp-bubble" style={b.style}>
            <circle r={b.size.toFixed(2)} fill="#caf0f8" fillOpacity="0.15" stroke="#e0fbff" strokeWidth="0.45" />
            <circle cx={-b.size * 0.35} cy={-b.size * 0.35} r={(b.size * 0.25).toFixed(2)} fill="#ffffff" opacity="0.8" />
          </g>
        </g>
      ))}
    </>
  ),

  /** A ringed planet orbiting with a trail of dust, a little moon the other way, stardust. */
  orbit: (k: string) => (
    <>
      <defs>
        <radialGradient id={`${k}p`} cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.45" stopColor="#ffd166" />
          <stop offset="1" stopColor="#e76f00" />
        </radialGradient>
        <GlowFilter id={`${k}w`} d={1.4} />
      </defs>
      <circle r="57" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.2" />
      <circle r="57" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.6" strokeDasharray="0.6 3" />
      {DUST.map((d, i) => (
        <circle key={i} className="avf-twinkle" cx={f1(d.x)} cy={f1(d.y)} r={d.size.toFixed(2)} fill="#e0e7ff" style={d.style} />
      ))}
      <g className="avf-spin" style={spin('7s')}>
        {[-30, -24, -18, -13, -9, -5].map((a, i) => {
          const [x, y] = polar(57, a - 90);
          return <circle key={a} cx={f1(x)} cy={f1(y)} r={(0.5 + i * 0.22).toFixed(2)} fill="#ffd166" opacity={(0.12 + i * 0.12).toFixed(2)} />;
        })}
        <g transform="translate(0 -57)" filter={`url(#${k}w)`}>
          <ellipse rx="8" ry="2.1" fill="none" stroke="#ffe8a3" strokeOpacity="0.5" strokeWidth="0.9" transform="rotate(-22)" />
          <circle r="4.6" fill={`url(#${k}p)`} />
          <path d="M-8 0A8 2.1 0 0 0 8 0" fill="none" stroke="#ffe8a3" strokeWidth="0.9" transform="rotate(-22)" />
        </g>
      </g>
      <g className="avf-spin-rev" style={spin('3.8s')}>
        <g transform="translate(0 57)" filter={`url(#${k}w)`}>
          <circle r="1.9" fill="#bae6fd" />
          <circle cx="-0.5" cy="-0.5" r="0.6" fill="#ffffff" />
        </g>
      </g>
    </>
  ),

  /** Two neon tubes, cyan and magenta, humming and flickering, with a spark running round. */
  neon: (k: string) => (
    <>
      <defs>
        <Blur id={`${k}b`} d={2.6} />
      </defs>
      <g className="avf-hum">
        <circle r="54.4" fill="none" stroke="#22e4ff" strokeWidth="6" filter={`url(#${k}b)`} />
        <circle r="54.4" fill="none" stroke="#22e4ff" strokeWidth="2.4" />
        <circle r="54.4" fill="none" stroke="#e0fdff" strokeWidth="0.9" />
      </g>
      <g className="avp-neon">
        <circle r="58.6" fill="none" stroke="#ff2bd6" strokeWidth="5" filter={`url(#${k}b)`} />
        <circle r="58.6" fill="none" stroke="#ff2bd6" strokeWidth="1.8" />
        <circle r="58.6" fill="none" stroke="#ffe3fa" strokeWidth="0.6" />
      </g>
      <g className="avf-spin" style={spin('2.2s')}>
        <g transform="scale(1.025)">
          <Comet color="#ffffff" length={0.07} width={1.8} />
        </g>
      </g>
    </>
  ),

  /** A storm band, crackling arcs along it and forks of lightning striking out. */
  thunder: (k: string) => (
    <>
      <defs>
        <Blur id={`${k}b`} d={3} />
        <GlowFilter id={`${k}w`} d={1.2} />
      </defs>
      <circle r="56" fill="none" stroke="#334155" strokeWidth="9" opacity="0.9" />
      <circle className="avf-hum" r="56" fill="none" stroke="#475569" strokeWidth="10" opacity="0.6" filter={`url(#${k}b)`} />
      <circle r="55.5" fill="none" stroke="#fde047" strokeWidth="1.4" />
      <circle className="avf-hum" r="55.5" fill="none" stroke="#fde047" strokeWidth="5" opacity="0.35" filter={`url(#${k}b)`} />
      {/* Faint crackle always there; the bright strikes flash over it */}
      {BOLTS.map((b, i) => (
        <path key={i} d={b.d} fill="none" stroke="#fde68a" strokeOpacity="0.35" strokeWidth="0.8" strokeLinejoin="round" />
      ))}
      <g filter={`url(#${k}w)`}>
        {BOLTS.map((b, i) => (
          <path key={i} className="avf-flash" d={b.d} fill="none" stroke="#fffde7" strokeWidth="1.3" strokeLinejoin="round" style={b.style} />
        ))}
        {FORKS.map((f, i) => {
          const [x, y] = polar(56, f.a);
          return (
            <g key={i} transform={`translate(${f1(x)} ${f1(y)}) rotate(${f.a + 90})`}>
              <path className="avf-flash" d="M0 0L-1.6 -3.6L1.2 -5.6L-0.8 -9.6L0.6 -7L-1 -5.2L1.8 -3.4Z" fill="#fffde7" stroke="#fde047" strokeWidth="0.5" strokeLinejoin="round" style={f.style} />
            </g>
          );
        })}
      </g>
    </>
  ),

  /** A ring that beats, a pulse going out with each beat, and little hearts floating up. */
  heartbeat: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#ff4d8d', '#ff8fab', '#ff2e63', '#ffb3c7', '#ff4d8d']} />
        <Blur id={`${k}b`} d={2.6} />
        <GlowFilter id={`${k}w`} d={0.9} />
      </defs>
      <circle className="avf-ripple" style={{ animationDuration: '1.6s' }} r="55.5" fill="none" stroke="#ff4d8d" strokeWidth="1.6" />
      <g className="avf-beat">
        <circle r="55.5" fill="none" stroke="#ff4d8d" strokeWidth="8" opacity="0.5" filter={`url(#${k}b)`} />
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="4.6" />
        <circle r="53" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.6" />
        <g transform="translate(0 57.5) scale(2.1)">
          <path d={HEART} fill="#ff2e63" stroke="#ffd1dc" strokeWidth="0.35" />
          <ellipse cx="-1.2" cy="-1.4" rx="0.7" ry="0.45" fill="#ffffff" opacity="0.7" />
        </g>
      </g>
      <g filter={`url(#${k}w)`}>
        {HEARTS.map((h, i) => (
          <g key={i} transform={`translate(${f1(h.x)} ${f1(h.y)}) scale(${h.size.toFixed(2)})`}>
            <path className="avp-bubble" d={HEART} fill={of(['#ff4d8d', '#ff8fab', '#ffb3c7', '#ff2e63'], h.pick)} style={h.style} />
          </g>
        ))}
      </g>
    </>
  ),

  /** A twisting vine with leaves swaying, small white flowers, leaves drifting down, fireflies. */
  leaf: (k: string) => (
    <>
      <defs>
        <linearGradient id={`${k}l`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#15803d" />
          <stop offset="0.6" stopColor="#4ade80" />
          <stop offset="1" stopColor="#bbf7d0" />
        </linearGradient>
        <GlowFilter id={`${k}w`} d={1.2} />
      </defs>
      <path d={wavy(56, 1.6, 9)} fill="none" stroke="#166534" strokeWidth="1.8" />
      <path d={wavy(56, 1.6, 9, Math.PI)} fill="none" stroke="#15803d" strokeWidth="1.1" />
      {VINE_LEAVES.map((l, i) => {
        const [x, y] = polar(56, l.a);
        return (
          <g key={i} transform={`translate(${f1(x)} ${f1(y)}) rotate(${l.a + (l.side ? 150 : 30)})`}>
            <g className="avf-sway" style={{ animationDelay: `${-i * 0.37}s`, animationDuration: '3.4s' }}>
              <path d={LEAF} fill={`url(#${k}l)`} transform={`scale(${l.side ? 0.85 : 1})`} />
              <path d="M0.6 0L7.6 -1" stroke="#14532d" strokeOpacity="0.55" strokeWidth="0.3" transform={`scale(${l.side ? 0.85 : 1})`} />
            </g>
          </g>
        );
      })}
      {[-110, -20, 70, 160].map((a) => {
        const [x, y] = polar(56.5, a);
        return (
          <g key={a} transform={`translate(${f1(x)} ${f1(y)})`}>
            {[0, 72, 144, 216, 288].map((r) => (
              <ellipse key={r} cy="-1.2" rx="0.8" ry="1.2" fill="#ffffff" transform={`rotate(${r})`} />
            ))}
            <circle r="0.6" fill="#fde047" />
          </g>
        );
      })}
      {FALLING_LEAVES.map((l, i) => (
        <g key={i} transform={`translate(${f1(l.x)} ${f1(l.y)}) scale(${l.size.toFixed(2)})`}>
          <path className="avp-fall" d={LEAF} fill="#4ade80" style={{ ...l.style, '--rot': `${200 + i * 40}deg` } as Vars} />
        </g>
      ))}
      <g className="avf-spin" style={spin('40s')} filter={`url(#${k}w)`}>
        {FIREFLIES.map((f, i) => (
          <circle key={i} className="avf-twinkle" cx={f1(f.x)} cy={f1(f.y)} r={f.size.toFixed(2)} fill="#d9f99d" style={f.style} />
        ))}
      </g>
    </>
  ),

  /** A silver ring with a shine running round, stars glinting and glitter drifting up. */
  sparkle: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#ffffff', '#cbd5e1', '#f8fafc', '#94a3b8', '#ffffff']} />
        <Blur id={`${k}b`} d={2.2} />
        <GlowFilter id={`${k}w`} d={1} />
      </defs>
      <circle r="55.5" fill="none" stroke="#e2e8f0" strokeWidth="6" opacity="0.35" filter={`url(#${k}b)`} />
      <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="2.4" />
      <g className="avf-spin" style={spin('4s')}>
        <Comet color="#ffffff" length={0.12} width={2.6} />
      </g>
      <g filter={`url(#${k}w)`}>
        {GLINTS.map((g, i) => (
          <g key={i} transform={`translate(${f1(g.x)} ${f1(g.y)})`}>
            <g className="avf-twinkle" style={g.style}>
              <Sparkle s={g.size} fill={of(['#ffffff', '#fff3a8', '#e0f2fe', '#ffffff'], g.pick)} />
            </g>
          </g>
        ))}
        {GLITTER.map((g, i) => (
          <g key={i} transform={`translate(${f1(g.x)} ${f1(g.y)})`}>
            <circle className="avp-bubble" r={g.size.toFixed(2)} fill={of(['#ffffff', '#fde68a', '#bae6fd'], g.pick)} style={g.style} />
          </g>
        ))}
      </g>
    </>
  ),

  /** Every colour turning, a fine prism line the other way, coloured glints and motes. */
  rainbow: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={SPECTRUM} />
        <Grad id={`${k}h`} stops={[...SPECTRUM].reverse()} flip />
        <Blur id={`${k}b`} d={2.8} />
        <GlowFilter id={`${k}w`} d={0.9} />
      </defs>
      <g className="avf-spin" style={spin('7s')}>
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="9" opacity="0.55" filter={`url(#${k}b)`} />
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="4.4" />
      </g>
      <circle r="55.5" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.6" />
      <g className="avf-spin-rev" style={spin('12s')}>
        <path d={wavy(58.8, 0.9, 8)} fill="none" stroke={`url(#${k}h)`} strokeWidth="1" opacity="0.85" />
      </g>
      <g className="avf-spin" style={spin('22s')} filter={`url(#${k}w)`}>
        {PRISMS.map((p, i) => (
          <g key={i} transform={`translate(${f1(p.x)} ${f1(p.y)})`}>
            <g className="avf-twinkle" style={p.style}>
              <Sparkle s={p.size} fill={of(SPECTRUM, p.pick)} />
            </g>
          </g>
        ))}
      </g>
      {LIGHT_MOTES.map((m, i) => (
        <g key={i} transform={`translate(${f1(m.x)} ${f1(m.y)})`}>
          <circle className="avp-bubble" r={m.size.toFixed(2)} fill={of(SPECTRUM, m.pick)} style={m.style} />
        </g>
      ))}
    </>
  ),

  /** A golden halo floating above, soft rays turning behind, motes of light rising. */
  halo: (k: string) => (
    <>
      <defs>
        <Blur id={`${k}b`} d={2} />
        <GlowFilter id={`${k}w`} d={1} />
        <linearGradient id={`${k}g`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d4a017" />
          <stop offset="0.5" stopColor="#fff8dc" />
          <stop offset="1" stopColor="#d4a017" />
        </linearGradient>
      </defs>
      <g className="avf-spin" style={spin('36s')}>
        <g className="avf-hum">
          {HALO_RAYS.map((r, i) => {
            const [x1, y1] = polar(57, r.a);
            const [x2, y2] = polar(57 + r.len, r.a);
            return <line key={i} x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} stroke="#ffe08a" strokeOpacity="0.4" strokeWidth="0.9" strokeLinecap="round" />;
          })}
        </g>
      </g>
      <circle r="55" fill="none" stroke="#ffe08a" strokeOpacity="0.6" strokeWidth="1.4" />
      <circle r="55" fill="none" stroke="#ffd166" strokeOpacity="0.4" strokeWidth="5" filter={`url(#${k}b)`} />
      <g className="avf-float">
        <ellipse cx="0" cy="-57" rx="24" ry="5.6" fill="none" stroke="#ffd166" strokeWidth="5" opacity="0.55" filter={`url(#${k}b)`} />
        <ellipse cx="0" cy="-57" rx="24" ry="5.6" fill="none" stroke={`url(#${k}g)`} strokeWidth="2.2" />
        <ellipse cx="0" cy="-57" rx="24" ry="5.6" fill="none" stroke="#fffbea" strokeWidth="0.5" />
        <g transform="translate(9 -52)" filter={`url(#${k}w)`}>
          <g className="avf-twinkle">
            <Sparkle s={3} fill="#ffffff" />
          </g>
        </g>
      </g>
      <g filter={`url(#${k}w)`}>
        {HALO_MOTES.map((m, i) => (
          <g key={i} transform={`translate(${f1(m.x)} ${f1(m.y)})`}>
            <circle className="avp-bubble" r={m.size.toFixed(2)} fill="#fff1b8" style={m.style} />
          </g>
        ))}
      </g>
    </>
  ),

  /** Burgundy and orange: light chasing round the PHILRADS ring, the cross at the top, sparks. */
  philrads: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#a3161a', '#5c0606', '#8b0f12', '#4a0505', '#a3161a']} />
        <Grad id={`${k}o`} stops={['#ffe3a3', '#ec952a', '#f5b562', '#b86e14']} />
        <Blur id={`${k}b`} d={2.6} />
        <GlowFilter id={`${k}w`} d={1} />
      </defs>
      <circle className="avf-hum" r="55.5" fill="none" stroke="#b91c1c" strokeWidth="10" opacity="0.6" filter={`url(#${k}b)`} />
      <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="6.5" />
      <circle r="52.6" fill="none" stroke="#ec952a" strokeOpacity="0.55" strokeWidth="0.6" />
      <circle r="58.4" fill="none" stroke="#ec952a" strokeOpacity="0.55" strokeWidth="0.6" />
      <g className="avf-spin" style={spin('3.2s')}>
        <Comet color="#ec952a" length={0.34} width={3.4} />
        <Comet color="#fff1d6" length={0.08} width={1.4} />
      </g>
      <g className="avf-spin" style={spin('3.2s', '-1.6s')}>
        <Comet color="#f5b562" length={0.2} width={2.2} />
      </g>
      <g className="avf-spin-rev" style={spin('14s')} filter={`url(#${k}w)`}>
        {PR_MOTES.map((m, i) => (
          <circle key={i} className="avf-twinkle" cx={f1(m.x)} cy={f1(m.y)} r={m.size.toFixed(2)} fill={m.pick > 0.5 ? '#ec952a' : '#ffe3a3'} style={m.style} />
        ))}
      </g>
      <g transform="translate(0 -55.5)" filter={`url(#${k}w)`}>
        <circle r="6" fill="#5c0606" stroke={`url(#${k}o)`} strokeWidth="1.4" />
        <path d="M-1.1 -3.8H1.1V-1.1H3.8V1.1H1.1V3.8H-1.1V1.1H-3.8V-1.1H-1.1Z" fill="#ffffff" />
      </g>
    </>
  ),
} satisfies Record<string, (k: string) => ReactNode>;
