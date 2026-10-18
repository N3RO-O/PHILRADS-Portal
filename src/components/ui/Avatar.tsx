interface AvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'h-8 w-8 text-[0.6875rem]', md: 'h-10 w-10 text-xs', lg: 'h-16 w-16 text-lg' };

export function Avatar({ initials, size = 'md' }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full bg-burgundy font-bold tracking-wide text-white ring-2 ring-white ${SIZES[size]}`}
    >
      {initials}
    </span>
  );
}
