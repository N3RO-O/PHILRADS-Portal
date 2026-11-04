import { between, Blur, Comet, Gem, GlowFilter, Grad, polar, seeded, Sparkle, timing, wavy, type Vars } from './avatarFrameKit';

/**
 * PHILRADS Admin: for administrators only (the database refuses it to anyone else). Burgundy
 * velvet between two gold rims, gold filigree, rubies and diamonds in gold settings, a crown at
 * the top and the PHILRADS cross on a medallion below. The motion is quiet: a sheen gliding over
 * the gold, the gems catching the light, gold dust rising.
 */

const f1 = (n: number) => n.toFixed(1);
const GOLD = ['#fff6d5', '#e9b949', '#fbe39a', '#a87b05', '#ffefb0', '#c8961a'];
const RUBY = { light: '#ff9a9a', mid: '#d61f2c', dark: '#6e0610' };
const DIAMOND = { light: '#ffffff', mid: '#e0f2fe', dark: '#93c5fd' };

/** Twelve settings: rubies at the four quarters, diamonds between. The top one sits under the crown. */
const SETTINGS = Array.from({ length: 12 }, (_, i) => ({ a: i * 30 - 90, ruby: i % 3 === 0 })).filter((s) => s.a !== -90);

const GLINTS = (() => {
  const rnd = seeded(131);
  return SETTINGS.map(() => ({ s: between(rnd, 2.6, 4.2), style: timing(rnd, 2.2, 4.4) }));
})();
const DUST = (() => {
  const rnd = seeded(132);
  return Array.from({ length: 16 }, () => {
    const [x, y] = polar(between(rnd, 56, 62), between(rnd, -200, 20));
    return {
      x,
      y,
      r: between(rnd, 0.35, 0.9),
      style: { '--dx': `${f1(between(rnd, -4, 4))}px`, '--dy': `${f1(-between(rnd, 10, 20))}px`, ...timing(rnd, 2.8, 5) } as Vars,
    };
  });
})();

const CROWN = 'M-11 0L-12.5 -9L-7 -4.6L-6 -11L-2.6 -5L0 -13L2.6 -5L6 -11L7 -4.6L12.5 -9L11 0Z';
const CROSS = (s: number) => `M${-s * 0.3} ${-s}H${s * 0.3}V${-s * 0.3}H${s}V${s * 0.3}H${s * 0.3}V${s}H${-s * 0.3}V${s * 0.3}H${-s}V${-s * 0.3}H${-s * 0.3}Z`;

/** A gold rim with its bevel. */
const Rim = ({ k, r, w }: { k: string; r: number; w: number }) => (
  <>
    <circle r={r} fill="none" stroke={`url(#${k}g)`} strokeWidth={w} />
    <circle r={r + w / 2 - 0.3} fill="none" stroke="#fffbea" strokeOpacity="0.8" strokeWidth="0.4" />
    <circle r={r - w / 2 + 0.3} fill="none" stroke="#5c4300" strokeOpacity="0.7" strokeWidth="0.4" />
  </>
);

const Defs = ({ k }: { k: string }) => (
  <defs>
    <Grad id={`${k}g`} stops={GOLD} />
    <Grad id={`${k}v`} stops={['#8b0f12', '#4a0505', '#a3161a', '#3a0303', '#8b0f12']} flip />
    <linearGradient id={`${k}c`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff6d5" />
      <stop offset="0.45" stopColor="#e9b949" />
      <stop offset="1" stopColor="#8a6400" />
    </linearGradient>
    <radialGradient id={`${k}p`} cx="0.35" cy="0.35" r="0.65">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="0.7" stopColor="#f5ede0" />
      <stop offset="1" stopColor="#c9b8a0" />
    </radialGradient>
    <Blur id={`${k}b`} d={3} />
    <GlowFilter id={`${k}w`} d={0.9} />
  </defs>
);

const Crown = ({ k }: { k: string }) => (
  <g transform="translate(0 -59.8) scale(1.2)">
    <path d={CROWN} fill={`url(#${k}c)`} stroke="#6b4e00" strokeWidth="0.5" strokeLinejoin="round" />
    <path d="M-9.4 -1.6L-10.4 -7M-5 -2.2L-5.4 -8.4M5 -2.2L5.4 -8.4M9.4 -1.6L10.4 -7" stroke="#fff6d5" strokeOpacity="0.6" strokeWidth="0.4" />
    <rect x="-11.4" y="-2.8" width="22.8" height="3.4" rx="0.8" fill={`url(#${k}g)`} stroke="#6b4e00" strokeWidth="0.45" />
    {[-12.5, -6, 6, 12.5].map((x, i) => (
      <circle key={x} cx={x} cy={[-9, -11, -11, -9][i]} r="1.15" fill={`url(#${k}p)`} />
    ))}
    {[-7.4, 7.4].map((x) => (
      <g key={x} transform={`translate(${x} -1.1)`}>
        <Gem s={1.3} {...DIAMOND} />
      </g>
    ))}
    <g transform="translate(0 -1.1)">
      <Gem s={1.8} {...RUBY} />
    </g>
    <g transform="translate(0 -15.2)">
      <path d={CROSS(2.4)} fill="#ffffff" stroke="#a87b05" strokeWidth="0.45" />
    </g>
  </g>
);

const Medallion = ({ k }: { k: string }) => (
  <g transform="translate(0 59)">
    <circle r="6.6" fill={`url(#${k}v)`} stroke={`url(#${k}g)`} strokeWidth="1.5" />
    <circle r="5" fill="none" stroke="#e9b949" strokeOpacity="0.6" strokeWidth="0.35" />
    <path d={CROSS(3.2)} fill="#ffffff" />
  </g>
);

export const admin = (k: string) => (
  <>
    <Defs k={k} />
    {/* Aura: gold and burgundy, breathing */}
    <circle className="avf-hum" r="57" fill="none" stroke="#b91c1c" strokeWidth="13" opacity="0.4" filter={`url(#${k}b)`} />
    <circle className="avf-hum" r="60.5" fill="none" stroke="#e9b949" strokeWidth="5" opacity="0.35" filter={`url(#${k}b)`} style={{ animationDelay: '-1.6s' }} />
    {/* Velvet band and its gold filigree */}
    <circle r="56" fill="none" stroke={`url(#${k}v)`} strokeWidth="7.4" />
    <path d={wavy(56, 1.7, 18)} fill="none" stroke="#e9b949" strokeOpacity="0.75" strokeWidth="0.55" />
    <path d={wavy(56, 1.7, 18, Math.PI)} fill="none" stroke="#e9b949" strokeOpacity="0.75" strokeWidth="0.55" />
    {Array.from({ length: 36 }, (_, i) => {
      const [x, y] = polar(56, i * 10 + 5);
      return <circle key={i} cx={f1(x)} cy={f1(y)} r="0.45" fill="#fbe39a" />;
    })}
    {/* Gold rims */}
    <Rim k={k} r={60.4} w={2.6} />
    <Rim k={k} r={51.7} w={2.2} />
    {/* Sheen gliding over the gold */}
    <g className="avf-spin" style={{ '--d': '6s' } as Vars}>
      <g transform="scale(1.098)">
        <Comet color="#ffffff" length={0.1} width={2} />
      </g>
    </g>
    <g className="avf-spin-rev" style={{ '--d': '9s' } as Vars}>
      <g transform="scale(0.94)">
        <Comet color="#ffffff" length={0.08} width={1.6} />
      </g>
    </g>
    {/* Gems in their settings */}
    {SETTINGS.map((s) => {
      const [x, y] = polar(56, s.a);
      return (
        <g key={s.a} transform={`translate(${f1(x)} ${f1(y)})`}>
          <circle r={s.ruby ? 3.9 : 3} fill={`url(#${k}g)`} stroke="#6b4e00" strokeWidth="0.4" />
          {Array.from({ length: s.ruby ? 8 : 6 }, (_, j) => {
            const [px, py] = polar(s.ruby ? 3.9 : 3, (360 / (s.ruby ? 8 : 6)) * j);
            return <circle key={j} cx={f1(px)} cy={f1(py)} r="0.5" fill="#fff6d5" />;
          })}
          <Gem s={s.ruby ? 3.2 : 2.4} {...(s.ruby ? RUBY : DIAMOND)} />
        </g>
      );
    })}
    <Crown k={k} />
    <Medallion k={k} />
    {/* Light catching the gems */}
    <g filter={`url(#${k}w)`}>
      {SETTINGS.map((s, i) => {
        const [x, y] = polar(56, s.a);
        return (
          <g key={s.a} transform={`translate(${f1(x + 1.2)} ${f1(y - 1.2)})`}>
            <g className="avf-twinkle" style={GLINTS[i].style}>
              <Sparkle s={GLINTS[i].s} fill="#ffffff" />
            </g>
          </g>
        );
      })}
      <g transform="translate(4 -73)">
        <g className="avf-twinkle" style={{ animationDuration: '3.2s' }}>
          <Sparkle s={3.6} fill="#fff6d5" />
        </g>
      </g>
      {/* Gold dust */}
      {DUST.map((d, i) => (
        <g key={i} transform={`translate(${f1(d.x)} ${f1(d.y)})`}>
          <circle className="avp-bubble" r={d.r.toFixed(2)} fill="#fbe39a" style={d.style} />
        </g>
      ))}
    </g>
  </>
);

/** Small pictures in lists: the rims, the velvet, four rubies and the crown, with the sheen. */
export const adminLite = (k: string) => (
  <>
    <Defs k={k} />
    <circle r="56" fill="none" stroke={`url(#${k}v)`} strokeWidth="7.4" />
    <Rim k={k} r={60.4} w={2.8} />
    <Rim k={k} r={51.7} w={2.4} />
    <g className="avf-spin" style={{ '--d': '6s' } as Vars}>
      <g transform="scale(1.098)">
        <Comet color="#ffffff" length={0.12} width={2.4} />
      </g>
    </g>
    {[0, 90, 180].map((a) => {
      const [x, y] = polar(56, a);
      return (
        <g key={a} transform={`translate(${f1(x)} ${f1(y)})`}>
          <circle r="4" fill={`url(#${k}g)`} />
          <Gem s={3.3} {...RUBY} />
        </g>
      );
    })}
    <Crown k={k} />
  </>
);
