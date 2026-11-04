import { useEffect, useId, useRef, type ReactNode } from 'react';
import { isAvatarFrame, type AvatarFrameId } from '../../lib/avatarFrames';
import { adminLite } from './avatarFrameAdmin';
import { FULL_FRAMES } from './avatarFrameArt';

/**
 * A picture in its chosen frame (src/lib/avatarFrames.ts). No frame, or an unknown one: just the picture.
 *
 * Each frame is an SVG laid over the picture, 128% of its size, in a viewBox centred on the
 * picture's centre where the picture's edge is radius 50. Rings sit between 51 and 60, so every
 * frame is concentric with the picture at any size. Motion classes are in src/index.css (".avf-*").
 *
 * `detail`: "full" (profile, picker) adds the particles and extra layers where a frame has them
 * (./avatarFrameArt.tsx); "lite" (lists, small pictures) is the clean ring alone.
 * `motion`: "hover" keeps it still until the pointer is on it or on its row (".group"), like
 * Discord's lists. Frames off screen pause either way.
 */
export function AvatarFrame({
  frame,
  detail = 'full',
  motion = 'always',
  children,
}: {
  frame: string | null | undefined;
  detail?: 'full' | 'lite';
  motion?: 'always' | 'hover';
  children: ReactNode;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ref = useRef<HTMLSpanElement>(null);
  const known = isAvatarFrame(frame);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    watch(el);
    return () => unwatch(el);
  }, [known]);
  if (!known) return <>{children}</>;
  const art = (detail === 'full' && FULL_FRAMES[frame]) || FRAMES[frame];
  return (
    <span ref={ref} className="av-framed" data-motion={motion}>
      {children}
      <svg aria-hidden className="av-frame" viewBox="-64 -64 128 128">
        {art(`f${uid}`)}
      </svg>
    </span>
  );
}

// One observer for every frame on the page: off screen, the animations pause.
let observer: IntersectionObserver | null = null;
const watch = (el: Element) => {
  if (typeof IntersectionObserver === 'undefined') return;
  observer ??= new IntersectionObserver((entries) => {
    for (const e of entries) (e.target as HTMLElement).toggleAttribute('data-off', !e.isIntersecting);
  });
  observer.observe(el);
};
const unwatch = (el: Element) => observer?.unobserve(el);

const C = 2 * Math.PI * 55; // the ring at radius 55, for dashes

/** Points around the ring: [x, y, angle in degrees] for n evenly spaced spots at radius r. */
const around = (n: number, r: number, start = -90) =>
  Array.from({ length: n }, (_, i) => {
    const a = start + (360 / n) * i;
    const t = (a * Math.PI) / 180;
    return [r * Math.cos(t), r * Math.sin(t), a] as const;
  });

/** A gradient across the shape (it turns with the shape when the shape spins). */
const Grad = ({ id, stops }: { id: string; stops: string[] }) => (
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
    {stops.map((c, i) => (
      <stop key={i} offset={stops.length === 1 ? 0 : i / (stops.length - 1)} stopColor={c} />
    ))}
  </linearGradient>
);

const Glow = ({ id, blur = 2.5 }: { id: string; blur?: number }) => (
  <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation={blur} />
  </filter>
);

/** A comet: a bright head with a fading tail, going round at radius 55 (spin it). */
const Comet = ({ color, length = 0.42, width = 5 }: { color: string; length?: number; width?: number }) => (
  <>
    {[1, 0.6, 0.3].map((k, i) => {
      const len = C * length * [0.25, 0.55, 1][i];
      return (
        <circle
          key={i}
          r="55"
          fill="none"
          stroke={color}
          strokeWidth={width * [1, 0.85, 0.65][i]}
          strokeLinecap="round"
          opacity={k}
          strokeDasharray={`${len} ${C}`}
          strokeDashoffset={-(C * length - len)}
        />
      );
    })}
  </>
);

/** A four-point star. */
const Star = ({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) => (
  <path d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`} fill={fill} />
);

const FRAMES: Record<AvatarFrameId, (k: string) => ReactNode> = {
  admin: adminLite,
  // ───────── Still ─────────
  classic: () => (
    <>
      <circle r="55.5" fill="none" stroke="#7a0b0b" strokeWidth="6" />
      <circle r="55.5" fill="none" stroke="#ec952a" strokeWidth="1.6" />
      <circle r="51.5" fill="none" stroke="#f5b562" strokeOpacity="0.55" strokeWidth="1" />
    </>
  ),
  rose: (k) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#f7d7c4', '#b76e79', '#f4c2c2', '#9e5662', '#f7d7c4']} />
      </defs>
      <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="5.5" />
      <circle r="58.6" fill="none" stroke="#fde4d8" strokeOpacity="0.5" strokeWidth="0.8" />
    </>
  ),
  bronze: (k) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#e3a46b', '#8c5523', '#cd7f32', '#6b3e17', '#e3a46b']} />
      </defs>
      <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="7" />
      {around(8, 55.5).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill="#ffd9b0" opacity="0.9" />
      ))}
    </>
  ),
  silver: (k) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#ffffff', '#9aa5b1', '#e4e8ec', '#7b8794', '#f5f7fa']} />
      </defs>
      <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="7" />
      <circle r="55.5" fill="none" stroke="#5f6b78" strokeWidth="7" strokeDasharray="0.9 6.3" opacity="0.45" />
      <circle r="59.4" fill="none" stroke="#e4e8ec" strokeOpacity="0.6" strokeWidth="0.8" />
    </>
  ),
  gold: (k) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#fff1b8', '#d4a017', '#ffd966', '#a87b05', '#fff1b8']} />
      </defs>
      <circle r="54" fill="none" stroke={`url(#${k}g)`} strokeWidth="4.5" />
      {/* Laurel: leaves up both sides from the bottom. */}
      {[1, -1].map((side) =>
        Array.from({ length: 7 }, (_, i) => {
          const a = 90 + side * (14 + i * 17);
          const t = (a * Math.PI) / 180;
          return (
            <ellipse
              key={`${side}${i}`}
              cx={58 * Math.cos(t)}
              cy={58 * Math.sin(t)}
              rx="2.4"
              ry="5.4"
              fill={i % 2 ? '#ffd966' : '#d4a017'}
              transform={`rotate(${a + side * 35} ${58 * Math.cos(t)} ${58 * Math.sin(t)})`}
            />
          );
        }),
      )}
    </>
  ),
  platinum: (k) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#f8fbff', '#b9c6d6', '#eef3fa', '#8fa0b5', '#f8fbff']} />
      </defs>
      <circle r="53.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="3" />
      <circle r="58" fill="none" stroke={`url(#${k}g)`} strokeWidth="2" />
      {around(4, 55.8, -90).map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 5}L${x + 3.6} ${y}L${x} ${y + 5}L${x - 3.6} ${y}Z`} fill="#e0f2ff" stroke="#8fd3ff" strokeWidth="0.8" />
      ))}
    </>
  ),

  // ───────── Moving ─────────
  aurora: (k) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#00e5a0', '#00b3ff', '#9b5cff', '#ff5ccb', '#00e5a0']} />
        <Glow id={`${k}b`} blur={3} />
      </defs>
      <g className="avf-spin-rev" style={{ ['--d' as string]: '14s' }}>
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="8" filter={`url(#${k}b)`} opacity="0.7" />
      </g>
      <g className="avf-spin" style={{ ['--d' as string]: '8s' }}>
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="4.5" />
      </g>
    </>
  ),
  ocean: (k) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#023e8a', '#00b4d8', '#90e0ef', '#0077b6', '#023e8a']} />
      </defs>
      {[0, 1.5].map((delay) => (
        <circle key={delay} className="avf-ripple" style={{ animationDelay: `${delay}s` }} r="55.5" fill="none" stroke="#48cae4" strokeWidth="1.6" />
      ))}
      <g className="avf-spin" style={{ ['--d' as string]: '10s' }}>
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="5" />
      </g>
    </>
  ),
  orbit: () => (
    <>
      <circle r="56" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.4" />
      <g className="avf-spin" style={{ ['--d' as string]: '5s' }}>
        {[-26, -17, -9].map((a, i) => {
          const t = ((a - 90) * Math.PI) / 180;
          return <circle key={a} cx={56 * Math.cos(t)} cy={56 * Math.sin(t)} r={1.2 + i * 0.7} fill="#ffd166" opacity={0.2 + i * 0.22} />;
        })}
        <circle cx="0" cy="-56" r="5" fill="#ffd166" />
        <circle cx="0" cy="-56" r="8" fill="#ffd166" opacity="0.25" />
      </g>
    </>
  ),
  sakura: () => (
    <>
      <circle r="55.5" fill="none" stroke="#ffb7d5" strokeWidth="2.6" />
      <g className="avf-spin" style={{ ['--d' as string]: '22s' }}>
        {around(6, 56).map(([x, y, a], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${a + 90})`}>
            <g className="avf-sway" style={{ animationDelay: `${-i * 0.6}s` }}>
              {[0, 72, 144, 216, 288].map((r) => (
                <ellipse key={r} cx="0" cy="-2.6" rx="1.7" ry="2.8" fill={i % 2 ? '#ffd1e3' : '#ff9ec4'} transform={`rotate(${r})`} />
              ))}
              <circle r="0.9" fill="#fff3a8" />
            </g>
          </g>
        ))}
      </g>
    </>
  ),
  neon: (k) => (
    <>
      <defs>
        <Glow id={`${k}b`} blur={2.6} />
      </defs>
      <g className="avf-hum">
        <circle r="55.5" fill="none" stroke="#22e4ff" strokeWidth="6" filter={`url(#${k}b)`} />
        <circle r="55.5" fill="none" stroke="#d9fbff" strokeWidth="2" />
      </g>
    </>
  ),
  ember: (k) => (
    <>
      <defs>
        <Glow id={`${k}b`} blur={2.4} />
      </defs>
      <circle r="55" fill="none" stroke="#ff6d00" strokeOpacity="0.3" strokeWidth="3" />
      <g className="avf-spin" style={{ ['--d' as string]: '2.6s' }}>
        <g filter={`url(#${k}b)`}>
          <Comet color="#ff3d00" length={0.5} width={7} />
        </g>
        <Comet color="#ffb300" length={0.42} width={4} />
      </g>
    </>
  ),
  thunder: (k) => (
    <>
      <defs>
        <Glow id={`${k}b`} blur={2} />
      </defs>
      <circle r="55.5" fill="none" stroke="#ffd600" strokeWidth="2.6" />
      <circle r="55.5" fill="none" stroke="#fff176" strokeWidth="5" opacity="0.35" filter={`url(#${k}b)`} />
      {around(3, 56, -60).map(([x, y, a], i) => (
        <g key={i} className="avf-flash" style={{ animationDelay: `${i * 0.7}s` }} transform={`translate(${x} ${y}) rotate(${a + 90})`}>
          <path d="M-1.5 -8L3 -1.5L-0.5 -0.5L2 8L-3.5 0.5L0 -0.5Z" fill="#fffde7" stroke="#ffd600" strokeWidth="0.8" strokeLinejoin="round" />
        </g>
      ))}
    </>
  ),
  heartbeat: (k) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#ff4d8d', '#ff8fab', '#ff2e63', '#ff4d8d']} />
        <Glow id={`${k}b`} blur={2.5} />
      </defs>
      <g className="avf-beat">
        <circle r="55.5" fill="none" stroke="#ff4d8d" strokeWidth="6" opacity="0.45" filter={`url(#${k}b)`} />
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="4" />
        <path d="M0 62.5C-7 57.5-9 53.5-6 50.8C-4 49-1.6 49.6 0 51.6C1.6 49.6 4 49 6 50.8C9 53.5 7 57.5 0 62.5Z" fill="#ff2e63" stroke="#ffd1dc" strokeWidth="0.8" />
      </g>
    </>
  ),
  leaf: () => (
    <>
      <circle r="55.5" fill="none" stroke="#166534" strokeWidth="2.4" />
      <g className="avf-spin" style={{ ['--d' as string]: '28s' }}>
        {around(12, 55.5).map(([x, y, a], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${a + (i % 2 ? 140 : 40)})`}>
            <path d="M0 0C2.6 -2.2 6.4 -2.2 8.6 0C6.4 2.2 2.6 2.2 0 0Z" fill={i % 3 ? '#4ade80' : '#22c55e'} />
          </g>
        ))}
      </g>
    </>
  ),
  sparkle: () => (
    <>
      <circle r="55.5" fill="none" stroke="#e5e7eb" strokeOpacity="0.55" strokeWidth="1.6" />
      <g className="avf-spin" style={{ ['--d' as string]: '30s' }}>
        {around(7, 56, -80).map(([x, y], i) => (
          <g key={i} className="avf-twinkle" style={{ animationDelay: `${-i * 0.45}s` }}>
            <Star x={x} y={y} s={i % 2 ? 3.6 : 5} fill={i % 3 ? '#ffffff' : '#fff3a8'} />
          </g>
        ))}
      </g>
    </>
  ),
  rainbow: (k) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#ff004d', '#ff9a00', '#ffe600', '#2bff88', '#00c8ff', '#7b5cff', '#ff00c8']} />
        <Glow id={`${k}b`} blur={2.6} />
      </defs>
      <g className="avf-spin" style={{ ['--d' as string]: '6s' }}>
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="7" opacity="0.6" filter={`url(#${k}b)`} />
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="4" />
      </g>
    </>
  ),
  halo: (k) => (
    <>
      <defs>
        <Glow id={`${k}b`} blur={1.8} />
      </defs>
      <circle r="55" fill="none" stroke="#ffe08a" strokeOpacity="0.55" strokeWidth="1.4" />
      <g className="avf-float">
        <ellipse cx="0" cy="-57" rx="23" ry="5" fill="none" stroke="#ffd166" strokeWidth="4" opacity="0.6" filter={`url(#${k}b)`} />
        <ellipse cx="0" cy="-57" rx="23" ry="5" fill="none" stroke="#fff1b8" strokeWidth="2" />
      </g>
    </>
  ),
  galaxy: (k) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#1a0b3d', '#5b21b6', '#c026d3', '#1e3a8a', '#1a0b3d']} />
      </defs>
      <g className="avf-spin" style={{ ['--d' as string]: '14s' }}>
        <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="7" />
      </g>
      <g className="avf-spin-rev" style={{ ['--d' as string]: '40s' }}>
        {around(9, 56, -70).map(([x, y], i) => (
          <circle key={i} className="avf-twinkle" style={{ animationDelay: `${-i * 0.37}s` }} cx={x} cy={y} r={i % 3 ? 0.9 : 1.5} fill={i % 2 ? '#e9d5ff' : '#ffffff'} />
        ))}
      </g>
    </>
  ),
  philrads: (k) => (
    <>
      <defs>
        <Glow id={`${k}b`} blur={2.4} />
      </defs>
      <circle className="avf-hum" r="55.5" fill="none" stroke="#7a0b0b" strokeWidth="8" filter={`url(#${k}b)`} />
      <circle r="55.5" fill="none" stroke="#7a0b0b" strokeWidth="5" />
      <g className="avf-spin" style={{ ['--d' as string]: '3.2s' }}>
        <Comet color="#ec952a" length={0.35} width={3.6} />
      </g>
      <g className="avf-spin" style={{ ['--d' as string]: '3.2s', animationDelay: '-1.6s' }}>
        <Comet color="#f5b562" length={0.2} width={2.4} />
      </g>
    </>
  ),
};
