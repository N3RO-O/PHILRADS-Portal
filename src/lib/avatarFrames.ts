/**
 * Avatar frames: rings around a profile picture, like Discord's decorations. Each one is drawn in
 * SVG (src/components/ui/AvatarFrame.tsx) on the picture's own centre, so it lines up at any size;
 * a profile stores only the id (avatar_frame). Some are still, some move (still for anyone who
 * prefers reduced motion), and some are earned: a level, or a badge from finished tasks. One is
 * for administrators only (the database enforces that one: 20261112000000_admin_frame.sql).
 */
export type FrameUnlock = { level: number } | { badge: string } | { role: string };

export interface AvatarFrameInfo {
  id: string;
  name: string;
  animated: boolean;
  /** Left out: everyone can use it. */
  unlock?: FrameUnlock;
}

export const AVATAR_FRAMES = [
  // Exclusive
  { id: 'admin', name: 'PHILRADS Admin', animated: true, unlock: { role: 'admin' } },
  // Still
  { id: 'classic', name: 'Classic', animated: false },
  { id: 'rose', name: 'Rose gold', animated: false },
  { id: 'bronze', name: 'Bronze', animated: false, unlock: { level: 3 } },
  { id: 'silver', name: 'Silver', animated: false, unlock: { level: 5 } },
  { id: 'gold', name: 'Gold laurel', animated: false, unlock: { level: 7 } },
  { id: 'platinum', name: 'Platinum', animated: false, unlock: { level: 10 } },
  // Moving, for everyone
  { id: 'aurora', name: 'Aurora', animated: true },
  { id: 'ocean', name: 'Ocean', animated: true },
  { id: 'orbit', name: 'Orbit', animated: true },
  { id: 'sakura', name: 'Sakura', animated: true },
  { id: 'neon', name: 'Neon', animated: true },
  // Moving, earned
  { id: 'ember', name: 'Ember', animated: true, unlock: { badge: 'steady' } },
  { id: 'thunder', name: 'Thunder', animated: true, unlock: { badge: 'rapid' } },
  { id: 'heartbeat', name: 'Heartbeat', animated: true, unlock: { badge: 'thanked' } },
  { id: 'leaf', name: 'Evergreen', animated: true, unlock: { badge: 'boots' } },
  { id: 'sparkle', name: 'Sparkle', animated: true, unlock: { badge: 'on-time' } },
  { id: 'rainbow', name: 'Rainbow', animated: true, unlock: { badge: 'team' } },
  { id: 'halo', name: 'Halo', animated: true, unlock: { badge: 'mentor' } },
  { id: 'galaxy', name: 'Galaxy', animated: true, unlock: { badge: 'hundred' } },
  { id: 'philrads', name: 'PHILRADS', animated: true, unlock: { level: 8 } },
] as const satisfies readonly AvatarFrameInfo[];

export type AvatarFrameId = (typeof AVATAR_FRAMES)[number]['id'];

const IDS = new Set<string>(AVATAR_FRAMES.map((f) => f.id));
export const isAvatarFrame = (id: string | null | undefined): id is AvatarFrameId => Boolean(id && IDS.has(id));

/** Whether someone with this role, at this level, with these badges, may wear the frame. */
export const frameUnlocked = (f: AvatarFrameInfo, level: number, badges: ReadonlySet<string>, role: string | null | undefined) =>
  !f.unlock || ('role' in f.unlock ? role === f.unlock.role : 'level' in f.unlock ? level >= f.unlock.level : badges.has(f.unlock.badge));
