import { useState } from 'react';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name, when no visible label is linked with labelledBy. */
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
  title?: string;
  /** Track colour when on. */
  onClass?: string;
  className?: string;
}

/**
 * An on/off switch that moves like a real one: the knob stretches as it sets off, overshoots the
 * end and settles back. Pressing and holding stretches it too. Motion is skipped for reduced motion.
 */
export function Switch({ checked, onChange, label, labelledBy, disabled, title, onClass = 'border-uplift bg-uplift/80', className = '' }: Props) {
  // Only animate after the first flip, so the switch doesn't wobble when the page opens.
  const [moved, setMoved] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      title={title}
      disabled={disabled}
      onClick={() => {
        setMoved(true);
        onChange(!checked);
      }}
      className={`switch ${checked ? onClass : 'border-line bg-surface-raised'} ${className}`}
    >
      <span className="switch-thumb" data-moved={moved ? (checked ? 'on' : 'off') : undefined} />
    </button>
  );
}
