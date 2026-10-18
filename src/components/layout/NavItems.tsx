import { NavLink } from 'react-router-dom';
import { MODULES, NAV_GROUPS } from '../../config/modules';

interface NavItemsProps {
  expanded: boolean;
  onNavigate?: () => void;
}

/** Module links grouped as Overview / Field operations / Work. Shared by the desktop rail and the mobile drawer. */
export function NavItems({ expanded, onNavigate }: NavItemsProps) {
  return (
    <>
      {NAV_GROUPS.map((group, gi) => (
        <div key={group} className="flex flex-col gap-1">
          {expanded ? (
            <p className="animate-fade-in px-3 pb-0.5 pt-1 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-white/60">{group}</p>
          ) : (
            gi > 0 && <hr className="mx-3 my-1 border-white/15" aria-hidden />
          )}
          {MODULES.filter((m) => m.group === group).map((m) => (
            <NavLink
              key={m.id}
              to={m.path}
              end={m.path === '/'}
              onClick={onNavigate}
              aria-label={expanded ? undefined : m.label}
              className={({ isActive }) =>
                `group relative flex h-11 shrink-0 items-center gap-3 rounded-full text-sm font-semibold transition-colors ${
                  expanded ? 'px-3' : 'justify-center'
                } ${
                  isActive
                    ? 'bg-gradient-to-b from-white to-[#f3e9e9] text-burgundy shadow-[inset_0_-1px_0_rgba(100,6,6,0.08),0_6px_16px_-6px_rgba(0,0,0,0.45)]'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <m.icon className="h-5 w-5 shrink-0" aria-hidden />
              {expanded ? (
                <span className="animate-fade-in truncate">{m.label}</span>
              ) : (
                <span
                  aria-hidden
                  className="gloss-charcoal pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  {m.label}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </>
  );
}
