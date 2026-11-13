import type { ReactNode } from 'react';
import type { Status } from '../../lib/presence';
import { StatusDot } from './StatusDot';

/** Where the dot sits: on the picture's edge, at the bottom-right (45°), as a share of its size. */
const EDGE = 0.5 + 0.5 * Math.SQRT1_2;

/**
 * A picture (with or without its avatar frame) and its status dot, the way Discord draws it: the
 * dot sits on the bottom-right of the picture and cuts a clean, see-through notch out of the
 * picture and the frame, so it never covers the frame's art and whatever is behind shows in the
 * gap (light or dark, a hovered row, a banner).
 *
 * `size`: the picture's size in px (Avatar sizes: xs 20, sm 32, md 40, lg 56, xl 112). The dot
 * grows with it, a little larger in proportion on small pictures so it stays readable.
 */
export function StatusAvatar({ status, size, children, className = '' }: { status: Status; size: number; children: ReactNode; className?: string }) {
  const dot = Math.round(Math.min(28, Math.max(8, size * 0.2 + 4))); // the coloured dot
  const gap = Math.max(2, Math.round(dot * 0.22)); // the clear space around it
  const notch = dot / 2 + gap;
  // The mask covers the frame and rings drawn outside the picture (frames reach 14% out).
  const pad = Math.ceil(size * 0.16) + 4;
  const at = pad + size * EDGE;
  const mask = `radial-gradient(circle at ${at}px ${at}px, transparent ${notch}px, #000 ${notch + 0.75}px)`;
  return (
    <span className={`relative inline-grid shrink-0 ${className}`}>
      <span className="inline-grid" style={{ margin: -pad, padding: pad, WebkitMaskImage: mask, maskImage: mask }}>
        {children}
      </span>
      <StatusDot
        status={status}
        size={notch * 2}
        gap={gap}
        ring="none"
        className="pointer-events-none absolute"
        style={{ left: size * EDGE - notch, top: size * EDGE - notch }}
      />
    </span>
  );
}
