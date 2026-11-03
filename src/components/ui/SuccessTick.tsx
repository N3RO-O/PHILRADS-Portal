/**
 * The "done" mark: the circle draws first, then the tick (470 ms in all). Reduced motion shows it
 * finished straight away (see .success-tick in index.css).
 */
export function SuccessTick({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`success-tick ${className}`} aria-hidden>
      <circle className="success-tick-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" pathLength="1" />
      <path className="success-tick-check" d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
    </svg>
  );
}
