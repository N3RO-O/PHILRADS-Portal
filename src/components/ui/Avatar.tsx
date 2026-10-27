interface AvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Profile picture (shown instead of the initials). */
  src?: string | null;
  /** Background of the initials badge (the person's chosen colour). */
  color?: string | null;
}

const SIZES = { sm: 'h-8 w-8 text-[0.6875rem]', md: 'h-10 w-10 text-xs', lg: 'h-14 w-14 text-base', xl: 'h-28 w-28 text-3xl' };

export function Avatar({ initials, size = 'md', src, color }: AvatarProps) {
  if (src)
    return <img src={src} alt="" aria-hidden className={`inline-block shrink-0 rounded-full object-cover ring-2 ring-line ${SIZES[size]}`} />;
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-wide text-white ring-2 ring-line ${color ? '' : 'bg-burgundy-600'} ${SIZES[size]}`}
      style={color ? { background: color } : undefined}
    >
      {initials}
    </span>
  );
}
