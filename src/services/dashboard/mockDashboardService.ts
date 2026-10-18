import {
  mockActivity,
  mockNotifications,
  mockProjects,
  mockStock,
  mockSummaryCounts,
  mockTasks,
  mockWeeklyResponse,
} from '../../data/mockDashboard';
import type { DashboardService } from './types';

/** Small delay so loading states are exercised in development. */
const later = <T,>(value: T, ms = 180) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export const mockDashboardService: DashboardService = {
  source: 'mock',
  getSummary: () => {
    const alerts = mockStock().filter((s) => s.onHand < s.reorderLevel).length;
    return later([
      { key: 'active_projects', value: mockSummaryCounts.active_projects },
      { key: 'pending_tasks', value: mockSummaryCounts.pending_tasks },
      { key: 'inventory_alerts', value: alerts },
      { key: 'response_activities', value: mockSummaryCounts.response_activities },
      { key: 'documentation_updates', value: mockSummaryCounts.documentation_updates },
      { key: 'upcoming_deadlines', value: mockSummaryCounts.upcoming_deadlines },
    ]);
  },
  getMyTasks: () => later(mockTasks()),
  getOngoingProjects: (limit = 3) => later(mockProjects().slice(0, limit)),
  getRecentActivity: (limit = 12) => later(mockActivity().slice(0, limit)),
  getStockLevels: () => later(mockStock()),
  getWeeklyResponse: (weeks = 8) => later(mockWeeklyResponse(weeks)),
  getNotifications: () => later(mockNotifications()),
};
