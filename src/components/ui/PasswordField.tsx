import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** A password input with an eye button to show or hide what was typed. */
export function PasswordField({ className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <span className="relative block">
      <input {...props} type={visible ? 'text' : 'password'} className={`field pr-12 ${className}`} />
      <button
        type="button"
        className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:text-ink"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        <Icon key={String(visible)} className="h-[1.125rem] w-[1.125rem] animate-pop-in" aria-hidden />
      </button>
    </span>
  );
}
