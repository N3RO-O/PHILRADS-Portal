import type { LucideIcon } from 'lucide-react';

export interface SwitchOption<K extends string> {
  key: K;
  label: string;
  count?: number;
  icon?: LucideIcon;
}
export interface SwitchGroup<K extends string> {
  key: string;
  label: string;
  /** Shown on the tab (left out or 0: no number). */
  count?: number;
  options: SwitchOption<K>[];
}

/**
 * Views on a phone: a few tabs on top, then one short row of pills for the tab you're in (it
 * scrolls sideways instead of wrapping). A tab with one view has no pills. With a single group,
 * just the pills. Used by Tasks and Documentation; wider screens keep their own layout.
 */
export function ViewSwitch<K extends string>({ groups, value, onChange, label }: { groups: SwitchGroup<K>[]; value: K | null; onChange: (k: K) => void; label: string }) {
  const shown = groups.filter((g) => g.options.length);
  if (!shown.length) return null;
  const current = shown.find((g) => g.options.some((o) => o.key === value)) ?? shown[0];
  return (
    <div className="flex flex-col gap-2.5">
      {shown.length > 1 && (
        <div className="grid rounded-xl bg-surface-sunken p-1" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }} role="tablist" aria-label={label}>
          {shown.map((g) => {
            const on = g.key === current.key;
            return (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={on}
                className={`press flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-1 text-sm font-semibold transition-colors ${on ? 'bg-surface-raised text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                onClick={() => !on && onChange(g.options[0].key)}
              >
                <span className="truncate">{g.label}</span>
                {!!g.count && <span className={`shrink-0 rounded-full px-1.5 text-[0.6875rem] tabular-nums ${on ? 'bg-ink/[0.08]' : 'bg-ink/[0.05]'}`}>{g.count}</span>}
              </button>
            );
          })}
        </div>
      )}
      {current.options.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={`${current.label}: views`}>
          {current.options.map((o) => (
            <button key={o.key} type="button" className="chip shrink-0 gap-1.5 whitespace-nowrap" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
              {o.icon && <o.icon className="h-3.5 w-3.5" aria-hidden />}
              {o.label}
              {!!o.count && <span className="font-normal opacity-70">{o.count}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
