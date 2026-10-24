import { useCallback, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Download, LogOut, SquareCheckBig, UsersRound } from 'lucide-react';
import { useDismiss } from '../../hooks/useDismiss';
import { DEMO_ROLES } from '../../config/permissions';
import { useAuth } from '../auth/AuthProvider';
import { InstallDialog, useInstallAvailability } from '../pwa/InstallDialog';
import { promptInstall } from '../../lib/installPrompt';
import { Avatar } from '../ui/Avatar';

const itemClass = 'flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-white/[0.05]';

export function ProfileMenu() {
  const { profile, state, signOut, setDemoRole, can } = useAuth();
  const roleSelectId = useId();
  const [open, setOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, wrap, close, button);
  const install = useInstallAvailability();

  if (!profile) return null;

  const onInstall = async () => {
    setOpen(false);
    if (install === 'prompt') await promptInstall();
    else setInstallOpen(true);
  };

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-xl pl-1 pr-2 transition-colors hover:bg-surface-raised"
      >
        <Avatar initials={profile.initials} size="sm" />
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-ink sm:block">{profile.displayName}</span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>
      {open && (
        <div id={panelId} className="popover absolute right-0 top-12 z-50 w-72 origin-top-right animate-pop-in p-3">
          <div className="flex items-center gap-3 border-b border-line px-2 pb-3">
            <Avatar initials={profile.initials} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile.displayName}</p>
              <p className="truncate text-xs text-muted">{[profile.roleName, profile.office].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 py-2">
            <Link to="/#my-tasks" className={itemClass} onClick={() => setOpen(false)}>
              <SquareCheckBig className="h-4 w-4 text-uplift" aria-hidden /> My tasks
            </Link>
            {can('staff.manage') && (
              <Link to="/staff" className={itemClass} onClick={() => setOpen(false)}>
                <UsersRound className="h-4 w-4 text-uplift" aria-hidden /> Manage staff
              </Link>
            )}
            {install !== 'installed' && (
              <button type="button" className={itemClass} onClick={() => void onInstall()}>
                <Download className="h-4 w-4 text-uplift" aria-hidden /> Install app
              </button>
            )}
            {state.status === 'signed-in' && (
              <button type="button" className={itemClass} onClick={() => void signOut()}>
                <LogOut className="h-4 w-4 text-uplift" aria-hidden /> Sign out
              </button>
            )}
          </div>
          {state.status === 'demo' && (
            <div className="flex flex-col gap-2 border-t border-line px-2 pt-3">
              {setDemoRole && (
                <>
                  <label htmlFor={roleSelectId} className="text-xs font-semibold text-ink-soft">
                    Try the portal as
                  </label>
                  <select
                    id={roleSelectId}
                    className="field py-2"
                    value={profile.roleKey}
                    onChange={(e) => setDemoRole(e.target.value)}
                  >
                    {DEMO_ROLES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <p className="text-xs text-muted">Demo profile. Staff sign-in turns on when the portal is connected to Supabase.</p>
            </div>
          )}
        </div>
      )}
      <InstallDialog open={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}
