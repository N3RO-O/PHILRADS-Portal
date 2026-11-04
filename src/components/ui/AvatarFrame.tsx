import type { ReactNode } from 'react';
import { isAvatarFrame } from '../../lib/avatarFrames';

/** A picture in its chosen frame (src/lib/avatarFrames.ts). No frame, or an unknown one: just the picture. */
export function AvatarFrame({ frame, children }: { frame: string | null | undefined; children: ReactNode }) {
  if (!isAvatarFrame(frame)) return <>{children}</>;
  return (
    <span className="av-framed">
      {children}
      <span aria-hidden className={`av-frame f-${frame}`} />
    </span>
  );
}
