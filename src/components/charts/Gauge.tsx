interface GaugeProps {
  /** 0–100 */
  value: number;
  label: string;
}

/** Semicircle gauge, as in the reference's Earnings card. */
export function Gauge({ value, label }: GaugeProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const arc = 'M 20 100 A 80 80 0 0 1 180 100';
  return (
    <svg viewBox="0 0 200 112" className="mx-auto block w-full max-w-[17rem]" role="img" aria-label={`${label}: ${pct}%`}>
      <path d={arc} fill="none" stroke="#303137" strokeWidth="22" />
      <path
        d={arc}
        fill="none"
        stroke="#EC952A"
        strokeWidth="22"
        pathLength={100}
        strokeDasharray={`${pct} 100`}
        className="transition-[stroke-dasharray] duration-700"
      />
      <text x="100" y="96" textAnchor="middle" fontSize="30" fontWeight="700" fill="#F1F1F1" fontFamily="Montserrat, system-ui, sans-serif">
        {pct}%
      </text>
    </svg>
  );
}
