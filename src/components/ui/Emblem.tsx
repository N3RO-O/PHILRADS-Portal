/** Official PHILRADS emblem (cropped from the branding guide), on a transparent background. */
export function Emblem({ className = 'h-10 w-10', decorative = false }: { className?: string; decorative?: boolean }) {
  return (
    <img
      src="/brand/philrads-emblem.png"
      alt={decorative ? '' : 'PHILRADS emblem'}
      width={256}
      height={256}
      className={`shrink-0 rounded-xl ${className}`}
    />
  );
}
