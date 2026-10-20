/** Marks demonstration data so it is never mistaken for real PHILRADS figures. */
export function SampleBadge({ label = 'Sample' }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-uplift/30 bg-uplift/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-uplift"
      title="Demonstration data, not live PHILRADS records"
    >
      {label !== 'Sample' && <span className="h-1.5 w-1.5 rounded-full bg-uplift" aria-hidden />}
      {label}
    </span>
  );
}
