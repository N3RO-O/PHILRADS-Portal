import type { ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Sheet } from './Sheet';

/** One filter that's on, shown as a small chip under the search box; tap it to turn it off. */
export interface ActiveFilter {
  key: string;
  label: string;
  onClear: () => void;
}

/** The one compact control for every filter: opens the filter sheet, and says how many are on. */
export function FiltersButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`btn-ghost min-h-11 shrink-0 gap-1.5 px-3 sm:px-3.5 ${count ? 'border-uplift/60 text-uplift' : ''}`}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={count ? `Filters, ${count} on` : 'Filters'}
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
      <span className="hidden min-[400px]:inline">Filters</span>
      {count > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-uplift px-1 text-[0.6875rem] font-bold leading-none tabular-nums text-[#1c1d21]" aria-hidden>
          {count}
        </span>
      )}
    </button>
  );
}

/** The filters that are on, each removable, plus Clear all. Nothing shows while none are on. */
export function ActiveFilters({ filters, onClearAll, trailing }: { filters: ActiveFilter[]; onClearAll: () => void; trailing?: ReactNode }) {
  if (!filters.length && !trailing) return null;
  return (
    <div className="-mt-1 flex flex-wrap items-center gap-1.5">
      {filters.map((f) => (
        <button key={f.key} type="button" className="chip max-w-full gap-1 border-uplift/40 text-ink" onClick={f.onClear} aria-label={`Remove filter: ${f.label}`}>
          <span className="truncate">{f.label}</span>
          <X className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        </button>
      ))}
      {filters.length > 1 && (
        <button type="button" className="link min-h-8 px-1" onClick={onClearAll}>
          Clear all
        </button>
      )}
      {trailing && <span className="ml-auto text-xs text-muted">{trailing}</span>}
    </div>
  );
}

/** The filters themselves: a bottom sheet on phones, a side drawer on wider screens. */
export function FilterSheet({
  open,
  onClose,
  count,
  shown,
  noun,
  onClearAll,
  children,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  /** How many items the filters leave, for the footer button. */
  shown: number;
  noun: [one: string, many: string];
  onClearAll: () => void;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn-ghost min-h-11 px-4" onClick={onClearAll} disabled={!count}>
            Clear all
          </button>
          <button type="button" className="btn-primary min-h-11 flex-1 px-4" onClick={onClose}>
            Show {shown} {shown === 1 ? noun[0] : noun[1]}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">{children}</div>
    </Sheet>
  );
}

/** One group in the filter sheet, with its heading. */
export function FilterGroup({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </label>
      ) : (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      )}
      {children}
    </div>
  );
}
