/**
 * Placeholder role → permission matrix, mirroring the seeded `role_permissions` rows
 * (supabase/migrations). Used only in sample-data mode; with Supabase the signed-in
 * staff member's permissions are read from the database, which also enforces them.
 */
export type PermissionKey =
  | 'inventory.read'
  | 'inventory.record'
  | 'inventory.manage'
  | 'inventory.approve'
  | 'activity.read'
  | 'audit.read'
  | 'documents.upload'
  | 'documents.manage'
  | 'projects.manage'
  | 'resources.read'
  | 'resources.manage'
  | 'beneficiaries.record'
  | 'tasks.read_all'
  | 'tasks.manage'
  | 'staff.manage'
  | 'map.read'
  | 'map.manage'
  | 'map.checkin';

export const DEMO_ROLES = [
  { key: 'admin', name: 'Administrator (demo)' },
  { key: 'coordinator', name: 'Coordinator (demo)' },
  { key: 'staff', name: 'Field staff (demo)' },
  { key: 'volunteer', name: 'Volunteer (demo)' },
  { key: 'viewer', name: 'Viewer (demo)' },
] as const;

export const PLACEHOLDER_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: ['inventory.read', 'inventory.record', 'inventory.manage', 'inventory.approve', 'activity.read', 'audit.read', 'documents.upload', 'documents.manage', 'projects.manage', 'resources.read', 'resources.manage', 'beneficiaries.record', 'tasks.read_all', 'tasks.manage', 'staff.manage', 'map.read', 'map.manage', 'map.checkin'],
  coordinator: ['inventory.read', 'inventory.record', 'activity.read', 'documents.upload', 'projects.manage', 'resources.read', 'resources.manage', 'beneficiaries.record', 'tasks.read_all', 'tasks.manage', 'map.read', 'map.manage', 'map.checkin'],
  staff: ['inventory.read', 'inventory.record', 'activity.read', 'documents.upload', 'resources.read', 'map.read', 'map.checkin'],
  volunteer: ['inventory.read', 'documents.upload', 'resources.read', 'map.read', 'map.checkin'],
  viewer: ['inventory.read', 'activity.read', 'resources.read', 'map.read'],
};
