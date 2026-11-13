import { useId, type CSSProperties } from 'react';
import { STATUS_META, type Status } from '../../lib/presence';

/**
 * Discord-style status: a green dot (online), a yellow moon (idle), a red dot with a bar (do not
 * disturb) or a grey ring (offline). The moon's bite, the bar and the hole are real cut-outs.
 *
 * `ring`: a colour drawn around the dot to cut it out of what's under it. "none" draws no ring;
 * <StatusAvatar> uses that, since it cuts a see-through notch in the picture itself.
 * `gap`: the ring's width (by default about a sixth of the size, at least 2 px).
 */
export function StatusDot({
  status,
  size = 16,
  ring = 'rgb(var(--page))',
  gap,
  className = '',
  style,
}: {
  status: Status;
  size?: number;
  ring?: string;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const id = `sd${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const c = STATUS_META[status].color;
  const r = size / 2;
  const inner = r - (gap ?? Math.max(2, size * 0.16)); // the dot inside the ring
  return (
    <span className={`inline-block ${className}`} style={{ width: size, height: size, ...style }} title={STATUS_META[status].label} role="img" aria-label={STATUS_META[status].label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="block">
        <mask id={id}>
          <rect width={size} height={size} fill="#fff" />
          {/* The moon's bite. */}
          {status === 'idle' && <circle cx={r - inner * 0.45} cy={r - inner * 0.45} r={inner * 0.62} fill="#000" />}
          {status === 'dnd' && <rect x={r - inner * 0.62} y={r - inner * 0.18} width={inner * 1.24} height={inner * 0.36} rx={inner * 0.18} fill="#000" />}
          {status === 'offline' && <circle cx={r} cy={r} r={inner * 0.45} fill="#000" />}
        </mask>
        {ring !== 'none' && <circle cx={r} cy={r} r={r} style={{ fill: ring }} />}
        <circle cx={r} cy={r} r={inner} fill={c} mask={`url(#${id})`} />
      </svg>
    </span>
  );
}
