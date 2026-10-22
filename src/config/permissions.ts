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
  | 'activity.read';

export const DEMO_ROLES = [
  { key: 'admin', name: 'Administrator (demo)' },
  { key: 'coordinator', name: 'Coordinator (demo)' },
  { key: 'staff', name: 'Field staff / volunteer (demo)' },
  { key: 'viewer', name: 'Viewer (demo)' },
] as const;

export const PLACEHOLDER_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: ['inventory.read', 'inventory.record', 'inventory.manage', 'inventory.approve', 'activity.read'],
  coordinator: ['inventory.read', 'inventory.record', 'activity.read'],
  staff: ['inventory.read', 'inventory.record', 'activity.read'],
  viewer: ['inventory.read', 'activity.read'],
};
