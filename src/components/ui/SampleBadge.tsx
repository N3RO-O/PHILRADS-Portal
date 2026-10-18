/** Marks demonstration data so it is never mistaken for real PHILRADS figures. */
export function SampleBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full bg-uplift-100 px-2 py-0.5 text-[0.6875rem] font-bold text-uplift-700"
      title="Demonstration data, not live PHILRADS records"
    >
      Sample
    </span>
  );
}
