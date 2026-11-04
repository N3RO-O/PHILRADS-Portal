import type { ReactNode } from 'react';
import { Band, Gem, Grad, polar } from './avatarFrameKit';

/**
 * The still frames, in full detail: metal and stone, no motion. Bevels (a light edge outside, a
 * dark one inside) and a fixed highlight from the top left make them read as solid objects.
 */

/** A fixed highlight on the upper left of the ring, like light on polished metal. */
const Shine = ({ r = 55.5, w = 5, opacity = 0.55 }: { r?: number; w?: number; opacity?: number }) => {
  const c = 2 * Math.PI * r;
  return (
    <circle
      r={r}
      fill="none"
      stroke="#ffffff"
      strokeOpacity={opacity}
      strokeWidth={w * 0.35}
      strokeLinecap="round"
      strokeDasharray={`${c * 0.12} ${c}`}
      transform="rotate(-150)"
    />
  );
};

export const STILL_FRAMES = {
  /** PHILRADS burgundy with a gold inlay, gold studs and a small cross at the top. */
  classic: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}b`} stops={['#a3161a', '#5c0606', '#8b0f12', '#4a0505', '#a3161a']} />
        <Grad id={`${k}g`} stops={['#ffe3a3', '#ec952a', '#f5b562', '#b86e14']} />
      </defs>
      <Band fill={`url(#${k}b)`} w={8} light="#ff8a80" />
      <circle r="55.5" fill="none" stroke={`url(#${k}g)`} strokeWidth="1.4" />
      <Shine w={8} opacity={0.3} />
      {[0, 90, 180, 270].map((a) => {
        const [x, y] = polar(55.5, a);
        return (
          <g key={a} transform={`translate(${x} ${y})`}>
            <circle r="2.6" fill={`url(#${k}g)`} stroke="#5c0606" strokeWidth="0.5" />
            <circle cx="-0.7" cy="-0.7" r="0.8" fill="#fff6dd" />
          </g>
        );
      })}
      <g transform="translate(0 -55.5)">
        <circle r="5.2" fill="#5c0606" stroke={`url(#${k}g)`} strokeWidth="1.2" />
        <path d="M-1 -3.4H1V-1H3.4V1H1V3.4H-1V1H-3.4V-1H-1Z" fill="#ffffff" />
      </g>
    </>
  ),

  /** Rose gold with a string of pearls round the outside. */
  rose: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#fbe3d6', '#c98b8f', '#f4c2c2', '#9e5662', '#f7d7c4']} />
        <radialGradient id={`${k}p`} cx="0.35" cy="0.35" r="0.65">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#fbe8ef" />
          <stop offset="1" stopColor="#d9b3c0" />
        </radialGradient>
      </defs>
      <Band fill={`url(#${k}g)`} r={54.5} w={5} light="#fff1ea" dark="#6b2f38" />
      <Shine r={54.5} w={5} />
      {Array.from({ length: 30 }, (_, i) => {
        const [x, y] = polar(59.2, (360 / 30) * i);
        return <circle key={i} cx={x} cy={y} r="1.75" fill={`url(#${k}p)`} stroke="#b98a99" strokeWidth="0.25" />;
      })}
    </>
  ),

  /** Hammered bronze, riveted, with tick marks between the rivets. */
  bronze: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#f0b97c', '#8c5523', '#d08a45', '#6b3e17', '#e3a46b']} />
        <radialGradient id={`${k}r`} cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffe2c2" />
          <stop offset="0.5" stopColor="#c47c3a" />
          <stop offset="1" stopColor="#5a3210" />
        </radialGradient>
      </defs>
      <Band fill={`url(#${k}g)`} w={8} light="#ffd9b0" dark="#3d2008" />
      {/* Hammer marks */}
      <circle r="55.5" fill="none" stroke="#3d2008" strokeOpacity="0.25" strokeWidth="6" strokeDasharray="1.2 2.6 0.6 3.4" />
      <Shine w={8} opacity={0.35} />
      {Array.from({ length: 12 }, (_, i) => {
        const [x, y] = polar(55.5, (360 / 12) * i);
        const [tx, ty] = polar(55.5, (360 / 12) * i + 15);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="1.9" fill={`url(#${k}r)`} stroke="#3d2008" strokeWidth="0.4" />
            <line x1={tx * 0.955} y1={ty * 0.955} x2={tx * 1.045} y2={ty * 1.045} stroke="#3d2008" strokeOpacity="0.55" strokeWidth="0.6" />
          </g>
        );
      })}
    </>
  ),

  /** Brushed silver with a knurled outer edge and engraved chevrons. */
  silver: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#ffffff', '#a7b1bc', '#eef1f4', '#7b8794', '#f5f7fa']} />
      </defs>
      <Band fill={`url(#${k}g)`} w={7} light="#ffffff" dark="#4b5563" />
      {/* Brushed lines */}
      <circle r="54.6" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.35" />
      <circle r="56.4" fill="none" stroke="#6b7280" strokeOpacity="0.3" strokeWidth="0.35" />
      {/* Knurled edge */}
      <circle r="60" fill="none" stroke="#cbd5e1" strokeWidth="1.6" strokeDasharray="0.7 0.9" />
      <Shine w={7} opacity={0.7} />
      {[45, 135, 225, 315].map((a) => {
        const [x, y] = polar(55.5, a);
        return (
          <g key={a} transform={`translate(${x} ${y}) rotate(${a + 90})`}>
            <path d="M-2.4 1.2L0 -1.2L2.4 1.2" fill="none" stroke="#4b5563" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M-2.4 0.5L0 -1.9L2.4 0.5" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.4" strokeLinecap="round" />
          </g>
        );
      })}
    </>
  ),

  /** A gold band with a laurel wreath up both sides, berries, and a ribbon at the bottom. */
  gold: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#fff1b8', '#d4a017', '#ffe08a', '#a87b05', '#fff1b8']} />
        <linearGradient id={`${k}l`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a87b05" />
          <stop offset="0.5" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#d4a017" />
        </linearGradient>
      </defs>
      <Band fill={`url(#${k}g)`} r={54} w={4.5} light="#fffbe6" dark="#5c4300" />
      <Shine r={54} w={4.5} opacity={0.75} />
      {[1, -1].map((side) => (
        <g key={side}>
          {Array.from({ length: 9 }, (_, i) => {
            const a = 90 + side * (16 + i * 16);
            const [x, y] = polar(58.2, a);
            const out = side * 38;
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${a + 90 + out})`}>
                <path d="M0 0C-2.4 -2 -2.4 -5.4 0 -7.4C2.4 -5.4 2.4 -2 0 0Z" fill={`url(#${k}l)`} stroke="#7a5a00" strokeWidth="0.35" />
                <path d="M0 -0.4V-6.6" stroke="#7a5a00" strokeOpacity="0.7" strokeWidth="0.35" />
              </g>
            );
          })}
          {[40, 88, 136].map((d) => {
            const [x, y] = polar(61.2, 90 + side * d);
            return <circle key={d} cx={x} cy={y} r="1.1" fill="#ffe08a" stroke="#a87b05" strokeWidth="0.3" />;
          })}
        </g>
      ))}
      {/* Ribbon */}
      <g transform="translate(0 58.5)">
        <path d="M-1.5 0L-7 5.5L-5 6.2L-3.6 4.4L-2.6 6.8Z M1.5 0L7 5.5L5 6.2L3.6 4.4L2.6 6.8Z" fill="#7a0b0b" />
        <ellipse rx="3" ry="2.2" fill="#a3161a" stroke="#ffe08a" strokeWidth="0.5" />
      </g>
    </>
  ),

  /** Two platinum bands with eight cut gems set between them, and fine beading. */
  platinum: (k: string) => (
    <>
      <defs>
        <Grad id={`${k}g`} stops={['#f8fbff', '#b9c6d6', '#eef3fa', '#8fa0b5', '#f8fbff']} />
      </defs>
      <circle r="55.8" fill="none" stroke="#1e293b" strokeOpacity="0.55" strokeWidth="6.5" />
      <Band fill={`url(#${k}g)`} r={52.8} w={2.4} light="#ffffff" dark="#475569" />
      <Band fill={`url(#${k}g)`} r={58.8} w={2.4} light="#ffffff" dark="#475569" />
      {Array.from({ length: 48 }, (_, i) => {
        const [x, y] = polar(55.8, (360 / 48) * i + 3.75);
        return i % 6 === 2 || i % 6 === 3 ? null : <circle key={i} cx={x} cy={y} r="0.55" fill="#e2e8f0" />;
      })}
      <Shine r={58.8} w={2.4} opacity={0.9} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (360 / 8) * i - 90;
        const [x, y] = polar(55.8, a);
        const big = i % 2 === 0;
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r={big ? 3.6 : 2.7} fill="#334155" stroke="#e2e8f0" strokeWidth="0.5" />
            <Gem s={big ? 3.2 : 2.4} light="#ffffff" mid="#bae6fd" dark="#60a5fa" />
          </g>
        );
      })}
    </>
  ),
} satisfies Record<string, (k: string) => ReactNode>;
