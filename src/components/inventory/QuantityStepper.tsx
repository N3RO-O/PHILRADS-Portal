import { Minus, Plus } from 'lucide-react';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Allow negative values (stock adjustments). */
  signed?: boolean;
  max?: number;
  unit?: string;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * Quantity input with large − / + buttons and the numeric keypad on phones.
 * Letters and decimals are filtered as the staff member types.
 */
export function QuantityStepper({ id, value, onChange, signed = false, max, unit, invalid, describedBy }: Props) {
  const n = Number.parseInt(value, 10);
  const step = (d: number) => {
    const next = (Number.isFinite(n) ? n : 0) + d;
    if (!signed && next < 0) return;
    if (max !== undefined && next > max) return;
    onChange(String(next));
  };
  const sanitize = (raw: string) => {
    const neg = signed && raw.trim().startsWith('-');
    const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
    return neg ? `-${digits}` : digits;
  };
  const btn =
    'grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface-sunken text-ink transition active:scale-95 hover:border-ink-mute disabled:opacity-40';

  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => step(-1)} aria-label="Decrease quantity" disabled={!signed && (!Number.isFinite(n) || n <= 0)}>
        <Minus className="h-5 w-5" aria-hidden />
      </button>
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          type="text"
          inputMode={signed ? 'text' : 'numeric'}
          pattern={signed ? '-?[0-9]*' : '[0-9]*'}
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`field h-12 text-center text-lg font-semibold tabular-nums ${unit ? 'pr-16' : ''} ${invalid ? 'border-status-out focus:border-status-out focus:ring-status-out' : ''}`}
        />
        {unit && <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-xs text-muted">{unit}</span>}
      </div>
      <button type="button" className={btn} onClick={() => step(1)} aria-label="Increase quantity" disabled={max !== undefined && Number.isFinite(n) && n >= max}>
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
