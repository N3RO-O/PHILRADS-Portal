import type { DataSource } from '../../types';

/** Portal roles. Keys match public.roles; what each can do is in public.role_permissions. */
export const STAFF_ROLES = [
  { key: 'admin', label: 'Administrator', description: 'Everything, including approving IMS releases and managing staff.' },
  { key: 'coordinator', label: 'Coordinator', description: 'Projects, tasks, inventory records, response and resources.' },
  { key: 'staff', label: 'Staff', description: 'Day-to-day work: tasks, inventory records and resources.' },
  { key: 'volunteer', label: 'Volunteer', description: 'Field help: their own tasks, stock levels and resources, and uploading photos. Can’t change records.' },
  { key: 'viewer', label: 'Viewer', description: 'Can look, but not change anything.' },
] as const;
export type StaffRoleKey = (typeof STAFF_ROLES)[number]['key'];

export const roleLabel = (key: string) => STAFF_ROLES.find((r) => r.key === key)?.label ?? key;

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  roleKey: string;
  isActive: boolean;
  /** Invited but hasn't opened the email and chosen a password yet. */
  invitePending: boolean;
  invitedAt: string | null;
  lastSignInAt: string | null;
  /** Set when archived (always switched off while archived). */
  archivedAt: string | null;
}

export interface StaffInvite {
  email: string;
  fullName: string;
  roleKey: StaffRoleKey;
}

/** A rule the server enforces (shown to the administrator as is). */
export class StaffRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffRuleError';
  }
}

export interface StaffService {
  readonly source: DataSource;
  list(): Promise<StaffMember[]>;
  /** Sends the invitation email; the account starts switched on with this role. */
  invite(invite: StaffInvite): Promise<void>;
  setRole(id: string, roleKey: StaffRoleKey): Promise<void>;
  setActive(id: string, isActive: boolean): Promise<void>;
  /** Moves the account to Archived and switches it off. Administrators can't be archived. */
  archive(id: string): Promise<void>;
  /** Back to the list, still switched off. */
  restore(id: string): Promise<void>;
}
