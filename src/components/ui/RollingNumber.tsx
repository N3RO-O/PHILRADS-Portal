import { useEffect, useState } from 'react';

/**
 * A number whose digits roll into place, one after another 100 ms apart (like an odometer).
 * Separators (commas, ₱, %) stay still. Screen readers get the plain value.
 */
export function RollingNumber({ value, className = '' }: { value: string; className?: string }) {
  // Start from zeros so the first show rolls up too.
  const [shown, setShown] = useState(() => value.replace(/\d/g, '0'));
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(t);
  }, [value]);
  let digit = 0;
  return (
    <span className={`inline-flex ${className}`} aria-label={value}>
      {[...shown].map((ch, i) => {
        if (!/\d/.test(ch)) {
          return (
            <span key={`s${i}`} aria-hidden>
              {ch}
            </span>
          );
        }
        const delay = digit++ * 100;
        return (
          <span key={`d${i}`} aria-hidden className="relative inline-block h-[1em] overflow-hidden leading-none" style={{ width: '0.62em' }}>
            <span className="roll-col absolute inset-x-0 top-0 flex flex-col items-center" style={{ transform: `translateY(-${Number(ch) * 10}%)`, transitionDelay: `${delay}ms` }}>
              {'0123456789'.split('').map((n) => (
                <span key={n} className="block h-[1em] leading-none">
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
