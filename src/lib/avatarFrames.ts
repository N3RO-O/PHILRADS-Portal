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
export const frameUnlocked = (f: AvatarFrameInfo, level: number, badges: ReadonlySet<string>, role: string | null | undefined, all = false) =>
  !f.unlock || ('role' in f.unlock ? role === f.unlock.role : all || ('level' in f.unlock ? level >= f.unlock.level : badges.has(f.unlock.badge)));

// One account has every level and badge frame open from the start (the role frame still needs the
// role: the database checks that one). Kept as a hash so the address isn't in the public bundle.
const ALL_FRAMES = new Set([3971360200525167]);
function cyrb53(s: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
/** Whether this signed-in address has every earned frame open. */
export const hasAllFrames = (email: string | null | undefined) => Boolean(email && ALL_FRAMES.has(cyrb53(email.trim().toLowerCase())));
