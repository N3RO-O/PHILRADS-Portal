interface AvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'h-8 w-8 text-[0.6875rem]', md: 'h-10 w-10 text-xs', lg: 'h-14 w-14 text-base' };

export function Avatar({ initials, size = 'md' }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full bg-burgundy-600 font-semibold tracking-wide text-white ring-2 ring-line ${SIZES[size]}`}
    >
      {initials}
    </span>
  );
}
