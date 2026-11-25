import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { MODULES, NAV_GROUPS, moduleOpenTo } from '../../config/modules';
import { useAuth } from '../auth/AuthProvider';
import { SlidingPill } from '../ui/SlidingPill';
import { CountBadge } from '../ui/CountBadge';
import { NavTip, useNavTip } from '../ui/NavTip';
import { isUnder, useNewHere } from '../../lib/newHere';
import type { PermissionKey } from '../../config/permissions';

/**
 * Words beside an icon in the sidebar: always there, faded out when folded. They fade quickly as it
 * folds, and come back just after it starts opening, so they never squeeze or jump.
 */
export const railLabel = (expanded: boolean) =>
  `whitespace-nowrap transition-opacity ${expanded ? 'opacity-100 delay-75 duration-200' : 'pointer-events-none opacity-0 duration-100'}`;

interface NavItemsProps {
  expanded: boolean;
  onNavigate?: () => void;
  /** In the desktop sidebar, which folds: icons keep their place and the words fade. */
  rail?: boolean;
}

/**
 * Module links in groups (Overview / Field operations / Work, plus Admin for administrators),
 * separated by thin dividers. Expanded: icon + label, active item filled yellow; the highlight glides
 * from the old page to the new one, so the eye follows it. Collapsed: icons
 * only, active icon yellow with an indicator bar, and a label on hover or keyboard focus. The label
 * floats (fixed) beside the rail, so the navigation can scroll without clipping it. Modules not built
 * yet carry a "Soon" tag. A page a recent update changed carries a yellow dot, and its hover label
 * says what's new with a tiny "!" (src/lib/newHere.ts).
 */
export function NavItems({ expanded, onNavigate, rail = false }: NavItemsProps) {
  const { can, profile } = useAuth();
  const visible = MODULES.filter((m) => !m.hidden && moduleOpenTo(m, profile?.roleKey, can));
  const news = useNewHere('staff', (p) => can(p as PermissionKey));
  const { tip, show, hide: hideTip } = useNavTip();
  // Folded, the label names the page; open, it only appears to say what's new.
  const showTip = (label: string, fresh: typeof news) => show(expanded ? undefined : label, fresh);
  // Collapsing the rail moves the links away from the label.
  useEffect(hideTip, [expanded, hideTip]);
  return (
    <>
      {/* The active highlight, behind the links (the nav around this is relative). */}
      <SlidingPill className="gloss rounded-xl bg-burgundy-500 ring-1 ring-inset ring-burgundy-400" />
      {NAV_GROUPS.filter((group) => visible.some((m) => m.group === group)).map((group, gi) => (
        <div key={group} role="group" aria-label={group} className="flex flex-col gap-1">
          {gi > 0 && <hr className="mx-2 my-2 border-line/70" aria-hidden />}
          {visible.filter((m) => m.group === group).map((m) => {
            const fresh = news.filter((n) => isUnder(n.path, m.path));
            const label = m.soon ? `${m.label} · Soon` : m.label;
            return (
            <NavLink
              key={m.id}
              to={m.path}
              end={m.path === '/'}
              onClick={() => {
                hideTip();
                onNavigate?.();
              }}
              onPointerEnter={showTip(label, fresh)}
              onPointerLeave={hideTip}
              onFocus={showTip(label, fresh)}
              onBlur={hideTip}
              aria-label={expanded ? undefined : `${m.label}${m.soon ? ' (coming soon)' : ''}${fresh.length ? ' (new)' : ''}`}
              className={({ isActive }) =>
                `group relative z-10 flex h-10 shrink-0 items-center gap-3 rounded-xl text-sm transition-colors ${
                  rail ? 'overflow-hidden pl-[0.875rem] pr-3' : expanded ? 'px-3' : 'justify-center'
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
                  <span className="relative shrink-0">
                    <m.icon className="h-5 w-5" aria-hidden />
                    {fresh.length > 0 && <CountBadge tone="new" />}
                  </span>
                  {expanded && fresh.length > 0 && <span className="sr-only">(new)</span>}
                  {rail ? (
                    <>
                      <span className={`min-w-0 flex-1 ${railLabel(expanded)}`}>{m.label}</span>
                      {m.soon && <span className={`shrink-0 text-[0.6875rem] font-medium text-muted ${railLabel(expanded)}`}>Soon</span>}
                    </>
                  ) : expanded ? (
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
            );
          })}
        </div>
      ))}
      <NavTip tip={tip} />
    </>
  );
}
