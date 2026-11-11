import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Eraser, Minus, Plus, Printer, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import { SlidingPill } from '../ui/SlidingPill';

/** Size of what's typed on a form, as a share of the template's own size. */
export const SCALE = { min: 0.85, max: 1.5, step: 0.05, initial: 1 } as const;
const SIZES = [
  { v: 0.9, label: 'Small' },
  { v: 1, label: 'Normal' },
  { v: 1.15, label: 'Large' },
  { v: 1.3, label: 'Larger' },
] as const;

/** Side margins of the sheet: the template's own, or nudged in or out (mm per side). */
export type Margin = 'narrow' | 'standard' | 'wide';
export const MARGIN_MM: Record<Margin, number> = { narrow: -5, standard: 0, wide: 4 };
const MARGINS: { v: Margin; label: string }[] = [
  { v: 'narrow', label: 'Narrow' },
  { v: 'standard', label: 'Standard' },
  { v: 'wide', label: 'Wide' },
];

export const clampScale = (n: number) => Math.min(SCALE.max, Math.max(SCALE.min, +n.toFixed(2)));
const pct = (n: number) => `${Math.round(n * 100)}%`;
const marginLabel = (m: Margin) => MARGINS.find((x) => x.v === m)!.label;

interface Props {
  title: string;
  paper: string;
  saved: 'idle' | 'saved' | 'failed';
  scale: number;
  onScale: (n: number) => void;
  margin: Margin;
  onMargin: (m: Margin) => void;
  /** The form is drawn to fill its paper exactly, so its margins can't change. */
  marginsFixed?: boolean;
  /** "5 more rows": only for forms with a growing list. */
  rowsLabel?: string;
  onAddRows?: () => void;
  onBack: () => void;
  onClear: () => void;
  onPrint: () => void;
}

/**
 * The Forms toolbar. Wide screens: one sticky bar with everything in reach (text size and margins
 * inline when the bar is wide, behind a "Text & margins" button when it isn't). Phones: a slim header for where
 * you are, and the actions in a bar at the bottom, under the thumb; the settings open in a sheet
 * with big presets. Every setting shows its current value and is printed the same way.
 */
export function FormToolbar(p: Props) {
  const [open, setOpen] = useState(false);
  const changed = p.scale !== SCALE.initial || p.margin !== 'standard';
  // Phones: keep room under the page (footer included) for the bottom bar.
  useEffect(() => {
    document.body.classList.add('has-form-bar');
    return () => document.body.classList.remove('has-form-bar');
  }, []);
  const summary = `${pct(p.scale)}${p.margin === 'standard' ? '' : ` · ${marginLabel(p.margin)}`}`;
  const label = `Text and margins: text ${pct(p.scale)}${p.marginsFixed ? '' : `, margins ${marginLabel(p.margin)}`}`;

  return (
    <>
      {/* Header: static on phones (the bottom bar has the actions), a sticky toolbar from md. It lays
          itself out by its own width (container queries), so it fits beside the Active panel too. */}
      <div className="floating rounded-2xl [container-type:inline-size] md:sticky md:top-16 md:z-20">
        <div className="flex items-center gap-2 p-2 md:p-3">
          <button type="button" className="icon-btn" onClick={p.onBack} aria-label="All forms">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold leading-tight">{p.title}</h2>
            <p className="truncate text-xs text-muted">
              {p.paper}
              <SavedNote saved={p.saved} />
            </p>
          </div>

          {/* A wide bar: the settings sit right in it. */}
          <div className="hidden items-center gap-3 [@container(min-width:68rem)]:flex">
            <SizeStepper scale={p.scale} onScale={p.onScale} compact />
            {!p.marginsFixed && <Segmented label="Side margins" value={p.margin} onChange={p.onMargin} compact />}
          </div>
          {/* Narrower: one button that shows the current values and opens them. */}
          <button
            type="button"
            className="btn-ghost hidden min-h-10 shrink-0 whitespace-nowrap px-3 text-sm md:inline-flex [@container(min-width:68rem)]:hidden"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-label={label}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span className="hidden [@container(min-width:50rem)]:inline">Text &amp; margins</span>
            <span className="rounded-md bg-surface-sunken px-1.5 py-px text-xs tabular-nums text-ink-soft">{summary}</span>
          </button>

          <span className="mx-1 hidden h-8 w-px shrink-0 bg-line md:block" aria-hidden />
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            {p.onAddRows && (
              <button
                type="button"
                className="btn-ghost min-h-10 whitespace-nowrap px-3 text-sm"
                onClick={p.onAddRows}
                title={`Add 5 more ${p.rowsLabel}`}
                aria-label={`5 more ${p.rowsLabel}`}
              >
                <Plus className="h-4 w-4" aria-hidden /> 5 rows
              </button>
            )}
            <button type="button" className="icon-btn border border-line" onClick={p.onClear} aria-label="Clear the form" title="Clear the form">
              <Eraser className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            </button>
            <button type="button" className="btn-primary min-h-10 whitespace-nowrap px-4 text-sm" onClick={p.onPrint}>
              <Printer className="h-4 w-4" aria-hidden /> Print
              <span className="hidden [@container(min-width:50rem)]:inline"> / Save as PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Phones: the actions at the bottom of the screen, under the thumb (on <body>, above the page). */}
      {createPortal(
        <div
          className="floating fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 rounded-2xl p-2 md:hidden"
          role="toolbar"
          aria-label="Form actions"
        >
          <button
            type="button"
            className="tap flex min-h-12 shrink-0 flex-col items-center justify-center rounded-xl px-3 text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-label={label}
          >
            <span className="flex items-center gap-1 text-sm font-bold leading-none">
              <span aria-hidden>Aa</span>
              {changed && <span className="h-1.5 w-1.5 rounded-full bg-uplift" aria-hidden />}
            </span>
            <span className="mt-1 text-[0.6875rem] font-semibold tabular-nums leading-none">{pct(p.scale)}</span>
          </button>
          {p.onAddRows && (
            <button
              type="button"
              className="tap flex min-h-12 shrink-0 flex-col items-center justify-center rounded-xl px-3 text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
              onClick={p.onAddRows}
              aria-label={`5 more ${p.rowsLabel}`}
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span className="mt-1 text-[0.6875rem] font-semibold leading-none">+5 rows</span>
            </button>
          )}
          <button type="button" className="btn-primary min-h-12 flex-1 px-4 text-sm" onClick={p.onPrint}>
            <Printer className="h-4 w-4" aria-hidden /> Print / PDF
          </button>
        </div>,
        document.body,
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Text & margins"
        subtitle="For what you type on this form. Printed the same way."
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost flex-1"
              onClick={() => {
                p.onScale(SCALE.initial);
                p.onMargin('standard');
              }}
              disabled={!changed}
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Reset
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          <section aria-labelledby="ff-size">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h3 id="ff-size" className="text-sm font-semibold">
                Text size
              </h3>
              <span className="text-sm font-semibold tabular-nums text-ink-soft">{pct(p.scale)}</span>
            </div>
            <div className="relative grid grid-cols-4 gap-1 rounded-xl bg-surface-sunken p-1" role="group" aria-label="Text size presets">
              <SlidingPill className="rounded-lg bg-surface-raised shadow-sm shadow-black/30 ring-1 ring-inset ring-ink/[0.06]" />
              {SIZES.map((s, i) => (
                <button
                  key={s.v}
                  type="button"
                  aria-pressed={p.scale === s.v}
                  onClick={() => p.onScale(s.v)}
                  className="tap relative z-10 flex min-h-14 flex-col items-center justify-center rounded-lg text-ink-soft transition-colors duration-500 hover:text-ink aria-pressed:text-ink"
                >
                  <span className="font-serif font-semibold leading-none" style={{ fontSize: `${0.85 + i * 0.22}rem` }} aria-hidden>
                    A
                  </span>
                  <span className="mt-1 text-[0.6875rem] font-semibold">{s.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted">Fine-tune in 5% steps</span>
              <SizeStepper scale={p.scale} onScale={p.onScale} />
            </div>
          </section>

          <section aria-labelledby="ff-margins">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h3 id="ff-margins" className="text-sm font-semibold">
                Side margins
              </h3>
              <span className="text-sm font-semibold text-ink-soft">{marginLabel(p.margin)}</span>
            </div>
            {p.marginsFixed ? (
              <p className="notice text-xs text-ink-soft">This form is drawn to fill the paper exactly, so its margins stay as designed.</p>
            ) : (
              <>
                <Segmented label="Side margins" value={p.margin} onChange={p.onMargin} />
                <p className="mt-2 text-xs text-muted">Narrow fits more on each line; Wide leaves room for binding or a printer that trims the edges.</p>
              </>
            )}
          </section>

          {/* Phones only: the rarely used, destructive action lives here, away from Print. */}
          <section className="border-t border-line/70 pt-4 md:hidden">
            <button
              type="button"
              className="btn w-full border border-status-low/40 text-status-low hover:bg-status-low/10"
              onClick={() => {
                setOpen(false);
                p.onClear();
              }}
            >
              <Eraser className="h-4 w-4" aria-hidden /> Clear the form
            </button>
          </section>
        </div>
      </Sheet>
    </>
  );
}

function SavedNote({ saved }: { saved: Props['saved'] }) {
  if (saved === 'saved')
    return (
      <span className="ml-2 inline-flex items-center gap-1 text-status-in">
        <Check className="h-3 w-3" aria-hidden /> <span className="sm:hidden">Draft kept</span>
        <span className="hidden sm:inline">Draft kept on this device</span>
      </span>
    );
  if (saved === 'failed') return <span className="ml-2 text-status-low">This device couldn’t keep the draft</span>;
  return null;
}

/** A− [value] A+. The value is a button too: it puts the size back to 100%. */
function SizeStepper({ scale, onScale, compact = false }: { scale: number; onScale: (n: number) => void; compact?: boolean }) {
  const h = compact ? 'h-10 w-10' : 'h-11 w-11';
  return (
    <div className="flex items-center rounded-xl border border-line bg-surface-sunken" role="group" aria-label="Text size">
      {compact && (
        <span className="pl-3 pr-1 text-xs font-semibold text-muted" aria-hidden>
          Text
        </span>
      )}
      <button
        type="button"
        className={`icon-btn ${h} rounded-r-none`}
        onClick={() => onScale(clampScale(scale - SCALE.step))}
        disabled={scale <= SCALE.min}
        aria-label="Smaller text"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        className="min-h-10 min-w-[3.5rem] rounded-md px-1 text-center text-sm font-semibold tabular-nums text-ink transition-colors hover:bg-surface-raised disabled:cursor-default disabled:hover:bg-transparent"
        onClick={() => onScale(SCALE.initial)}
        disabled={scale === SCALE.initial}
        aria-label={`Text size ${pct(scale)}${scale === SCALE.initial ? '' : ', reset to 100%'}`}
        title={scale === SCALE.initial ? undefined : 'Back to 100%'}
      >
        <span aria-live="polite">{pct(scale)}</span>
      </button>
      <button
        type="button"
        className={`icon-btn ${h} rounded-l-none`}
        onClick={() => onScale(clampScale(scale + SCALE.step))}
        disabled={scale >= SCALE.max}
        aria-label="Bigger text"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function Segmented({ label, value, onChange, compact = false }: { label: string; value: Margin; onChange: (m: Margin) => void; compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-2' : ''}`}>
      {compact && (
        <span className="text-xs font-semibold text-muted" aria-hidden>
          Margins
        </span>
      )}
      <div className={`relative gap-1 rounded-xl bg-surface-sunken p-1 ${compact ? 'flex' : 'grid w-full grid-cols-3'}`} role="group" aria-label={label}>
        <SlidingPill className="rounded-lg bg-surface-raised shadow-sm shadow-black/30 ring-1 ring-inset ring-ink/[0.06]" />
        {MARGINS.map((m) => (
          <button
            key={m.v}
            type="button"
            aria-pressed={value === m.v}
            onClick={() => onChange(m.v)}
            className={`relative z-10 rounded-lg font-semibold text-ink-soft transition-colors duration-500 hover:text-ink aria-pressed:text-ink ${compact ? 'min-h-8 whitespace-nowrap px-2.5 text-xs' : 'tap min-h-11 px-2 text-sm'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
