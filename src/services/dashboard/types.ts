import type {
  ActivityItem,
  DataSource,
  NotificationItem,
  ProjectSummary,
  StockLevel,
  SummaryMetric,
  TaskSummary,
  WeeklyCount,
} from '../../types';

/**
 * Everything the Home dashboard reads. The UI only talks to this interface,
 * so swapping sample data for live Supabase data needs no component changes.
 */
export interface DashboardService {
  readonly source: DataSource;
  getSummary(): Promise<SummaryMetric[]>;
  getMyTasks(): Promise<TaskSummary[]>;
  getOngoingProjects(limit?: number): Promise<ProjectSummary[]>;
  getRecentActivity(limit?: number): Promise<ActivityItem[]>;
  getStockLevels(): Promise<StockLevel[]>;
  getWeeklyResponse(weeks?: number): Promise<WeeklyCount[]>;
  getNotifications(): Promise<NotificationItem[]>;
  markNotificationsRead(ids: string[]): Promise<void>;
}
