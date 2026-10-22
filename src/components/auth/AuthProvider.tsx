import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { dataSource } from '../../config/env';
import { DEMO_ROLES, PLACEHOLDER_ROLE_PERMISSIONS, type PermissionKey } from '../../config/permissions';
import { demoProfile } from '../../data/mockDashboard';
import { initialsOf } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { StaffProfile } from '../../types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'demo'; profile: StaffProfile }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session; profile: StaffProfile | null; profileError?: string; permissions: string[] };

interface AuthContextValue {
  state: AuthState;
  /** The profile to show in the UI (demo or signed-in), if any. */
  profile: StaffProfile | null;
  /** UI hint only: the database enforces every permission again through Row Level Security. */
  can(permission: PermissionKey): boolean;
  /** Sample-data mode only: try the portal as another placeholder role. */
  setDemoRole?(roleKey: string): void;
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(client: SupabaseClient, userId: string): Promise<{ profile: StaffProfile | null; error?: string }> {
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, full_name, office, is_active, role_key, roles(name)')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[auth] profile', error);
    return { profile: null, error: 'Your staff profile could not be loaded.' };
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

/** Permissions granted to the caller's role, read through RLS (role_permissions is readable by active staff). */
async function fetchPermissions(client: SupabaseClient, profile: StaffProfile | null): Promise<string[]> {
  if (!profile?.isActive) return [];
  const { data, error } = await client.from('role_permissions').select('permission_key').eq('role_key', profile.roleKey);
  if (error) {
    console.error('[auth] permissions', error);
    return [];
  }
  return (data ?? []).map((r) => r.permission_key as string);
}

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    dataSource === 'supabase' ? { status: 'loading' } : { status: 'demo', profile: demoProfileFor(readDemoRole()) },
  );

  useEffect(() => {
    if (dataSource !== 'supabase' || !supabase) return;
    const client = supabase;
    let active = true;

    const apply = async (session: Session | null) => {
      if (!active) return;
      if (!session) {
        setState({ status: 'signed-out' });
        return;
      }
      const { profile, error } = await fetchProfile(client, session.user.id);
      const permissions = await fetchPermissions(client, profile);
      if (active) setState({ status: 'signed-in', session, profile, profileError: error, permissions });
    };

    void client.auth.getSession().then(({ data }) => apply(data.session));
    // Defer work out of the auth callback: awaiting Supabase calls inside it can deadlock.
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      setTimeout(() => void apply(session), 0);
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

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
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
      signIn,
      signOut,
    };
  }, [state, signIn, signOut, setDemoRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
