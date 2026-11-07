import { useEffect, useState, type FocusEvent, type PointerEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { MODULES, NAV_GROUPS, moduleOpenTo } from '../../config/modules';
import { useAuth } from '../auth/AuthProvider';
import { SlidingPill } from '../ui/SlidingPill';

interface NavItemsProps {
  expanded: boolean;
  onNavigate?: () => void;
}

/**
 * Module links in groups (Overview / Field operations / Work, plus Admin for administrators),
 * separated by thin dividers. Expanded: icon + label, active item filled yellow; the highlight glides
 * from the old page to the new one, so the eye follows it. Collapsed: icons
 * only, active icon yellow with an indicator bar, and a label on hover or keyboard focus. The label
 * floats (fixed) beside the rail, so the navigation can scroll without clipping it. Modules not built
 * yet carry a "Soon" tag.
 */
export function NavItems({ expanded, onNavigate }: NavItemsProps) {
  const { can, profile } = useAuth();
  const visible = MODULES.filter((m) => !m.hidden && moduleOpenTo(m, profile?.roleKey, can));
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
      {/* The active highlight, behind the links (the nav around this is relative). */}
      <SlidingPill className="gloss rounded-xl bg-burgundy-500 ring-1 ring-inset ring-burgundy-400" />
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
                `group relative z-10 flex h-10 shrink-0 items-center gap-3 rounded-xl text-sm transition-colors duration-500 ${
                  expanded ? 'px-3' : 'justify-center'
                } ${
                  isActive
                    ? // The burgundy highlight itself is the sliding pill above.
                      'font-semibold text-cloud'
                    : 'font-medium text-ink-soft hover:bg-ink/[0.04] hover:text-ink'
                }`
              }
            >
              {() => (
                <>
                  <m.icon className="h-5 w-5 shrink-0" aria-hidden />
                  {expanded ? (
                    <>
                      <span className="truncate">{m.label}</span>
                      {m.soon && (
                        <span className="ml-auto shrink-0 text-[0.6875rem] font-medium text-muted">
                          Soon
                        </span>
                      )}
                    </>
                  ) : null}
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
