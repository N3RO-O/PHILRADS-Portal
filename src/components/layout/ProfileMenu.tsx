import { useCallback, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Download, LogOut, SquareCheckBig } from 'lucide-react';
import { useDismiss } from '../../hooks/useDismiss';
import { useAuth } from '../auth/AuthProvider';
import { InstallDialog, useInstallAvailability } from '../pwa/InstallDialog';
import { promptInstall } from '../../lib/installPrompt';
import { Avatar } from '../ui/Avatar';

const itemClass = 'flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold hover:bg-black/[0.04]';

export function ProfileMenu() {
  const { profile, state, signOut } = useAuth();
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
        className="flex h-10 items-center gap-2 rounded-full bg-white/70 pl-1 pr-1 backdrop-blur shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_0_0_1px_rgba(53,53,53,0.07),0_4px_12px_-6px_rgba(53,53,53,0.25)] transition-colors hover:bg-white sm:pr-3"
      >
        <Avatar initials={profile.initials} size="sm" />
        <span className="hidden max-w-[9rem] truncate text-sm font-semibold sm:block">{profile.displayName}</span>
        <ChevronDown className="hidden h-4 w-4 text-muted sm:block" aria-hidden />
      </button>
      {open && (
        <div id={panelId} className="glass-popover absolute right-0 top-12 z-50 w-72 origin-top-right animate-pop-in rounded-3xl p-3">
          <div className="flex items-center gap-3 border-b border-black/5 px-2 pb-3">
            <Avatar initials={profile.initials} />
            <div className="min-w-0">
              <p className="truncate font-bold">{profile.displayName}</p>
              <p className="truncate text-xs text-muted">{[profile.roleName, profile.office].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 py-2">
            <Link to="/#my-tasks" className={itemClass} onClick={() => setOpen(false)}>
              <SquareCheckBig className="h-4 w-4 text-burgundy" aria-hidden /> My tasks
            </Link>
            {install !== 'installed' && (
              <button type="button" className={itemClass} onClick={() => void onInstall()}>
                <Download className="h-4 w-4 text-burgundy" aria-hidden /> Install app
              </button>
            )}
            {state.status === 'signed-in' && (
              <button type="button" className={itemClass} onClick={() => void signOut()}>
                <LogOut className="h-4 w-4 text-burgundy" aria-hidden /> Sign out
              </button>
            )}
          </div>
          {state.status === 'demo' && (
            <p className="border-t border-black/5 px-2 pt-3 text-xs text-muted">
              Demo profile. Staff sign-in turns on when the portal is connected to Supabase.
            </p>
          )}
        </div>
      )}
      <InstallDialog open={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}
