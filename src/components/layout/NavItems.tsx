import { NavLink } from 'react-router-dom';
import { MODULES, NAV_GROUPS } from '../../config/modules';

interface NavItemsProps {
  expanded: boolean;
  onNavigate?: () => void;
}

/**
 * Module links in three groups (Overview / Field operations / Work), separated by thin dividers.
 * Expanded: icon + label, active item filled yellow. Collapsed: icons only, active icon yellow
 * with an indicator bar, and a label on hover or keyboard focus.
 */
export function NavItems({ expanded, onNavigate }: NavItemsProps) {
  return (
    <>
      {NAV_GROUPS.map((group, gi) => (
        <div key={group} role="group" aria-label={group} className="flex flex-col gap-1">
          {gi > 0 && <hr className="mx-2 my-2 border-line/70" aria-hidden />}
          {MODULES.filter((m) => m.group === group).map((m) => (
            <NavLink
              key={m.id}
              to={m.path}
              end={m.path === '/'}
              onClick={onNavigate}
              aria-label={expanded ? undefined : m.label}
              className={({ isActive }) =>
                `group relative flex h-10 shrink-0 items-center gap-3 rounded-xl text-sm transition-colors ${
                  expanded ? 'px-3' : 'justify-center'
                } ${
                  isActive
                    ? expanded
                      ? 'bg-uplift font-semibold text-page'
                      : 'bg-uplift/10 text-uplift'
                    : 'font-medium text-ink-soft hover:bg-surface hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <m.icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden />
                  {expanded ? (
                    <span className="truncate">{m.label}</span>
                  ) : (
                    <>
                      {isActive && <span aria-hidden className="absolute -right-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-l bg-uplift" />}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-full z-50 ml-4 whitespace-nowrap rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink opacity-0 shadow-xl shadow-black/40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                      >
                        {m.label}
                      </span>
                    </>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </>
  );
}
