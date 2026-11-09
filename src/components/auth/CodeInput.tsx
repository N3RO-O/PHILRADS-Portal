import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ChangeEvent } from 'react';
import { Check } from 'lucide-react';
import { shake } from '../../lib/motion';
import './codeInput.css';

export type CodeState = 'idle' | 'checking' | 'error' | 'success';

export interface CodeInputHandle {
  focus(): void;
}

interface Props {
  value: string;
  onChange: (code: string) => void;
  /** All the digits are in: called once per complete code (auto-submit). */
  onComplete?: (code: string) => void;
  state?: CodeState;
  length?: number;
  label: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** A light tap on phones that have it (Android); silent elsewhere. */
export const haptic = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not allowed here: nothing to feel */
  }
};

/**
 * A one-time code shown as one box per digit. Underneath it is a single real input, so phone
 * keyboards can offer the code from Mail or Messages (autocomplete="one-time-code"), pasting the
 * whole code works, backspace goes back, and screen readers hear one labelled field.
 */
export const CodeInput = forwardRef<CodeInputHandle, Props>(function CodeInput(
  { value, onChange, onComplete, state = 'idle', length = 6, label, disabled, autoFocus },
  ref,
) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  // When each digit arrived, so a pasted code fills in one box after another.
  const [delays, setDelays] = useState<number[]>([]);
  const prev = useRef(value);

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);

  useEffect(() => {
    if (state === 'error') {
      shake(group.current);
      haptic([60, 40, 60]);
    } else if (state === 'success') {
      haptic([18, 50, 28]);
    }
  }, [state]);

  // The caret always sits after the last digit: the boxes are filled left to right.
  const keepCaretAtEnd = () => {
    const el = input.current;
    const end = el?.value.length ?? 0;
    if (el && document.activeElement === el && (el.selectionStart !== end || el.selectionEnd !== end)) el.setSelectionRange(end, end);
  };

  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, length);
    const before = prev.current;
    prev.current = next;
    if (next.length > before.length) {
      const added = next.length - before.length;
      // Typed: settles at once. Pasted or filled from a suggestion: a quick stagger across the boxes.
      setDelays((d) => {
        const out = d.slice(0, before.length);
        for (let i = before.length; i < next.length; i++) out[i] = added > 1 ? (i - before.length) * 55 : 0;
        return out;
      });
      haptic(added > 1 ? 12 : 6);
    }
    onChange(next);
    if (next.length === length && next !== before) onComplete?.(next);
  };

  useEffect(() => {
    prev.current = value;
  }, [value]);

  const caret = Math.min(value.length, length - 1);
  const full = value.length === length;
  const describedBy = `${id}-hint`;

  return (
    <div className="flex flex-col gap-2">
      <label id={`${id}-label`} htmlFor={id} className="text-sm font-medium text-ink-soft">
        {label}
      </label>
      <div
        ref={group}
        role="group"
        aria-labelledby={`${id}-label`}
        className="otp"
        data-state={state}
        data-focused={focused || undefined}
        data-full={full || undefined}
        data-disabled={disabled || undefined}
      >
        <input
          ref={input}
          id={id}
          className="otp-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          enterKeyHint="go"
          maxLength={length}
          value={value}
          onChange={change}
          onFocus={() => (setFocused(true), requestAnimationFrame(keepCaretAtEnd))}
          onBlur={() => setFocused(false)}
          onSelect={keepCaretAtEnd}
          onKeyUp={keepCaretAtEnd}
          aria-invalid={state === 'error' || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        <div className="otp-boxes" aria-hidden>
          {Array.from({ length }, (_, i) => {
            const digit = value[i];
            const active = focused && !full && i === caret && state !== 'success';
            return (
              <span
                key={i}
                className="otp-box"
                data-filled={digit ? true : undefined}
                data-active={active || undefined}
                style={{ ['--i' as string]: i }}
              >
                {digit ? (
                  <span key={`${digit}-${delays[i] ?? 0}`} className="otp-digit" style={{ animationDelay: `${delays[i] ?? 0}ms` }}>
                    {digit}
                  </span>
                ) : (
                  active && <span className="otp-caret" />
                )}
              </span>
            );
          })}
          {state === 'success' && (
            <span className="otp-check">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          )}
        </div>
      </div>
      <p id={describedBy} className="sr-only">
        {length} digits. You can paste the whole code.
      </p>
      <p className="sr-only" aria-live="polite">
        {state === 'checking' ? 'Checking the code…' : state === 'success' ? 'Code accepted. Signing you in.' : ''}
      </p>
    </div>
  );
});
