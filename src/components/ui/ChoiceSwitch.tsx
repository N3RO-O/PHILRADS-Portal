import type { LucideIcon } from 'lucide-react';

interface Option<T> {
  value: T;
  label: string;
  icon: LucideIcon;
}

/**
 * Two or three choices side by side. The chosen one is filled (burgundy, glossy) with its icon and a
 * bold label; the others stay quiet, so which one is on can't be missed. The fill slides between them.
 */
export function ChoiceSwitch<T extends string | boolean>({
  value,
  options,
  onChange,
  label,
  size = 'md',
  className = '',
}: {
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const h = size === 'sm' ? 'h-8 text-xs' : 'h-10 text-sm';
  return (
    <span role="radiogroup" aria-label={label} className={`relative inline-grid rounded-xl border border-line bg-surface-sunken p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {/* The fill behind the chosen one, sliding when it changes. */}
      <span
        aria-hidden
        className="gloss pointer-events-none absolute bottom-1 top-1 rounded-lg bg-burgundy-500 transition-transform duration-300 motion-reduce:transition-none"
        style={{ left: 4, width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`press relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 transition-colors duration-200 ${h} ${
              on ? 'font-bold text-cloud' : 'font-medium text-muted hover:text-ink'
            }`}
          >
            <o.icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
            {o.label}
          </button>
        );
      })}
    </span>
  );
}
