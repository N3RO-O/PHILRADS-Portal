import { useEffect, useState, type FocusEvent, type PointerEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { MODULES, NAV_GROUPS } from '../../config/modules';
import { useAuth } from '../auth/AuthProvider';

interface NavItemsProps {
  expanded: boolean;
  onNavigate?: () => void;
}

/**
 * Module links in groups (Overview / Field operations / Work, plus Admin for administrators),
 * separated by thin dividers. Expanded: icon + label, active item filled yellow. Collapsed: icons
 * only, active icon yellow with an indicator bar, and a label on hover or keyboard focus. The label
 * floats (fixed) beside the rail, so the navigation can scroll without clipping it. Modules not built
 * yet carry a "Soon" tag.
 */
export function NavItems({ expanded, onNavigate }: NavItemsProps) {
  const { can } = useAuth();
  const visible = MODULES.filter((m) => !m.hidden && (!m.permission || can(m.permission)));
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const showTip = (label: string) => (e: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    if (expanded) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 16 });
  };
  const hideTip = () => setTip(null);
  // Scrolling the rail (or collapsing it) moves the links away from the label.
  useEffect(() => {
    if (!tip) return;
    window.addEventListener('scroll', hideTip, true);
    return () => window.removeEventListener('scroll', hideTip, true);
  }, [tip]);
  useEffect(hideTip, [expanded]);
  return (
    <>
      {NAV_GROUPS.filter((group) => visible.some((m) => m.group === group)).map((group, gi) => (
        <div key={group} role="group" aria-label={group} className="flex flex-col gap-1">
          {gi > 0 && <hr className="mx-2 my-2 border-line/70" aria-hidden />}
          {visible.filter((m) => m.group === group).map((m) => (
            <NavLink
              key={m.id}
              to={m.path}
              end={m.path === '/'}
              onClick={() => {
                hideTip();
                onNavigate?.();
              }}
              onPointerEnter={showTip(m.soon ? `${m.label} · Soon` : m.label)}
              onPointerLeave={hideTip}
              onFocus={showTip(m.soon ? `${m.label} · Soon` : m.label)}
              onBlur={hideTip}
              aria-label={expanded ? undefined : m.soon ? `${m.label} (coming soon)` : m.label}
              className={({ isActive }) =>
                `group relative flex h-10 shrink-0 items-center gap-3 rounded-xl text-sm transition-colors ${
                  expanded ? 'px-3' : 'justify-center'
                } ${
                  isActive
                    ? // Glassy highlight: a yellow wash fading to the right, with a fine yellow edge.
                      `font-semibold ring-1 ring-inset ring-uplift/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ${
                        expanded ? 'bg-gradient-to-r from-uplift/25 via-uplift/10 to-uplift/[0.03] text-ink' : 'bg-gradient-to-b from-uplift/25 to-uplift/[0.06] text-uplift'
                      }`
                    : 'font-medium text-ink-soft hover:bg-white/[0.04] hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <m.icon className={`h-[1.125rem] w-[1.125rem] shrink-0 ${isActive ? 'text-uplift' : ''}`} aria-hidden />
                  {expanded ? (
                    <>
                      <span className="truncate">{m.label}</span>
                      {m.soon && (
                        <span className="ml-auto shrink-0 rounded-full border border-uplift/30 bg-uplift/10 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-uplift">
                          Soon
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {isActive && <span aria-hidden className="absolute -right-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-l bg-uplift" />}
                      {m.soon && <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-uplift/80" />}
                    </>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
      {tip && (
        <span
          aria-hidden
          style={{ top: tip.top, left: tip.left }}
          className="pointer-events-none fixed z-50 -translate-y-1/2 animate-fade-in whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink shadow-xl shadow-black/40"
        >
          {tip.label}
        </span>
      )}
    </>
  );
}
