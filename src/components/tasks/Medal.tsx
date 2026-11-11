import type { CSSProperties } from 'react';
import { Lock } from 'lucide-react';
import type { Badge } from '../../lib/taskProgress';
import { BADGE_ICON } from './taskMeta';

const SIZE = { sm: 'medal-sm', md: 'medal-md', lg: 'medal-lg', xl: 'medal-xl' } as const;

/**
 * A badge as a medal: a metal rim in its rarity's colour (Common steel, Rare blue, Epic purple,
 * Legendary gold) around a dark face with the badge's icon. Epic and Legendary medals catch a
 * moving shine (none for people who turn motion off). A badge not earned yet is a grey disc with a
 * lock, ringed by how far along the person is. Styles are in src/index.css (Badges).
 */
export function Medal({ badge, earned, value = 0, size = 'md', className = '' }: { badge: Badge; earned: boolean; value?: number; size?: keyof typeof SIZE; className?: string }) {
  const Icon = BADGE_ICON[badge.icon];
  const shine = earned && (badge.rarity === 'epic' || badge.rarity === 'legendary');
  const style = earned ? undefined : ({ '--medal-progress': `${Math.min(100, Math.round((value / badge.target) * 100))}%` } as CSSProperties);
  return (
    <span className={`medal medal-${badge.rarity} ${SIZE[size]} ${earned ? '' : 'medal-locked'} ${shine ? 'medal-shine' : ''} ${className}`} style={style} aria-hidden>
      <span className="medal-face">{earned ? <Icon /> : <Lock />}</span>
    </span>
  );
}
