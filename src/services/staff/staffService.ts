import type { SupabaseClient } from '@supabase/supabase-js';
import { demoProfile } from '../../data/mockDashboard';
import { StaffRuleError, type StaffMember, type StaffService } from './types';

// ───────────────────────── Sample data (this browser only) ─────────────────────────

const STORE_KEY = 'philrads.sample.staff.v2';
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const seed = (): StaffMember[] => ([

  { id: demoProfile.id, email: 'you@philrads.org', name: demoProfile.displayName, roleKey: 'admin', isActive: true, invitePending: false, invitedAt: null, lastSignInAt: daysAgo(0) },
  { id: 'staff-2', email: 'maria.santos@philrads.org', name: 'Maria Santos', roleKey: 'coordinator', isActive: true, invitePending: false, invitedAt: daysAgo(40), lastSignInAt: daysAgo(1) },
  { id: 'staff-3', email: 'jose.reyes@philrads.org', name: 'Jose Reyes', roleKey: 'staff', isActive: true, invitePending: false, invitedAt: daysAgo(30), lastSignInAt: daysAgo(3) },
  { id: 'staff-4', email: 'ana.cruz@philrads.org', name: 'Ana Cruz', roleKey: 'staff', isActive: true, invitePending: true, invitedAt: daysAgo(2), lastSignInAt: null },
  { id: 'staff-5', email: 'paolo.garcia@gmail.com', name: 'Paolo Garcia', roleKey: 'volunteer', isActive: true, invitePending: false, invitedAt: daysAgo(12), lastSignInAt: daysAgo(2) },
  { id: 'staff-6', email: 'board.observer@philrads.org', name: 'Board Observer', roleKey: 'viewer', isActive: false, invitePending: false, invitedAt: daysAgo(90), lastSignInAt: daysAgo(60) },
  { id: 'staff-7', email: 'summer.volunteer@gmail.com', name: 'Summer Volunteer', roleKey: 'volunteer', isActive: false, invitePending: false, invitedAt: daysAgo(200), lastSignInAt: daysAgo(150), archivedAt: daysAgo(100) },
] as Omit<StaffMember, 'archivedAt'>[]).map((m) => ({ archivedAt: null, ...m }));

let sample: StaffMember[] | null = null;
const sampleState = (): StaffMember[] => {
  if (sample) return sample;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return (sample = JSON.parse(raw) as StaffMember[]);
  } catch {
    /* fall back to the seed */
  }
  return (sample = seed());
};
const persist = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(sampleState()));
  } catch {
    /* storage unavailable: changes last until reload */
  }
};
const later = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 200));
const isAdmin = (m: StaffMember) => m.isActive && m.roleKey === 'admin';

/** Same rules as the database (protect_staff_admins), so sample mode behaves like the real thing. */
const checkChange = (id: string, next: Partial<StaffMember>) => {
  if (id === demoProfile.id) throw new StaffRuleError('You can’t change your own role or switch off your own account. Ask another administrator.');
  const all = sampleState();
  const target = all.find((m) => m.id === id);
  if (!target) throw new StaffRuleError('That account no longer exists.');
  const after = { ...target, ...next };
  if (isAdmin(target) && !isAdmin(after) && !all.some((m) => m.id !== id && isAdmin(m))) {
    throw new StaffRuleError('This is the last administrator. Make someone else an administrator first.');
  }
  sample = all.map((m) => (m.id === id ? after : m));
  persist();
};

export const mockStaffService: StaffService = {
  source: 'mock',
  async list() {
    if (!navigator.onLine) throw new TypeError('Failed to fetch (offline)');
    return later(structuredClone(sampleState()));
  },
  async invite({ email, fullName, roleKey }) {
    const address = email.trim().toLowerCase();
    const existing = sampleState().find((m) => m.email === address);
    if (existing && !existing.invitePending) throw new StaffRuleError(`${address} already has a portal account. Find them in the list to change their role.`);
    const now = new Date().toISOString();
    const member: StaffMember = {
      id: existing?.id ?? `staff-${crypto.randomUUID?.() ?? Date.now()}`,
      email: address,
      name: fullName.trim() || address.split('@')[0],
      roleKey,
      isActive: true,
      invitePending: true,
      invitedAt: now,
      lastSignInAt: null,
      archivedAt: null,
    };
    sample = existing ? sampleState().map((m) => (m.id === member.id ? member : m)) : [member, ...sampleState()];
    persist();
    await later(null);
  },
  async setRole(id, roleKey) {
    checkChange(id, { roleKey });
    await later(null);
  },
  async setActive(id, isActive) {
    checkChange(id, { isActive });
    await later(null);
  },
  async archive(id) {
    if (sampleState().find((m) => m.id === id)?.roleKey === 'admin') throw new StaffRuleError('Administrators can’t be archived. Change their role first.');
    checkChange(id, { archivedAt: new Date().toISOString(), isActive: false });
    await later(null);
  },
  async restore(id) {
    checkChange(id, { archivedAt: null });
    await later(null);
  },
};

// ───────────────────────── Supabase ─────────────────────────

/**
 * Live staff accounts. list_staff() and the profile rules in the database decide who may see and
 * change what (staff.manage); invitations go through /api/staff-invite, which holds the service key.
 */
export function createSupabaseStaffService(client: SupabaseClient): StaffService {
  const fail = (what: string, error: { message: string; code?: string }): never => {
    console.error(`[staff] ${what}`, error);
    // Our own rules (protect_staff_admins, guard_profile_privileges) carry a readable message.
    if (error.code === '42501') throw new StaffRuleError(error.message.startsWith('permission denied') ? 'Your role does not allow this.' : error.message);
    throw new Error(`Could not ${what}. Check the connection and try again.`);
  };
  const update = async (id: string, row: Record<string, unknown>, what: string) => {
    const { data, error } = await client.from('profiles').update(row).eq('id', id).select('id');
    if (error) fail(what, error);
    if (!data?.length) throw new StaffRuleError('Your role does not allow this.');
  };

  return {
    source: 'supabase',
    async list() {
      const { data, error } = await client.rpc('list_staff');
      if (error) fail('load staff accounts', error);
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        email: r.email as string,
        name: (r.full_name as string) || (r.display_name as string) || (r.email as string),
        roleKey: r.role_key as string,
        isActive: Boolean(r.is_active),
        invitePending: Boolean(r.invite_pending),
        invitedAt: (r.invited_at as string | null) ?? null,
        lastSignInAt: (r.last_sign_in_at as string | null) ?? null,
        archivedAt: (r.archived_at as string | null) ?? null,
      }));
    },
    async invite(invite) {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new StaffRuleError('Sign in again, then try once more.');
      let res: Response;
      try {
        res = await fetch('/api/staff-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(invite),
        });
      } catch {
        throw new Error('Could not reach the server. Check the connection and try again.');
      }
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        if (res.status >= 400 && res.status < 500 && body.error) throw new StaffRuleError(body.error);
        throw new Error(body.error ?? 'The invitation could not be sent. Try again in a few minutes.');
      }
    },
    setRole: (id, roleKey) => update(id, { role_key: roleKey }, 'change the role'),
    setActive: (id, isActive) => update(id, { is_active: isActive }, isActive ? 'switch the account on' : 'switch the account off'),
    // The database switches an archived account off and refuses to archive administrators.
    archive: (id) => update(id, { archived_at: new Date().toISOString() }, 'archive the account'),
    restore: (id) => update(id, { archived_at: null }, 'restore the account'),
  };
}
