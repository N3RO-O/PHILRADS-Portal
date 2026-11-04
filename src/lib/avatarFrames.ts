/**
 * Avatar frames: animated rings around a profile picture, like Discord's decorations. Each one is
 * drawn in CSS (src/index.css, ".av-frame.f-<id>"); a profile stores only the id (avatar_frame).
 * Still for anyone who prefers reduced motion.
 */
export const AVATAR_FRAMES = [
  { id: 'ember', name: 'Ember' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'neon', name: 'Neon' },
  { id: 'sakura', name: 'Sakura' },
  { id: 'orbit', name: 'Orbit' },
  { id: 'twin', name: 'Twin moons' },
  { id: 'rainbow', name: 'Rainbow' },
  { id: 'ocean', name: 'Ocean' },
  { id: 'sunrise', name: 'Sunrise' },
  { id: 'frost', name: 'Frost' },
  { id: 'heartbeat', name: 'Heartbeat' },
  { id: 'sparkle', name: 'Sparkle' },
  { id: 'halo', name: 'Halo' },
  { id: 'thunder', name: 'Thunder' },
  { id: 'royal', name: 'Royal' },
  { id: 'radar', name: 'Radar' },
  { id: 'bubbles', name: 'Bubbles' },
  { id: 'leaf', name: 'Evergreen' },
  { id: 'galaxy', name: 'Galaxy' },
  { id: 'philrads', name: 'PHILRADS' },
] as const;

export type AvatarFrameId = (typeof AVATAR_FRAMES)[number]['id'];

const IDS = new Set<string>(AVATAR_FRAMES.map((f) => f.id));
export const isAvatarFrame = (id: string | null | undefined): id is AvatarFrameId => Boolean(id && IDS.has(id));
