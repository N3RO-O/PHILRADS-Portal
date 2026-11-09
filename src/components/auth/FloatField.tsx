import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { DoneCheck } from '../ui/DoneCheck';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'id'> & {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'email' | 'password' | 'text';
  /** The problem with the value, or null when it is fine. */
  validate: (value: string) => string | null;
  /** Bumped on each submit: any field still wrong shows its message then. */
  reveal?: number;
  /** Show a green check as soon as the value is valid (not for passwords: we can't know they're right). */
  praise?: boolean;
};

/**
 * A sign-in field that is kind about mistakes (see .float-field in index.css):
 * - The label sits inside the box and floats to its top when you focus, type or the browser autofills,
 *   so it never disappears the way a placeholder does.
 * - Late to scold: no error while you are still typing; it shows when you leave the field or submit.
 * - Early to praise: the green check draws in the moment the value is right.
 * - The next keystroke clears the error, and a line under the box is always kept for the message,
 *   so nothing below jumps when one appears.
 */
export const FloatField = forwardRef<HTMLInputElement, Props>(function FloatField(
  { id, label, value, onChange, type = 'text', validate, reveal = 0, praise = false, className = '', onBlur, ...rest },
  ref,
) {
  const [scold, setScold] = useState(false);
  const [visible, setVisible] = useState(false);
  const problem = validate(value);

  useEffect(() => {
    if (reveal > 0 && validate(value)) setScold(true);
    // Only on a new submit, not while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  const showError = scold && problem;
  const good = praise && !problem;
  const isPassword = type === 'password';
  const Eyes = visible ? EyeOff : Eye;
  const msgId = `${id}-msg`;

  return (
    <div className="float-field" data-state={showError ? 'error' : good ? 'good' : undefined}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && visible ? 'text' : type}
          // A single space keeps :placeholder-shown working, which tells the label when to float.
          placeholder=" "
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (scold) setScold(false);
          }}
          onBlur={(e) => {
            if (e.target.value && validate(e.target.value)) setScold(true);
            onBlur?.(e);
          }}
          aria-invalid={showError ? true : undefined}
          aria-describedby={msgId}
          className={`field float-field-input ${isPassword ? 'pr-12' : good ? 'pr-11' : ''} ${className}`}
          {...rest}
        />
        <label htmlFor={id} className="float-field-label">
          {label}
        </label>
        {isPassword ? (
          <button
            type="button"
            className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:text-ink"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            title={visible ? 'Hide password' : 'Show password'}
          >
            <Eyes key={String(visible)} className="h-[1.125rem] w-[1.125rem] animate-pop-in" aria-hidden />
          </button>
        ) : (
          good && (
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
              <DoneCheck className="h-5 w-5" />
            </span>
          )
        )}
      </div>
      {/* Always here, so the form keeps its shape whether or not there is a message. */}
      <p id={msgId} className="float-field-msg" aria-live="polite">
        {showError ? <span key={problem} className="inline-block animate-fade-in">{problem}</span> : null}
      </p>
    </div>
  );
});
