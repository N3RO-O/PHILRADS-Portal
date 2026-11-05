/** Marks demonstration data so it is never mistaken for real PHILRADS figures. */
export function SampleBadge({ label = 'Sample' }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-soft"
      title="Demonstration data, not live PHILRADS records"
    >
      {label}
    </span>
  );
}
