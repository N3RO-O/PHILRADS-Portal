import './doneCheck.css';

/**
 * The green "done" check: pops in, draws its tick and pulses one ring out (doneCheck.css).
 * Set --dc-delay on it or a parent to stage it after other entrances.
 */
export function DoneCheck({ className = 'h-6 w-6', shape = 'circle' }: { className?: string; shape?: 'circle' | 'square' }) {
  return (
    <span className={`done-check ${className}`} data-shape={shape} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5.5 12.5l4.25 4.25L18.5 7.5" stroke="currentColor" strokeWidth="3.25" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
      </svg>
    </span>
  );
}
