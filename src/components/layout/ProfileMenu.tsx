import { useCallback, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ChevronDown, Download, Fingerprint, Gift, LogOut, Rocket, SquareCheckBig, UserRound, UsersRound, Volume2 } from 'lucide-react';
import { QuickUnlockSheet, useQuickUnlock } from '../auth/QuickUnlock';
import { CHOICES, STATUS_META, usePresence, type Choice } from '../../lib/presence';
import { StatusDot } from '../ui/StatusDot';
import { StatusAvatar } from '../ui/StatusAvatar';
import { whatsNew } from '../../lib/whatsNew';
import { errorSound, useErrorSound } from '../../lib/errorSound';
import { notificationSound, useNotificationSound } from '../../lib/notificationSound';
import { Switch } from '../ui/Switch';
import { ThemeSwitch } from '../ui/ThemeSwitch';
import { useOnboarding } from '../onboarding/OnboardingProvider';
import { useDismiss } from '../../hooks/useDismiss';
import { DEMO_ROLES } from '../../config/permissions';
import { useAuth } from '../auth/AuthProvider';
import { InstallDialog, useInstallAvailability } from '../pwa/InstallDialog';
import { promptInstall } from '../../lib/installPrompt';
import { Avatar } from '../ui/Avatar';

const itemClass = 'flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-ink/[0.05]';

interface PanelProps {
  /** Closes whatever holds the panel (the menu or the navigation drawer). */
  onClose: () => void;
  onInstall: () => void;
  onUnlock: () => void;
  /** In the navigation drawer: just you (picture, name, role) until tapped open. */
  collapsible?: boolean;
}

/** You (with your status), your account links and settings: in the top-right menu, or at the top of the phone navigation drawer. */
export function AccountPanel({ onClose, onInstall, onUnlock, collapsible = false }: PanelProps) {
  const { profile, state, signOut, setDemoRole, can } = useAuth();
  const onboarding = useOnboarding();
  const roleSelectId = useId();
  const panelId = useId();
  const presence = usePresence();
  const [picking, setPicking] = useState(false);
  const [expanded, setExpanded] = useState(!collapsible);
  const install = useInstallAvailability();
  const soundOn = useErrorSound();
  const tingOn = useNotificationSound();
  const quick = useQuickUnlock();

  if (!profile) return null;
  const statusLabel = presence.choice === 'invisible' ? 'Invisible' : STATUS_META[presence.choice].label;
  const who = (
    <>
      <span className="block truncate font-semibold">{profile.displayName}</span>
      <span className="block truncate text-xs font-normal text-muted">{[profile.jobTitle || profile.roleName, profile.office].filter(Boolean).join(' · ')}</span>
    </>
  );

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (picking && e.key === 'Escape') {
          e.stopPropagation();
          setPicking(false);
        } else if (collapsible && expanded && e.key === 'Escape') {
          e.stopPropagation();
          setExpanded(false);
        }
      }}
    >
      <div className={`relative flex items-center gap-3 px-2 ${expanded && !collapsible ? 'border-b border-line pb-3' : ''}`}>
        {/* Tap your picture (with its status dot) to change your status. */}
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          aria-expanded={picking}
          aria-label={`Your status: ${statusLabel}. Change status`}
          title="Change status"
          className="group relative shrink-0 rounded-full"
        >
          <StatusAvatar status={presence.mine} size={40} className={`transition-transform duration-200 group-hover:scale-105 ${picking ? 'scale-105' : ''}`}>
            <Avatar initials={profile.initials} src={profile.avatar} color={profile.avatarColor} />
          </StatusAvatar>
        </button>
        {collapsible ? (
          <button
            type="button"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl text-left text-sm"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((x) => !x)}
          >
            <span className="min-w-0 flex-1">{who}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        ) : (
          <p className="min-w-0 text-sm">{who}</p>
        )}
        {/* Floats over the menu, so nothing under it moves. A tap anywhere else in the menu closes it. */}
        {picking && <button type="button" tabIndex={-1} aria-hidden className="fixed inset-0 z-10 cursor-default" onClick={() => setPicking(false)} />}
        {picking && (
          <div
            className="popover absolute left-0 top-full z-20 mt-1.5 flex w-64 max-w-[calc(100vw-3rem)] origin-top-left animate-pop-in flex-col p-1 shadow-2xl shadow-black/40"
            role="radiogroup"
            aria-label="Your status"
          >
            {CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={presence.choice === c.value}
                onClick={() => (presence.setChoice(c.value as Choice), setPicking(false))}
                className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-ink/[0.06] ${presence.choice === c.value ? 'bg-ink/[0.05]' : ''}`}
              >
                <StatusDot status={c.value === 'invisible' ? 'offline' : c.value} size={16} ring="rgb(var(--surface-raised))" className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{c.label}</span>
                  <span className="block text-xs leading-snug text-muted">{c.note}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* In the drawer the account floats over the navigation, so the list below never moves. */}
      {collapsible && expanded && <button type="button" tabIndex={-1} aria-hidden className="fixed inset-0 z-10 cursor-default" onClick={() => setExpanded(false)} />}
      {expanded && (
        <div
          id={panelId}
          className={
            collapsible
              ? 'popover absolute -left-2 -right-2 top-full z-20 mt-3 max-h-[calc(100dvh-9.5rem)] origin-top animate-pop-in overflow-y-auto overscroll-contain p-2 shadow-2xl shadow-black/40'
              : ''
          }
        >
          <div className="flex flex-col gap-0.5 py-2">
            <Link to="/profile" className={itemClass} onClick={onClose}>
              <UserRound className="h-4 w-4" aria-hidden /> Your profile
            </Link>
            <Link to="/tasks" className={itemClass} onClick={onClose}>
              <SquareCheckBig className="h-4 w-4" aria-hidden /> My tasks
            </Link>
            {/* After "Skip for now": bring the Get started list back, progress intact. */}
            {onboarding.ready && onboarding.state.hidden && !onboarding.allDone && (
              <Link
                to="/"
                className={itemClass}
                onClick={() => {
                  onboarding.show();
                  onClose();
                }}
              >
                <Rocket className="h-4 w-4" aria-hidden /> Getting started
                <span className="ml-auto text-xs tabular-nums text-muted">
                  {onboarding.doneCount} of {onboarding.steps.length}
                </span>
              </Link>
            )}
            {can('staff.manage') && (
              <Link to="/staff" className={itemClass} onClick={onClose}>
                <UsersRound className="h-4 w-4" aria-hidden /> Manage staff
              </Link>
            )}
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                onClose();
                whatsNew.showNotes();
              }}
            >
              <Gift className="h-4 w-4" aria-hidden /> What’s new
            </button>
            <div className="px-3 py-1.5">
              <ThemeSwitch size="sm" className="w-full" />
            </div>
            <div className={itemClass}>
              <Volume2 className="h-4 w-4" aria-hidden />
              <span id={`${panelId}-sound`} className="flex-1">
                Sound on errors
              </span>
              <Switch checked={soundOn} labelledBy={`${panelId}-sound`} onChange={(next) => errorSound.set(next)} />
            </div>
            <div className={itemClass}>
              <BellRing className="h-4 w-4" aria-hidden />
              <span id={`${panelId}-ting`} className="flex-1">
                Sound on notifications
              </span>
              <Switch checked={tingOn} labelledBy={`${panelId}-ting`} onChange={(next) => notificationSound.set(next)} />
            </div>
            <button type="button" className={itemClass} onClick={() => (onClose(), onUnlock())}>
              <Fingerprint className="h-4 w-4" aria-hidden />
              <span className="flex-1">Quick unlock</span>
              <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${quick.enabled ? 'bg-status-in/15 text-status-in' : 'bg-ink/[0.06] text-muted'}`}>{quick.enabled ? 'On' : 'Off'}</span>
            </button>
            {install !== 'installed' && (
              <button type="button" className={itemClass} onClick={() => (onClose(), onInstall())}>
                <Download className="h-4 w-4" aria-hidden /> Install app
              </button>
            )}
            {state.status === 'signed-in' && (
              <button type="button" className={itemClass} onClick={() => void signOut()}>
                <LogOut className="h-4 w-4" aria-hidden /> Sign out
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
                  <select id={roleSelectId} className="field py-2" value={profile.roleKey} onChange={(e) => setDemoRole(e.target.value)}>
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
    </div>
  );
}

/** Install and Quick unlock open as their own sheets, so they outlive the menu or drawer that opened them. */
export function useAccountSheets() {
  const install = useInstallAvailability();
  const [installOpen, setInstallOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  return {
    onInstall: () => (install === 'prompt' ? void promptInstall() : setInstallOpen(true)),
    onUnlock: () => setUnlockOpen(true),
    sheets: (
      <>
        <InstallDialog open={installOpen} onClose={() => setInstallOpen(false)} />
        <QuickUnlockSheet open={unlockOpen} onClose={() => setUnlockOpen(false)} />
      </>
    ),
  };
}

/** The top-right account menu (wide screens; on phones and tablets you're at the top of the navigation drawer). */
export function ProfileMenu() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const presence = usePresence();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, wrap, close, button);
  const { onInstall, onUnlock, sheets } = useAccountSheets();

  if (!profile) return null;
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
        <StatusAvatar status={presence.mine} size={32}>
          <Avatar initials={profile.initials} src={profile.avatar} color={profile.avatarColor} size="sm" />
        </StatusAvatar>
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-ink sm:block">{profile.displayName}</span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>
      {open && (
        <div id={panelId} className="popover absolute right-0 top-12 z-50 w-72 origin-top-right animate-pop-in p-3">
          <AccountPanel onClose={close} onInstall={onInstall} onUnlock={onUnlock} />
        </div>
      )}
      {sheets}
    </div>
  );
}
