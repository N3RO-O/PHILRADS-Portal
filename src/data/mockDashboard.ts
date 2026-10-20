/**
 * DEVELOPMENT-ONLY SAMPLE DATA.
 * Invented values for demonstrating the dashboard. None of this is real PHILRADS
 * staff, project, inventory or response information. Dates are relative to "now"
 * so the demo never looks stale.
 */
import type { ActivityItem, NotificationItem, ProjectSummary, StaffProfile, StockLevel, TaskSummary, WeeklyCount } from '../types';

const DAY = 86_400_000;
const HOUR = 3_600_000;

const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();
const dateIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

export const demoProfile: StaffProfile = {
  id: 'demo-user',
  displayName: 'Demo User',
  roleKey: 'staff',
  roleName: 'Program Officer (demo)',
  office: 'Main office',
  initials: 'DU',
  isActive: true,
};

export const mockTasks = (): TaskSummary[] => [
  { id: 't1', title: 'Submit field report for relief distribution', priority: 'high', status: 'in_progress', dueDate: dateIn(1), module: 'response' },
  { id: 't2', title: 'Reconcile hygiene kit stock count', priority: 'high', status: 'todo', dueDate: dateIn(2), module: 'inventory' },
  { id: 't3', title: 'Upload site assessment photo captions', priority: 'medium', status: 'todo', dueDate: dateIn(3), module: 'documentation' },
  { id: 't4', title: 'Prepare PDM survey schedule', priority: 'medium', status: 'review', dueDate: dateIn(5), module: 'pdm' },
  { id: 't5', title: 'Update livelihood project timeline', priority: 'low', status: 'in_progress', dueDate: dateIn(9), module: 'projects' },
  { id: 't6', title: 'Print acknowledgement receipts batch', priority: 'low', status: 'todo', dueDate: dateIn(12), module: 'print-docs' },
];

export const mockProjects = (): ProjectSummary[] => [
  { id: 'p1', name: 'Community Livelihood Program', programArea: 'Livelihood', progress: 60, endDate: dateIn(24), updatedAt: isoAgo(1 * DAY) },
  { id: 'p2', name: 'Safe Water and Sanitation', programArea: 'WASH', progress: 35, endDate: dateIn(52), updatedAt: isoAgo(4 * DAY) },
  { id: 'p3', name: 'Typhoon Recovery Support', programArea: 'Disaster response', progress: 80, endDate: dateIn(9), updatedAt: isoAgo(2 * HOUR) },
  { id: 'p4', name: 'Child Nutrition Feeding', programArea: 'Health and nutrition', progress: 48, endDate: dateIn(71), updatedAt: isoAgo(3 * DAY) },
  { id: 'p5', name: 'Community Health Workers Training', programArea: 'Health', progress: 22, endDate: dateIn(96), updatedAt: isoAgo(5 * DAY) },
];

export const mockActivity = (): ActivityItem[] => [
  { id: 'a10', occurredAt: isoAgo(1 * HOUR), kind: 'response', title: 'Relief distribution logged', detail: 'Family food packs distributed at an evacuation center', actor: 'Field team (sample)' },
  { id: 'a9', occurredAt: isoAgo(3 * HOUR), kind: 'inventory', title: 'Stock released from main warehouse', detail: 'Hygiene kits issued to field hub A', actor: 'Warehouse team (sample)' },
  { id: 'a8', occurredAt: isoAgo(1 * DAY + 2 * HOUR), kind: 'document', title: 'Site assessment photos uploaded', detail: '18 photos added to the Response folder', actor: 'Documentation team (sample)' },
  { id: 'a7', occurredAt: isoAgo(1 * DAY + 5 * HOUR), kind: 'task', title: 'Completed: beneficiary list review', detail: 'Marked done in Tasks', actor: 'Programs office (sample)' },
  { id: 'a6', occurredAt: isoAgo(1 * DAY + 8 * HOUR), kind: 'project', title: 'Livelihood project milestone updated', detail: 'Training phase moved to 60% complete', actor: 'Programs office (sample)' },
  { id: 'a5', occurredAt: isoAgo(2 * DAY + 1 * HOUR), kind: 'inventory', title: 'Inventory received', detail: 'Tarpaulins delivered to field hub A', actor: 'Warehouse team (sample)' },
  { id: 'a4', occurredAt: isoAgo(2 * DAY + 6 * HOUR), kind: 'response', title: 'Rapid needs assessment started', detail: 'Team deployed to flood-affected communities', actor: 'Response team (sample)' },
  { id: 'a3', occurredAt: isoAgo(3 * DAY + 3 * HOUR), kind: 'document', title: 'Monthly report draft uploaded', detail: 'Program report, version 2', actor: 'Communications (sample)' },
  { id: 'a2', occurredAt: isoAgo(3 * DAY + 9 * HOUR), kind: 'task', title: 'Completed: warehouse count', detail: 'Quarterly stock count closed', actor: 'Warehouse team (sample)' },
  { id: 'a1', occurredAt: isoAgo(4 * DAY + 4 * HOUR), kind: 'project', title: 'WASH project budget revised', detail: 'Revision submitted for approval', actor: 'Finance office (sample)' },
];

export const mockStock = (): StockLevel[] => [
  { id: 'i1', item: 'Family food packs', location: 'Main warehouse', onHand: 140, reorderLevel: 300, unit: 'packs' },
  { id: 'i2', item: 'Hygiene kits', location: 'Main warehouse', onHand: 85, reorderLevel: 150, unit: 'kits' },
  { id: 'i3', item: 'Water containers 20L', location: 'Field hub A', onHand: 40, reorderLevel: 100, unit: 'pcs' },
  { id: 'i4', item: 'Solar lamps', location: 'Field hub B', onHand: 18, reorderLevel: 50, unit: 'pcs' },
  { id: 'i5', item: 'Tarpaulins', location: 'Field hub A', onHand: 260, reorderLevel: 200, unit: 'pcs' },
  { id: 'i6', item: 'Sleeping mats', location: 'Main warehouse', onHand: 120, reorderLevel: 100, unit: 'pcs' },
];

export const mockWeeklyResponse = (weeks = 8): WeeklyCount[] => {
  const counts = [1, 3, 2, 4, 2, 1, 3, 1];
  const monday = new Date();
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return counts.slice(-weeks).map((count, i, arr) => ({
    weekStart: new Date(monday.getTime() - (arr.length - 1 - i) * 7 * DAY).toISOString().slice(0, 10),
    count,
  }));
};

export const mockSummaryCounts = {
  active_projects: 12,
  pending_tasks: 18,
  response_activities: 7,
  documentation_updates: 23,
  upcoming_deadlines: 6,
} as const;

export const mockNotifications = (): NotificationItem[] =>
  mockActivity()
    .slice(0, 4)
    .map((a, i) => ({ id: `n-${a.id}`, title: a.title, body: a.detail, createdAt: a.occurredAt, read: i > 1 }));
