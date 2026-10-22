import { dataSource, env } from '../config/env';
import { supabase } from '../lib/supabase';
import { mockDashboardService } from './dashboard/mockDashboardService';
import { createSupabaseDashboardService } from './dashboard/supabaseDashboardService';
import type { DashboardService } from './dashboard/types';
import { createImsInventoryService, createSampleImsService } from './inventory/imsInventoryService';
import { createInventoryStore } from './inventory/inventoryStore';
import { mockInventoryService } from './inventory/mockInventoryService';
import { createSupabaseInventoryService } from './inventory/supabaseInventoryService';

export type { DashboardService } from './dashboard/types';
export { driveUploadService, DriveNotConfiguredError } from './googleDrive';

/** The one place that decides whether the dashboard shows sample or live data. */
export const dashboardService: DashboardService =
  dataSource === 'supabase' && supabase ? createSupabaseDashboardService(supabase) : mockDashboardService;

/** Inventory data source, wrapped in the offline-first store (outbox + cached snapshot). */
const live = dataSource === 'supabase' && supabase ? supabase : null;
export const inventoryStore = createInventoryStore(
  env.inventorySource === 'ims'
    ? live
      ? createImsInventoryService(live)
      : createSampleImsService(env.imsUrl)
    : live
      ? createSupabaseInventoryService(live)
      : mockInventoryService,
);
