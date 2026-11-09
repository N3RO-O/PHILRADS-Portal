/**
 * The badge rules (one place, so every badge follows them):
 * - Red means it waits on you to decide or act; yellow means it is only new.
 * - Counts stop at 99+ so the badge never outgrows its corner.
 * - It is pinned to the icon's top-right corner and grows outward, never over the icon.
 * - A parent shows the total of what is below it, and only decisions are counted: plain news gets
 *   a yellow dot, not a number.
 */
export const capCount = (n: number) => (n > 99 ? '99+' : String(n));

export function CountBadge({ count, tone, className = '' }: { count?: number; tone: 'act' | 'new'; className?: string }) {
  const colour = tone === 'act' ? 'bg-status-out text-white' : 'bg-uplift text-[#1c1d21]';
  // A dot when there is nothing to count (just new), a pill with the number otherwise.
  const shape = count ? 'h-4 min-w-4 px-1 text-[0.625rem] font-bold leading-none tabular-nums' : 'h-2.5 w-2.5';
  return (
    <span aria-hidden className={`pointer-events-none absolute bottom-[55%] left-[55%] grid animate-pop-in place-items-center rounded-full ring-2 ring-page ${colour} ${shape} ${className}`}>
      {count ? capCount(count) : null}
    </span>
  );
}
