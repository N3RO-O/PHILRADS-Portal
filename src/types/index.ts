/** Shared domain types used by the UI and by every data source (mock or Supabase). */

export type ModuleId =
  | 'home'
  | 'live-map'
  | 'inventory'
  | 'pdm'
  | 'documentation'
  | 'response'
  | 'projects'
  | 'tasks'
  | 'print-docs';

/** Where a value came from. The UI labels anything from "mock" as sample data. */
export type DataSource = 'mock' | 'supabase';

export interface StaffProfile {
  id: string;
  displayName: string;
  fullName?: string;
  roleKey: string;
  roleName?: string;
  office?: string;
  initials: string;
  isActive: boolean;
}

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

export interface TaskSummary {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  /** ISO date (YYYY-MM-DD) or null */
  dueDate: string | null;
  module: ModuleId | null;
}

export type ActivityKind = 'project' | 'inventory' | 'document' | 'task' | 'response' | 'other';

export interface ActivityItem {
  id: string;
  /** ISO timestamp */
  occurredAt: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  actor?: string;
}

export type SummaryKey =
  | 'active_projects'
  | 'pending_tasks'
  | 'inventory_alerts'
  | 'response_activities'
  | 'documentation_updates'
  | 'upcoming_deadlines';

export interface SummaryMetric {
  key: SummaryKey;
  value: number;
}

export interface StockLevel {
  id: string;
  item: string;
  location: string;
  onHand: number;
  reorderLevel: number;
  unit: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  programArea: string;
  /** 0–100 */
  progress: number;
  /** ISO date (YYYY-MM-DD) or null */
  endDate: string | null;
  updatedAt: string;
}

export interface WeeklyCount {
  /** ISO date of the week's Monday */
  weekStart: string;
  count: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
  linkPath?: string;
}

export const DOCUMENT_CATEGORIES = [
  'Photos',
  'Videos',
  'Reports',
  'Assessments',
  'Distribution records',
  'Contracts and agreements',
  'Other',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
