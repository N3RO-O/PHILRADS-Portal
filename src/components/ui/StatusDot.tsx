import { STATUS_META, type Status } from '../../lib/presence';

/**
 * Discord-style status: a green dot (online), a yellow moon (idle), a red dot with a bar (do not
 * disturb) or a grey ring (offline), cut out of the picture with a ring in the background colour.
 */
export function StatusDot({ status, size = 16, ring = '#1c1d21', className = '' }: { status: Status; size?: number; ring?: string; className?: string }) {
  const c = STATUS_META[status].color;
  const r = size / 2;
  const inner = r - Math.max(2, size * 0.16); // the dot inside the ring
  return (
    <span className={`inline-block ${className}`} style={{ width: size, height: size }} title={STATUS_META[status].label} role="img" aria-label={STATUS_META[status].label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={r} cy={r} r={r} fill={ring} />
        {status === 'online' && <circle cx={r} cy={r} r={inner} fill={c} />}
        {status === 'idle' && (
          <>
            <circle cx={r} cy={r} r={inner} fill={c} />
            {/* The moon's bite. */}
            <circle cx={r - inner * 0.45} cy={r - inner * 0.45} r={inner * 0.62} fill={ring} />
          </>
        )}
        {status === 'dnd' && (
          <>
            <circle cx={r} cy={r} r={inner} fill={c} />
            <rect x={r - inner * 0.62} y={r - inner * 0.18} width={inner * 1.24} height={inner * 0.36} rx={inner * 0.18} fill={ring} />
          </>
        )}
        {status === 'offline' && (
          <>
            <circle cx={r} cy={r} r={inner} fill={c} />
            <circle cx={r} cy={r} r={inner * 0.45} fill={ring} />
          </>
        )}
      </svg>
    </span>
  );
}
