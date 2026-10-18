import { dataSource } from '../config/env';
import { supabase } from '../lib/supabase';
import { mockDashboardService } from './dashboard/mockDashboardService';
import { createSupabaseDashboardService } from './dashboard/supabaseDashboardService';
import type { DashboardService } from './dashboard/types';

export type { DashboardService } from './dashboard/types';
export { driveUploadService, DriveNotConfiguredError } from './googleDrive';

/** The one place that decides whether the dashboard shows sample or live data. */
export const dashboardService: DashboardService =
  dataSource === 'supabase' && supabase ? createSupabaseDashboardService(supabase) : mockDashboardService;
