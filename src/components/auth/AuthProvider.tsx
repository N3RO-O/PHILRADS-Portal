import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { dataSource, env } from '../../config/env';
import { DEMO_ROLES, PLACEHOLDER_ROLE_PERMISSIONS, type PermissionKey } from '../../config/permissions';
import { demoProfile } from '../../data/mockDashboard';
import { initialsOf } from '../../lib/format';
import { clearDeviceCopies } from '../../lib/deviceCopy';
import { idbDelete } from '../../lib/idb';
import { openedFromPasswordLink, supabase } from '../../lib/supabase';
import type { StaffProfile } from '../../types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'demo'; profile: StaffProfile }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session; profile: StaffProfile | null; profileError?: string; permissions: string[] };

/** Invite and reset links sign the person in without a password; they choose one before going further. */
const SET_PASSWORD_KEY = 'philrads.auth.set-password';
const readNeedsPassword = () => {
  try {
    if (openedFromPasswordLink) sessionStorage.setItem(SET_PASSWORD_KEY, '1');
    return sessionStorage.getItem(SET_PASSWORD_KEY) === '1';
  } catch {
    return openedFromPasswordLink;
  }
};
const clearNeedsPassword = () => {
  try {
    sessionStorage.removeItem(SET_PASSWORD_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
};

interface AuthContextValue {
  state: AuthState;
  /** The profile to show in the UI (demo or signed-in), if any. */
  profile: StaffProfile | null;
  /** UI hint only: the database enforces every permission again through Row Level Security. */
  can(permission: PermissionKey): boolean;
  /** Sample-data mode only: try the portal as another placeholder role. */
  setDemoRole?(roleKey: string): void;
  /** Signed in from an invite or password-reset email and no password chosen yet. */
  needsPassword: boolean;
  signIn(email: string, password: string): Promise<string | null>;
  /** Saves a new password for the signed-in account. Returns an error message, or null. */
  setPassword(password: string): Promise<string | null>;
  /** Emails a password-reset link. Returns an error message, or null. */
  requestPasswordReset(email: string): Promise<string | null>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(client: SupabaseClient, userId: string): Promise<{ profile: StaffProfile | null; error?: string; network?: boolean }> {
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, full_name, office, is_active, role_key, roles(name)')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[auth] profile', error);
    return { profile: null, error: 'Your staff profile could not be loaded.', network: isNetworkError(error.message) };
  }
  if (!data) return { profile: null, error: 'No staff profile exists for this account yet.' };
  const role = data.roles as unknown as { name?: string } | null;
  const displayName = (data.display_name as string) || (data.full_name as string) || 'Staff member';
  return {
    profile: {
      id: data.id as string,
      displayName,
      fullName: (data.full_name as string) || undefined,
      roleKey: data.role_key as string,
      roleName: role?.name,
      office: (data.office as string | null) ?? undefined,
      initials: initialsOf(displayName),
      isActive: Boolean(data.is_active),
    },
  };
}

/** Permissions granted to the caller's role, read through RLS (role_permissions is readable by active staff). Null if they couldn't be read. */
async function fetchPermissions(client: SupabaseClient, profile: StaffProfile | null): Promise<string[] | null> {
  if (!profile?.isActive) return [];
  const { data, error } = await client.from('role_permissions').select('permission_key').eq('role_key', profile.roleKey);
  if (error) {
    console.error('[auth] permissions', error);
    return null;
  }
  return (data ?? []).map((r) => r.permission_key as string);
}

const isNetworkError = (message: string) => !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(message);

// ── Offline: the last profile and permissions seen on this device, so the portal opens without a connection ──
const OFFLINE_KEY = 'philrads.offline.profile';
interface OfflineAuth {
  userId: string;
  profile: StaffProfile;
  permissions: string[];
}
const readOffline = (): OfflineAuth | null => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? 'null') as OfflineAuth | null;
  } catch {
    return null;
  }
};
const writeOffline = (v: OfflineAuth) => {
  try {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable: the portal just won't open offline */
  }
};
const clearOffline = () => {
  try {
    localStorage.removeItem(OFFLINE_KEY);
  } catch {
    /* nothing to clear */
  }
  // The tasks saved for offline use (changes still waiting to sync are kept for when they sign in again).
  void idbDelete('kv', 'tasks:v1').catch(() => undefined);
  void clearDeviceCopies();
};
/** The session Supabase keeps in this browser: used offline when it can't be refreshed (no connection). */
const storedSession = (): Session | null => {
  try {
    const ref = new URL(env.supabaseUrl).hostname.split('.')[0];
    return JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) ?? 'null') as Session | null;
  } catch {
    return null;
  }
};

const DEMO_ROLE_KEY = 'philrads.demo.role';
const demoProfileFor = (roleKey: string): StaffProfile => {
  const role = DEMO_ROLES.find((r) => r.key === roleKey);
  return role ? { ...demoProfile, roleKey: role.key, roleName: role.name } : demoProfile;
};
const readDemoRole = () => {
  try {
    return localStorage.getItem(DEMO_ROLE_KEY) ?? demoProfile.roleKey;
  } catch {
    return demoProfile.roleKey;
  }
};

/** "Chrome on Android", "Safari on iPhone"…: enough for an administrator to recognise a device. */
function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'another system';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Brave/.test(ua) ? 'Brave' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
  const app = window.matchMedia?.('(display-mode: standalone)').matches ? ' (installed app)' : '';
  return `${browser} on ${os}${app}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    dataSource === 'supabase' ? { status: 'loading' } : { status: 'demo', profile: demoProfileFor(readDemoRole()) },
  );
  const [needsPassword, setNeedsPassword] = useState(() => dataSource === 'supabase' && readNeedsPassword());

  useEffect(() => {
    if (dataSource !== 'supabase' || !supabase) return;
    const client = supabase;
    let active = true;

    const apply = async (session: Session | null) => {
      if (!active) return;
      const saved = readOffline();
      if (!session) {
        // Offline, and the sign-in couldn't be renewed without a connection: keep working with what this
        // device saved. Supabase renews it (and this runs again) once the connection is back.
        const stored = !navigator.onLine && saved ? storedSession() : null;
        if (saved && stored?.user?.id === saved.userId) setState({ status: 'signed-in', session: stored, profile: saved.profile, permissions: saved.permissions });
        else setState({ status: 'signed-out' });
        return;
      }
      const { profile, error, network } = await fetchProfile(client, session.user.id);
      if (network && saved?.userId === session.user.id) {
        if (active) setState({ status: 'signed-in', session, profile: saved.profile, permissions: saved.permissions });
        return;
      }
      const permissions = await fetchPermissions(client, profile);
      if (profile?.isActive && permissions) writeOffline({ userId: session.user.id, profile, permissions });
      if (active) setState({ status: 'signed-in', session, profile, profileError: error, permissions: permissions ?? (saved?.userId === session.user.id ? saved.permissions : []) });
    };

    void client.auth.getSession().then(({ data }) => apply(data.session));
    // Defer work out of the auth callback: awaiting Supabase calls inside it can deadlock.
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true);
      setTimeout(() => void apply(session), 0);
      // For the admin log. The database takes who it is from the session and counts one sign-in per 20 minutes.
      if (event === 'SIGNED_IN') setTimeout(() => void client.rpc('log_sign_in', { p_device: deviceLabel() }).then(() => undefined, () => undefined), 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'Sign-in is not configured.';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return null;
    return error.message === 'Invalid login credentials' ? 'That email and password do not match.' : 'Sign-in failed. Please try again.';
  }, []);

  const setPassword = useCallback(async (password: string) => {
    if (!supabase) return 'Sign-in is not configured.';
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error('[auth] set password', error);
      return error.message.includes('different from the old')
        ? 'Choose a password you have not used before.'
        : 'Your password could not be saved. Please try again.';
    }
    clearNeedsPassword();
    setNeedsPassword(false);
    return null;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) return 'Sign-in is not configured.';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) {
      console.error('[auth] reset password', error);
      return 'The reset email could not be sent. Please try again in a few minutes.';
    }
    return null;
  }, []);

  const signOut = useCallback(async () => {
    clearNeedsPassword();
    setNeedsPassword(false);
    clearOffline();
    // Offline: sign out of this device only (signing out everywhere needs the server).
    await supabase?.auth.signOut(navigator.onLine ? undefined : { scope: 'local' });
    if (!navigator.onLine) setState({ status: 'signed-out' });
  }, []);

  const setDemoRole = useCallback((roleKey: string) => {
    try {
      localStorage.setItem(DEMO_ROLE_KEY, roleKey);
    } catch {
      /* storage unavailable: keep in memory only */
    }
    setState({ status: 'demo', profile: demoProfileFor(roleKey) });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const granted = new Set<string>(
      state.status === 'demo'
        ? PLACEHOLDER_ROLE_PERMISSIONS[state.profile.roleKey] ?? []
        : state.status === 'signed-in'
          ? state.permissions
          : [],
    );
    return {
      state,
      profile: state.status === 'demo' || state.status === 'signed-in' ? state.profile : null,
      can: (permission) => granted.has(permission),
      setDemoRole: state.status === 'demo' ? setDemoRole : undefined,
      needsPassword: state.status === 'signed-in' && needsPassword,
      signIn,
      setPassword,
      requestPasswordReset,
      signOut,
    };
  }, [state, needsPassword, signIn, setPassword, requestPasswordReset, signOut, setDemoRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
